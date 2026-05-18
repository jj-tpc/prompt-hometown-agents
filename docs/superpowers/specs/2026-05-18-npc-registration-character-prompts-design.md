# NPC 등록 및 개별 캐릭터 프롬프트 시스템

**날짜:** 2026-05-18  
**상태:** 승인됨

---

## 개요

새로 추가된 Sprout Lands 에셋의 캐릭터 스프라이트(guard, innkeeper, noble, sheep, street-vendor, townsfolk, vegetable-vendor, villager)를 게임 NPC로 등록하고, 각 NPC가 자신만의 캐릭터 프롬프트 파일(`.txt`)을 갖도록 한다. 이 캐릭터 프롬프트는 전역 `interact.txt`에 주입되며, Prompt Studio의 새 "NPC 프롬프트" 탭에서 NPC별로 편집·오버라이드할 수 있다.

---

## 아키텍처

### 데이터 흐름

```
src/game-core/agent/prompts/npcs/{npcId}.txt  (기본값, 서버 사이드)
  └─ /api/agent/interact 에서 npcId로 로드
  └─ localStorage 오버라이드가 있으면 대체
  └─ interact.txt의 {characterPrompt} 플레이스홀더에 주입

Prompt Studio → "NPC 프롬프트" 탭
  └─ NPC 목록 표시 (스프라이트 + 이름)
  └─ NPC 선택 → 캐릭터 프롬프트 편집
  └─ 저장 → localStorage: hometown:npc-character-prompt:{npcId}
  └─ 리셋 → GET /api/prompts/npc/{npcId} 로 기본값 재로드
```

---

## 섹션 1: 새 NPC 9개 정의

`src/game-core/game-loop/world-dialogue.ts`의 `NPC_BLUEPRINTS`에 추가한다.  
각 NPC는 `spriteId` 필드로 에셋 파일과 연결된다.

| npcId | 이름 | 성격 | 말투 | spriteId |
|-------|------|------|------|----------|
| `npc_guard` | 경비대원 카엔 | 충직함, 규율, 과묵함 | 짧고 딱딱한 경어 | `guard` |
| `npc_innkeeper` | 여관주인 마리 | 수다스러움, 친절, 사업적 | 밝고 친근한 반말 | `innkeeper` |
| `npc_noble` | 귀족 시릴 | 거만함, 박식함, 까다로움 | 격식체, 약간 경멸적 | `noble` |
| `npc_street_vendor` | 행상인 탄 | 눈치빠름, 구수함, 흥정 좋아함 | 구수한 상인 말투 | `street-vendor` |
| `npc_vegetable_vendor` | 채소장수 나리 | 부지런함, 솔직함, 텃밭 자랑 | 활기차고 직설적인 반말 | `vegetable-vendor` |
| `npc_townsfolk` | 마을사람 베아 | 평범함, 소문 좋아함, 의심 많음 | 수군거리는 듯한 반말 | `townsfolk` |
| `npc_villager` | 촌민 루카 | 순박함, 느긋함, 농사 이야기만 | 느릿느릿한 사투리 반말 | `villager` |
| `npc_sheep` | 양 모모 | 순함, 겁쟁이, 먹는 것만 관심 | 의성어 섞인 짧은 반응 | `sheep` |
| `npc_blacksmith2` | 대장장이 브렌 | 고집스러움, 자부심, 일 중독 | 퉁명스럽고 짧은 반말 | `blacksmith` |

> 기존 `RABBIT`, `BLACKSMITH` sample-npcs는 유지하고, 월드 NPC로 위 9개를 추가한다.

---

## 섹션 2: NPC 캐릭터 프롬프트 파일

### 위치

```
src/game-core/agent/prompts/npcs/
  npc_guard.txt
  npc_innkeeper.txt
  npc_noble.txt
  npc_street_vendor.txt
  npc_vegetable_vendor.txt
  npc_townsfolk.txt
  npc_villager.txt
  npc_sheep.txt
  npc_blacksmith2.txt
```

### 파일 형식 (예: npc_guard.txt)

```
당신은 마을의 경비대원 카엔입니다.
왕국 기사단 출신으로 부상 후 이 마을에 배치되었습니다.
규율을 중시하며 마을의 안전에 책임감을 느낍니다.
밤에는 혼자 술을 마시며 과거를 회상하는 버릇이 있습니다.
낯선 이에게는 경계하지만, 신뢰가 쌓이면 진심을 드러냅니다.
```

### interact.txt 변경

