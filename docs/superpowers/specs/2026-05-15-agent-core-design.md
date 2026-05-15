# Agent Core System Design
**Date:** 2026-05-15
**Project:** prompt-hometown-agents (Animal Crossing-style top-view pixel simulation)
**Stack:** Next.js, OpenAI API, LangChain.js

---

## 1. 프로젝트 개요

동물의 숲 스타일의 탑뷰 도트 게임 시뮬레이션. 유저와 필드 위 NPC들이 각자의 성격, 습관, 기억을 가지고 자율적으로 행동하며, 유저는 NPC와 대화하거나 구체적인 요청을 할 수 있다. NPC는 자신의 특성과 히스토리를 기반으로 요청을 수락하거나 거부한다.

---

## 2. 전체 아키텍처

```
[Browser - Next.js Client]
  ├── Game Canvas        — 탑뷰 렌더링, 유저/NPC 이동, 시간 표시
  ├── Dialogue UI        — 유저 ↔ NPC 대화창
  ├── Settings Panel     — 메모리 리셋 기능
  └── LocalStorage
        ├── game:npc:{id}:memory   — NPC별 대화/요청 히스토리
        └── game:clock             — 게임 내 시간/날짜

[Next.js API Routes]
  └── POST /api/agent/interact
        ├── 입력: NPC 프로필 + LocalStorage 히스토리 + 유저 메시지
        ├── LangChain Agent 실행 (validate_request 툴 장착)
        └── 출력: { responseText, decision?, updatedMemory }
```

**데이터 흐름:**
유저 입력 → 클라이언트가 NPC 프로필 + 히스토리를 묶어 API 호출 → LangChain Agent 판단 → 결과 반환 → 클라이언트가 LocalStorage 갱신

---

## 3. Agent & Request 파이프라인

→ **별도 문서 참조:** [2026-05-15-agent-prd.md](./2026-05-15-agent-prd.md)

엔드포인트: `POST /api/agent/interact`
- 일반 대화: LangChain Agent가 직접 응답 (OpenAI API 1회)
- 구체적 요청: `validate_request` 툴 → 3-Step Pipeline (OpenAI API 3회)

---

## 4. NPC 데이터 모델

### 4-1. NPCProfile (고정값 — 코드/JSON에 정의)

```ts
type NPCProfile = {
  id: string
  name: string
  personality: string[]       // ["친절함", "겁쟁이", "고집스러움"]
  dislikeds: string[]         // ["폭력적인 요청", "낯선 사람"]
  speechStyle: string         // "반말, 수줍음, 짧은 문장"
  waypoints: {
    x: number
    y: number
    label: string             // "낚시터", "광장"
  }[]
  habits: {
    action: string            // "낚시하기"
    location: string          // waypoint label 참조
    gameHour: number          // 게임 내 시각 (0~23)
    duration: number          // 지속 시간 (게임 내 분)
  }[]
}
```

### 4-2. NPCMemory (동적값 — LocalStorage)

```ts
type NPCMemory = {
  npcId: string
  conversationHistory: {
    timestamp: number         // 게임 내 시간 (분 단위)
    speaker: 'user' | 'npc'
    message: string
    type: 'chat' | 'request'
    decision?: 'ok' | 'not_ok'
  }[]
  relationshipScore: number   // 관계도 (판단에 반영)
}
// LocalStorage key: "game:npc:{id}:memory"
```

### 4-3. GameClock

```ts
type GameClock = {
  currentMinute: number       // 하루 0~1439 (분 단위)
  day: number
  // 현실 1분 = 게임 10분 (10배속)
}
// LocalStorage key: "game:clock"
```

### 4-4. LocalStorage 격리 정책

- 모든 키는 `game:` 네임스페이스로 시작
- Settings Panel의 리셋은 `game:` prefix를 가진 키만 삭제
- 다른 앱의 LocalStorage 데이터에 영향 없음

---

## 5. 게임 루프 & 렌더링

### 5-1. 렌더링

- HTML Canvas (Next.js Client Component)
- 도트 그래픽: 초기에는 색상 블록으로 시작, 스프라이트 교체 가능한 구조

### 5-2. 게임 루프 (`requestAnimationFrame`)

```
매 프레임:
  ├── GameClock 업데이트 (현실 경과 시간 × 10배속)
  ├── NPC 행동 업데이트 (상태머신)
  ├── 유저 이동 업데이트 (키보드 입력)
  └── Canvas 렌더링
        ├── 타일맵 (바닥)
        ├── NPC 스프라이트
        ├── 유저 스프라이트
        └── 대화 말풍선 (활성화 시)
```

### 5-3. NPC 행동 상태머신

```
[Wandering] ←→ [Traveling to Waypoint] ←→ [Performing Habit]
    │                   │                          │
목적 없이           waypoint 간                 습관 행동 수행
이리저리 배회       이동 중                   (낚시, 앉아있기 등)
```

**행동 결정 우선순위 (매 GameClock 틱마다):**
1. 현재 시각이 habit의 `gameHour`와 일치 → `[Performing Habit]`
2. 다음 waypoint 목표 있음 → `[Traveling to Waypoint]`
3. 그 외 → `[Wandering]` (일정 확률로 다음 waypoint 선택 or 랜덤 배회)

### 5-4. 상호작용 트리거

- 유저가 NPC 근처에서 `Space` or 클릭 → 대화창 열림
- 대화창 입력 → `/api/agent/interact` 호출
- Agent가 입력 내용을 보고 일반 대화 or `validate_request` 툴 호출 결정

---

## 6. Settings Panel

- 게임 메모리 리셋: `game:` prefix 키 전체 삭제
- 리셋 후 모든 NPC 관계도/히스토리 초기화, GameClock 초기화