기존 플레이스홀더 블록에 `{characterPrompt}` 추가:

```
<character_background>
{characterPrompt}
</character_background>
```

파일이 없거나 비어 있는 NPC는 이 블록을 빈 문자열로 치환 (렌더링에 영향 없음).

---

## 섹션 3: NPCProfile 타입 변경

`src/game-core/types/npc.ts`에 `spriteId` 필드 추가:

```typescript
type NPCProfile = {
  id: string
  name: string
  spriteId?: string          // 에셋 파일명 (예: "guard", "innkeeper")
  personality: string[]
  dislikeds: string[]
  speechStyle: string
  waypoints: { x: number; y: number; label: string }[]
  habits: { action: string; location: string; gameHour: number; duration: number }[]
  visionProfile?: NPCVisionProfile
}
```

`characterPrompt`는 NPCProfile에 포함하지 않는다. 서버에서 npcId 기반으로 별도 로드.

---

## 섹션 4: API 변경

### `/api/agent/interact` (POST)

**추가 입력 필드:**
```typescript
characterPromptOverride?: string  // 클라이언트 localStorage 오버라이드
```

**서버 처리 로직:**
1. `npcProfile.id`로 `prompts/npcs/{npcId}.txt` 읽기 시도
2. 파일 없으면 빈 문자열
3. `characterPromptOverride`가 요청에 포함되면 파일 내용 대신 사용
4. `interact.ts`의 prompt substitution에 `characterPrompt` 추가

### `/api/prompts/npc/[npcId]` (GET) — 신규

Studio에서 기본값 조회용:
- `prompts/npcs/{npcId}.txt` 내용 반환
- 파일 없으면 빈 문자열 반환

---

## 섹션 5: 스토리지 모듈

`src/game-core/storage/npc-character-prompt-storage.ts` 신규 생성:

```typescript
const KEY = (npcId: string) => `hometown:npc-character-prompt:${npcId}`

export function loadNpcCharacterPrompt(npcId: string): string | null
export function saveNpcCharacterPrompt(npcId: string, prompt: string): void
export function clearNpcCharacterPrompt(npcId: string): void
```

---

## 섹션 6: Prompt Studio UI

### 탭 변경

기존: `응답 프롬프트 | 검증 파이프라인 | 세계지식 | 설정`  
변경: `응답 프롬프트 | 검증 파이프라인 | 세계지식 | NPC 프롬프트 | 설정`

### "NPC 프롬프트" 탭 레이아웃

좌측 패널(현재 탭/필드 목록 영역)에 NPC 목록 표시:
- 각 항목: 스프라이트 썸네일 이미지 + NPC 이름
- 선택 상태 하이라이트

우측 편집 영역(현재 textarea 영역):
- 선택된 NPC의 캐릭터 프롬프트 textarea
- 상단: NPC 이름 + "파일 기본값" 뱃지 (오버라이드 없을 때) / "편집됨" 뱃지 (오버라이드 있을 때)
- 하단: [기본값으로 리셋] [저장] 버튼

### 동작

- 탭 진입 시: 첫 번째 NPC 자동 선택, localStorage에서 오버라이드 로드
- 저장: localStorage에 저장, 게임 iframe은 자동으로 다음 대화 시 반영
- 리셋: `/api/prompts/npc/{npcId}` 로 기본값 fetch → textarea에 표시, localStorage 항목 삭제

---

## 파일 변경 목록

| 파일 | 변경 유형 |
|------|-----------|
| `src/game-core/types/npc.ts` | 수정 — `spriteId?` 필드 추가 |
| `src/game-core/agent/prompts/interact.txt` | 수정 — `{characterPrompt}` 블록 추가 |
| `src/game-core/agent/prompts/npcs/npc_*.txt` | 신규 — NPC별 캐릭터 프롬프트 9개 |
| `src/game-core/agent/interact.ts` | 수정 — `characterPrompt` 치환 추가 |
| `src/game-core/storage/npc-character-prompt-storage.ts` | 신규 |
| `src/game-core/game-loop/world-dialogue.ts` | 수정 — NPC 9개 블루프린트 추가 |
| `src/app/api/agent/interact/route.ts` | 수정 — npc 파일 로드 + 오버라이드 처리 |
| `src/app/api/prompts/npc/[npcId]/route.ts` | 신규 — 기본값 조회 API |
| `src/app/studio/page.tsx` | 수정 — "NPC 프롬프트" 탭 추가 |
| `next.config.ts` | 수정 — `prompts/npcs/*.txt` 파일 추적 추가 |
