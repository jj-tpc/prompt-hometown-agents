# NPC 등록 및 개별 캐릭터 프롬프트 시스템 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 9개의 새 NPC를 게임 월드에 등록하고, 각 NPC가 자신만의 `.txt` 캐릭터 프롬프트 파일을 가지며, Prompt Studio의 "NPC 프롬프트" 탭에서 NPC별로 편집·오버라이드할 수 있도록 한다.

**Architecture:** NPCProfile에 `spriteId?`와 `characterPromptKey?` 필드 추가. NPC별 `.txt` 파일은 서버에서 `characterPromptKey`로 로드하고, 클라이언트 localStorage 오버라이드가 있으면 우선 적용. `interactWithNPC`에 `characterPrompt?: string`을 주입해 `<character_background>` 블록으로 시스템 프롬프트에 추가. Studio에는 "NPC 프롬프트" 탭을 추가하고 NPC 목록 + 편집기 UI를 제공한다.

**Tech Stack:** Next.js App Router, TypeScript, localStorage, Jest (테스트), Node.js `fs` (서버 사이드 파일 읽기)

---

## 파일 변경 목록

| 파일 | 유형 |
|------|------|
| `src/game-core/types/npc.ts` | 수정 — `spriteId?`, `characterPromptKey?` 추가 |
| `src/game-core/agent/prompts/npcs/npc_guard.txt` | 신규 |
| `src/game-core/agent/prompts/npcs/npc_innkeeper.txt` | 신규 |
| `src/game-core/agent/prompts/npcs/npc_noble.txt` | 신규 |
| `src/game-core/agent/prompts/npcs/npc_street_vendor.txt` | 신규 |
| `src/game-core/agent/prompts/npcs/npc_vegetable_vendor.txt` | 신규 |
| `src/game-core/agent/prompts/npcs/npc_townsfolk.txt` | 신규 |
| `src/game-core/agent/prompts/npcs/npc_villager.txt` | 신규 |
| `src/game-core/agent/prompts/npcs/npc_sheep.txt` | 신규 |
| `src/game-core/agent/prompts/npcs/npc_blacksmith2.txt` | 신규 |
| `src/game-core/game-loop/world-dialogue.ts` | 수정 — 9개 블루프린트 추가, `WORLD_NPC_CHARACTER_PROMPTS` export |
| `src/game-core/map/random-terrain.ts` | 수정 — 9개 NPC 스폰 오프셋 추가 |
| `src/game-core/agent/prompts/load-prompt.ts` | 수정 — `loadNpcCharacterPromptDefault` 추가 |
| `src/game-core/agent/interact.ts` | 수정 — `characterPrompt?` 파라미터 추가, 프롬프트 주입 |
| `src/app/api/agent/interact/route.ts` | 수정 — 파일 로드 + `characterPromptOverride` 수락 |
| `src/app/api/prompts/npc/[npcId]/route.ts` | 신규 — 기본값 조회 GET 엔드포인트 |
| `next.config.ts` | 수정 — `npcs/*.txt` 파일 추적 추가 |
| `src/game-core/storage/npc-character-prompt-storage.ts` | 신규 |
| `tests/game-core/storage/npc-character-prompt-storage.test.ts` | 신규 |
| `src/app/dev/world/page.tsx` | 수정 — `characterPromptOverride` API 요청에 포함 |
| `src/app/studio/page.tsx` | 수정 — "NPC 프롬프트" 탭 추가 |

---

## Task 1: NPCProfile 타입 확장

**Files:**
- Modify: `src/game-core/types/npc.ts`

- [ ] **Step 1: 타입에 두 필드 추가**

`src/game-core/types/npc.ts`를 다음으로 교체:

```typescript
import type { NPCVisionProfile } from "@/game-core/types/map"

export type NPCProfile = {
  id: string
  name: string
  spriteId?: string
  characterPromptKey?: string
  personality: string[]
  dislikeds: string[]
  speechStyle: string
  waypoints: { x: number; y: number; label: string }[]
  habits: {
    action: string
    location: string
    gameHour: number
    duration: number
  }[]
  visionProfile?: NPCVisionProfile
}

export type ConversationEntry = {
  timestamp: number
  speaker: "user" | "npc"
  message: string
  type: "chat" | "request"
  decision?: "ok" | "not_ok"
}

export type NPCMemory = {
  npcId: string
  conversationHistory: ConversationEntry[]
  relationshipScore: number
}
```

- [ ] **Step 2: 기존 테스트가 여전히 통과하는지 확인**

```bash
npx jest tests/game-core/fixtures/sample-npcs.test.ts --no-coverage
```

Expected: PASS (새 필드는 optional이므로 기존 NPCProfile 객체 영향 없음)

- [ ] **Step 3: 커밋**

```bash
git add src/game-core/types/npc.ts
git commit -m "feat: add spriteId and characterPromptKey to NPCProfile"
```

---

## Task 2: NPC 캐릭터 프롬프트 파일 9개 생성

**Files:**
- Create: `src/game-core/agent/prompts/npcs/npc_guard.txt`
- Create: `src/game-core/agent/prompts/npcs/npc_innkeeper.txt`
- Create: `src/game-core/agent/prompts/npcs/npc_noble.txt`
- Create: `src/game-core/agent/prompts/npcs/npc_street_vendor.txt`
- Create: `src/game-core/agent/prompts/npcs/npc_vegetable_vendor.txt`
- Create: `src/game-core/agent/prompts/npcs/npc_townsfolk.txt`
- Create: `src/game-core/agent/prompts/npcs/npc_villager.txt`
- Create: `src/game-core/agent/prompts/npcs/npc_sheep.txt`
- Create: `src/game-core/agent/prompts/npcs/npc_blacksmith2.txt`

- [ ] **Step 1: `npc_guard.txt` 생성**

```
당신은 마을의 경비대원 카엔입니다.
왕국 기사단 출신으로 부상을 입고 이 마을에 배치되었습니다.
규율과 질서를 중시하며 마을의 안전을 지키는 데 자부심을 느낍니다.
밤이 되면 혼자 파수를 서며 과거 전장을 떠올리는 버릇이 있습니다.
낯선 이에게는 경계하지만, 마을 주민이라면 묵묵히 고개를 끄덕이며 지나갑니다.
```

- [ ] **Step 2: `npc_innkeeper.txt` 생성**

```
당신은 마을 유일의 여관을 운영하는 마리입니다.
여행자들의 이야기를 듣는 것을 즐기고, 마을 소식은 대부분 당신의 여관에서 나옵니다.
손님이 오면 무조건 음식부터 권하고, 한번 말을 시작하면 멈추기 어렵습니다.
여관비는 깎아주는 적이 없지만, 진짜 딱한 사정이 있는 사람에게는 몰래 밥을 챙겨줍니다.
```

- [ ] **Step 3: `npc_noble.txt` 생성**

```
당신은 이 마을에 별장을 둔 귀족 시릴입니다.
수도 귀족 사회에서 낙향해 이 시골에 머물고 있으며, 그것이 내심 자존심이 상합니다.
학식이 넓고 말이 많지만, 평민을 대할 때는 은연중에 위에서 내려다보는 태도가 나옵니다.
좋은 포도주와 예술 이야기에는 눈이 반짝이며 자세가 달라집니다.
```

- [ ] **Step 4: `npc_street_vendor.txt` 생성**

```
당신은 여러 마을을 돌아다니며 물건을 파는 행상인 탄입니다.
발이 넓어 마을마다 소문을 가지고 다니고, 흥정을 즐깁니다.
어떤 물건이든 "이건 특별한 거야"라고 말하는 버릇이 있습니다.
겉보기엔 가볍지만 길에서 쌓은 눈치가 남달리 빠릅니다.
```

- [ ] **Step 5: `npc_vegetable_vendor.txt` 생성**

```
당신은 텃밭에서 직접 기른 채소를 파는 나리입니다.
새벽 4시에 일어나 밭을 돌보고, 채소 하나하나에 남다른 애착이 있습니다.
자신의 채소가 최고라는 확신이 있으며, 다른 사람 채소는 "그냥 그래"라고 합니다.
솔직하고 직설적이라 돌려말하는 법이 없어서 가끔 사람들이 당황합니다.
```

- [ ] **Step 6: `npc_townsfolk.txt` 생성**

```
당신은 마을에서 나고 자란 베아입니다.
소문을 듣고 전하는 것이 낙이지만, 사실인지 아닌지는 별로 따지지 않습니다.
낯선 사람을 보면 일단 의심하고, 아는 사람이라도 뒤에서 뒷말을 합니다.
마음속으로는 마을이 더 활기찼으면 좋겠다고 생각합니다.
```

- [ ] **Step 7: `npc_villager.txt` 생성**

```
당신은 마을 외곽 밭에서 농사를 짓는 루카입니다.
서두르는 법이 없고, 이야기는 항상 밭 이야기로 흘러갑니다.
계절과 날씨에 민감하며, 올해 수확이 어떨지가 가장 큰 관심사입니다.
도시 것들이 이해가 잘 안 가지만 그렇다고 나쁘게 생각하지는 않습니다.
```

- [ ] **Step 8: `npc_sheep.txt` 생성**

```
당신은 마을 풀밭에 자유롭게 돌아다니는 양 모모입니다.
딱히 언어로 말하지는 않지만, 반응을 보면 이해는 하는 것 같습니다.
풀이 있으면 행복하고, 큰 소리가 나면 도망칩니다.
가끔 사람에게 바짝 다가와 냄새를 맡다가 흥미를 잃고 돌아섭니다.
```

- [ ] **Step 9: `npc_blacksmith2.txt` 생성**

```
당신은 마을 동쪽 끝에 있는 작은 대장간의 대장장이 브렌입니다.
어릴 때부터 쇠를 두드려 와서 다른 일은 생각해본 적이 없습니다.
말이 많지 않고 대답도 짧지만, 연장 이야기가 나오면 조금 길어집니다.
싸구려 일감은 단호히 거절하며, 한번 맡은 일은 끝까지 합니다.
```

- [ ] **Step 10: 커밋**

```bash
git add src/game-core/agent/prompts/npcs/
git commit -m "feat: add character prompt files for 9 new NPCs"
```

---

## Task 3: world-dialogue.ts에 9개 NPC 블루프린트 추가

**Files:**
- Modify: `src/game-core/game-loop/world-dialogue.ts`
- Test: `tests/game-core/game-loop/world-dialogue.test.ts`

- [ ] **Step 1: 실패 테스트 먼저 작성**

`tests/game-core/game-loop/world-dialogue.test.ts` 파일에 아래 테스트 추가 (기존 테스트 아래에):

```typescript
import {
  DEFAULT_DIALOGUE_CHOICES,
  dialogueChoiceForKey,
  makeWorldDialogueGameState,
  normalizeCustomDialogueMessage,
  resolveWorldNPCProfile,
  WORLD_NPC_CHARACTER_PROMPTS,
} from "@/game-core/game-loop/world-dialogue"

// ... 기존 describe 블록 유지 ...

describe("new named world NPCs", () => {
  it("WORLD_NPC_CHARACTER_PROMPTS lists 9 named NPCs with characterPromptKey", () => {
    expect(WORLD_NPC_CHARACTER_PROMPTS).toHaveLength(9)
    const keys = WORLD_NPC_CHARACTER_PROMPTS.map((n) => n.characterPromptKey)
    expect(keys).toContain("npc_guard")
    expect(keys).toContain("npc_innkeeper")
    expect(keys).toContain("npc_sheep")
  })

  it("resolves npc_5 to a named NPC with characterPromptKey", () => {
    const profile = resolveWorldNPCProfile("npc_5")
    expect(profile.characterPromptKey).toBeDefined()
    expect(profile.characterPromptKey).toBe("npc_guard")
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npx jest tests/game-core/game-loop/world-dialogue.test.ts --no-coverage
```

Expected: FAIL — `WORLD_NPC_CHARACTER_PROMPTS` not exported, `npc_5` doesn't have characterPromptKey

- [ ] **Step 3: world-dialogue.ts 전체 교체**

`src/game-core/game-loop/world-dialogue.ts`를 다음으로 교체:

```typescript
import type { NpcPosition } from "@/game-core/game-loop/world-interaction"
import type { GameState } from "@/game-core/types/game"
import type { NPCProfile } from "@/game-core/types/npc"

export type DialogueChoiceId = "1" | "2" | "3"

export type DialogueChoice = {
  id: DialogueChoiceId
  label: string
  userMessage: string
}

export const DEFAULT_DIALOGUE_CHOICES: DialogueChoice[] = [
  {
    id: "1",
    label: "안녕, 요즘 어떻게 지내?",
    userMessage: "안녕, 요즘 어떻게 지내?",
  },
  {
    id: "2",
    label: "혹시 나 좀 도와줄 수 있어?",
    userMessage: "혹시 나 좀 도와줄 수 있어?",
  },
  {
    id: "3",
    label: "이 마을에 대해 알려줘.",
    userMessage: "이 마을에 대해 알려줘.",
  },
]

type NPCBlueprint = Omit<NPCProfile, "id">

const NPC_BLUEPRINTS: NPCBlueprint[] = [
  // ── 기존 4개 (numeric npc_1~4) ──────────────────────────────────
  {
    name: "라미",
    personality: ["상냥함", "호기심 많음", "조심스러움"],
    dislikeds: ["무리한 부탁", "거친 말투"],
    speechStyle: "친근한 반말, 짧고 따뜻한 문장",
    waypoints: [
      { x: 95, y: 97, label: "작은 풀밭" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "풀밭 살피기", location: "작은 풀밭", gameHour: 10, duration: 45 }],
  },
  {
    name: "도윤",
    personality: ["침착함", "현실적", "책임감 있음"],
    dislikeds: ["위험한 지름길", "근거 없는 소문"],
    speechStyle: "차분한 반말, 필요한 말만 또렷하게",
    waypoints: [
      { x: 105, y: 102, label: "동쪽 길목" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "길목 확인하기", location: "동쪽 길목", gameHour: 10, duration: 30 }],
  },
  {
    name: "하린",
    personality: ["관찰력 좋음", "수다스러움", "기억력이 좋음"],
    dislikeds: ["대화를 끊는 행동", "잊어버린 약속"],
    speechStyle: "밝은 반말, 가끔 감탄사를 섞음",
    waypoints: [
      { x: 97, y: 105, label: "남쪽 공터" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "마을 기록 정리", location: "남쪽 공터", gameHour: 10, duration: 60 }],
  },
  {
    name: "무진",
    personality: ["과묵함", "성실함", "손재주 좋음"],
    dislikeds: ["재촉", "허술한 준비"],
    speechStyle: "짧은 반말, 무뚝뚝하지만 악의 없는 말투",
    waypoints: [
      { x: 106, y: 96, label: "북동쪽 작업터" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "도구 손질", location: "북동쪽 작업터", gameHour: 10, duration: 50 }],
  },
  // ── 신규 9개 (npc_5~13) ─────────────────────────────────────────
  {
    name: "경비대원 카엔",
    spriteId: "guard",
    characterPromptKey: "npc_guard",
    personality: ["충직함", "규율", "과묵함"],
    dislikeds: ["무단출입", "규율 위반", "게으름"],
    speechStyle: "짧고 딱딱한 경어, 군대식 어투",
    waypoints: [
      { x: 92, y: 100, label: "마을 입구" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "순찰", location: "마을 입구", gameHour: 8, duration: 120 }],
  },
  {
    name: "여관주인 마리",
    spriteId: "innkeeper",
    characterPromptKey: "npc_innkeeper",
    personality: ["수다스러움", "친절", "사업적"],
    dislikeds: ["무전취식 시도", "여관 규칙 무시"],
    speechStyle: "밝고 친근한 반말, 말이 많음",
    waypoints: [
      { x: 100, y: 92, label: "여관" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "여관 청소", location: "여관", gameHour: 7, duration: 60 }],
  },
  {
    name: "귀족 시릴",
    spriteId: "noble",
    characterPromptKey: "npc_noble",
    personality: ["거만함", "박식함", "까다로움"],
    dislikeds: ["무례함", "평민의 무지", "시골 냄새"],
    speechStyle: "격식체, 약간 경멸적, 긴 문장",
    waypoints: [
      { x: 108, y: 108, label: "별장" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "별장 정원 산책", location: "별장", gameHour: 15, duration: 45 }],
  },
  {
    name: "행상인 탄",
    spriteId: "street-vendor",
    characterPromptKey: "npc_street_vendor",
    personality: ["눈치빠름", "구수함", "흥정 좋아함"],
    dislikeds: ["흥정 없는 거래", "무시당하는 것"],
    speechStyle: "구수한 상인 말투, 과장 많음",
    waypoints: [
      { x: 98, y: 103, label: "시장 앞" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "물건 정리", location: "시장 앞", gameHour: 9, duration: 30 }],
  },
  {
    name: "채소장수 나리",
    spriteId: "vegetable-vendor",
    characterPromptKey: "npc_vegetable_vendor",
    personality: ["부지런함", "솔직함", "텃밭 자랑"],
    dislikeds: ["채소 무시", "게으른 사람"],
    speechStyle: "활기차고 직설적인 반말",
    waypoints: [
      { x: 102, y: 108, label: "채소 가판대" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "채소 가판대 정리", location: "채소 가판대", gameHour: 6, duration: 90 }],
  },
  {
    name: "마을사람 베아",
    spriteId: "townsfolk",
    characterPromptKey: "npc_townsfolk",
    personality: ["평범함", "소문 좋아함", "의심 많음"],
    dislikeds: ["비밀을 안 알려주는 것", "낯선 사람"],
    speechStyle: "수군거리는 듯한 반말",
    waypoints: [
      { x: 100, y: 95, label: "마을 광장" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "광장 구경", location: "마을 광장", gameHour: 11, duration: 60 }],
  },
  {
    name: "촌민 루카",
    spriteId: "villager",
    characterPromptKey: "npc_villager",
    personality: ["순박함", "느긋함", "농사 이야기만"],
    dislikeds: ["재촉", "농사 무시"],
    speechStyle: "느릿느릿한 사투리 반말",
    waypoints: [
      { x: 110, y: 100, label: "외곽 밭" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "밭 돌보기", location: "외곽 밭", gameHour: 6, duration: 180 }],
  },
  {
    name: "양 모모",
    spriteId: "sheep",
    characterPromptKey: "npc_sheep",
    personality: ["순함", "겁쟁이", "먹는 것만 관심"],
    dislikeds: ["큰 소리", "갑작스러운 움직임"],
    speechStyle: "의성어 섞인 짧은 반응, 거의 말을 안 함",
    waypoints: [
      { x: 96, y: 96, label: "풀밭" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "풀 뜯기", location: "풀밭", gameHour: 8, duration: 240 }],
  },
  {
    name: "대장장이 브렌",
    spriteId: "blacksmith",
    characterPromptKey: "npc_blacksmith2",
    personality: ["고집스러움", "자부심", "일 중독"],
    dislikeds: ["싸구려 일감", "작업 중 방해"],
    speechStyle: "퉁명스럽고 짧은 반말",
    waypoints: [
      { x: 107, y: 93, label: "동쪽 대장간" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "쇠 두드리기", location: "동쪽 대장간", gameHour: 6, duration: 150 }],
  },
]

export type WorldNpcCharacterPromptEntry = {
  npcId: string
  name: string
  spriteId?: string
  characterPromptKey: string
}

export const WORLD_NPC_CHARACTER_PROMPTS: WorldNpcCharacterPromptEntry[] = NPC_BLUEPRINTS
  .map((bp, i) => ({ bp, npcId: `npc_${i + 1}` }))
  .filter(({ bp }) => bp.characterPromptKey != null)
  .map(({ bp, npcId }) => ({
    npcId,
    name: bp.name,
    spriteId: bp.spriteId,
    characterPromptKey: bp.characterPromptKey!,
  }))

export function dialogueChoiceForKey(key: string): DialogueChoice | null {
  return DEFAULT_DIALOGUE_CHOICES.find((choice) => choice.id === key) ?? null
}

export function normalizeCustomDialogueMessage(input: string): string | null {
  const message = input.trim()
  return message.length > 0 ? message : null
}

export function resolveWorldNPCProfile(npcId: string): NPCProfile {
  const match = npcId.match(/\d+$/)
  const npcNumber = match ? Number(match[0]) : 1
  const blueprint = NPC_BLUEPRINTS[(Math.max(1, npcNumber) - 1) % NPC_BLUEPRINTS.length]
  return { id: npcId, ...blueprint }
}

export function makeWorldDialogueGameState(npcs: NpcPosition[]): GameState {
  return {
    clock: { day: 1, currentMinute: 600 },
    availableItems: [
      { id: "apple", name: "사과", quantity: 3 },
      { id: "map_note", name: "마을 지도 조각", quantity: 1 },
      { id: "wood", name: "나무 조각", quantity: 2 },
    ],
    availableLocations: ["마을 중심", "작은 풀밭", "동쪽 길목", "남쪽 공터", "북동쪽 작업터"],
    npcPositions: Object.fromEntries(
      npcs.map((npc) => [npc.npcId ?? npc.id, { x: npc.x, y: npc.y }])
    ),
  }
}
```

- [ ] **Step 4: 테스트 파일 전체 교체 (import 라인 업데이트)**

`tests/game-core/game-loop/world-dialogue.test.ts`를 다음으로 교체:

```typescript
import {
  DEFAULT_DIALOGUE_CHOICES,
  dialogueChoiceForKey,
  makeWorldDialogueGameState,
  normalizeCustomDialogueMessage,
  resolveWorldNPCProfile,
  WORLD_NPC_CHARACTER_PROMPTS,
} from "@/game-core/game-loop/world-dialogue"

describe("world dialogue helpers", () => {
  it("offers three numbered dialogue choices", () => {
    expect(DEFAULT_DIALOGUE_CHOICES.map((choice) => choice.id)).toEqual(["1", "2", "3"])
    expect(DEFAULT_DIALOGUE_CHOICES.every((choice) => choice.userMessage.length > 0)).toBe(true)
  })

  it("selects dialogue choices by keyboard number", () => {
    expect(dialogueChoiceForKey("1")?.id).toBe("1")
    expect(dialogueChoiceForKey("2")?.id).toBe("2")
    expect(dialogueChoiceForKey("3")?.id).toBe("3")
    expect(dialogueChoiceForKey("4")).toBeNull()
  })

  it("normalizes custom dialogue input", () => {
    expect(normalizeCustomDialogueMessage("  오늘 뭐 하고 있었어?  ")).toBe(
      "오늘 뭐 하고 있었어?"
    )
    expect(normalizeCustomDialogueMessage("   ")).toBeNull()
  })

  it("resolves a demo NPC profile while preserving the world npc id", () => {
    const profile = resolveWorldNPCProfile("npc_3")

    expect(profile.id).toBe("npc_3")
    expect(profile.name).toBeTruthy()
    expect(profile.personality.length).toBeGreaterThan(0)
  })

  it("builds the game state expected by the agent pipeline", () => {
    const state = makeWorldDialogueGameState([
      { id: "npc_1", npcId: "npc_1", x: 10, y: 11 },
      { id: "npc_2", npcId: "npc_2", x: 12, y: 13 },
    ])

    expect(state.clock).toEqual({ day: 1, currentMinute: 600 })
    expect(state.npcPositions).toEqual({
      npc_1: { x: 10, y: 11 },
      npc_2: { x: 12, y: 13 },
    })
  })
})

describe("new named world NPCs", () => {
  it("WORLD_NPC_CHARACTER_PROMPTS lists 9 named NPCs with characterPromptKey", () => {
    expect(WORLD_NPC_CHARACTER_PROMPTS).toHaveLength(9)
    const keys = WORLD_NPC_CHARACTER_PROMPTS.map((n) => n.characterPromptKey)
    expect(keys).toContain("npc_guard")
    expect(keys).toContain("npc_innkeeper")
    expect(keys).toContain("npc_sheep")
  })

  it("resolves npc_5 to guard blueprint with characterPromptKey", () => {
    const profile = resolveWorldNPCProfile("npc_5")
    expect(profile.characterPromptKey).toBe("npc_guard")
    expect(profile.name).toBe("경비대원 카엔")
  })

  it("resolves npc_13 to blacksmith2 blueprint", () => {
    const profile = resolveWorldNPCProfile("npc_13")
    expect(profile.characterPromptKey).toBe("npc_blacksmith2")
  })
})
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx jest tests/game-core/game-loop/world-dialogue.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/game-core/game-loop/world-dialogue.ts tests/game-core/game-loop/world-dialogue.test.ts
git commit -m "feat: add 9 new NPC blueprints and WORLD_NPC_CHARACTER_PROMPTS export"
```

---

## Task 4: 월드 스폰 포인트 9개 추가

**Files:**
- Modify: `src/game-core/map/random-terrain.ts`

- [ ] **Step 1: `npcOffsets` 배열에 9개 오프셋 추가**

`random-terrain.ts`의 `npcOffsets` 부분을 찾아 교체:

```typescript
  const npcOffsets: ReadonlyArray<readonly [number, number]> = [
    // 기존 4개
    [-5, -3],
    [5, 2],
    [-3, 5],
    [6, -4],
    // 신규 9개 (npc_5~13)
    [-8, 0],   // npc_5  경비대원 카엔
    [0, -8],   // npc_6  여관주인 마리
    [8, 8],    // npc_7  귀족 시릴
    [-2, 3],   // npc_8  행상인 탄
    [2, 8],    // npc_9  채소장수 나리
    [0, -5],   // npc_10 마을사람 베아
    [10, 0],   // npc_11 촌민 루카
    [-4, -4],  // npc_12 양 모모
    [7, -7],   // npc_13 대장장이 브렌
  ]
```

- [ ] **Step 2: 관련 테스트 통과 확인**

```bash
npx jest tests/game-core/map/random-terrain.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/game-core/map/random-terrain.ts
git commit -m "feat: add 9 new NPC spawn offsets to world terrain generation"
```

---

## Task 5: load-prompt.ts에 NPC 캐릭터 프롬프트 로더 추가

**Files:**
- Modify: `src/game-core/agent/prompts/load-prompt.ts`

- [ ] **Step 1: `loadNpcCharacterPromptDefault` 함수 추가**

`src/game-core/agent/prompts/load-prompt.ts`를 다음으로 교체:

```typescript
import fs from "fs"
import path from "path"

export function loadPrompt(filename: string): string {
  const promptPath = path.join(process.cwd(), "src/game-core/agent/prompts", filename)
  try {
    return fs.readFileSync(promptPath, "utf-8").trim()
  } catch (cause) {
    throw new Error(
      `프롬프트 파일 "${filename}"을 ${promptPath} 에서 읽지 못했습니다. ` +
        `배포 산출물에 이 파일이 포함되었는지 확인하세요 ` +
        `(next.config.ts의 outputFileTracingIncludes 참고). 원인: ${String(cause)}`
    )
  }
}

// NPC 캐릭터 프롬프트 파일 로드. 파일이 없으면 빈 문자열 반환 (에러 없음).
export function loadNpcCharacterPromptDefault(key: string): string {
  const promptPath = path.join(
    process.cwd(),
    "src/game-core/agent/prompts/npcs",
    `${key}.txt`
  )
  try {
    return fs.readFileSync(promptPath, "utf-8").trim()
  } catch {
    return ""
  }
}
```

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/game-core/agent/prompts/load-prompt.ts
git commit -m "feat: add loadNpcCharacterPromptDefault to prompt loader"
```

---

## Task 6: interactWithNPC에 characterPrompt 주입

**Files:**
- Modify: `src/game-core/agent/interact.ts`
- Test: `tests/game-core/agent/interact.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/game-core/agent/interact.test.ts`를 다음으로 교체 (기존 테스트 유지 + 새 테스트 추가):

```typescript
import { interactWithNPC } from "@/game-core/agent/interact"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"
import type { GameState } from "@/game-core/types/game"

jest.mock("langchain", () => ({
  createAgent: jest.fn().mockReturnValue({
    invoke: jest.fn().mockResolvedValue({
      messages: [{ content: "안녕! 오늘 날씨 좋다~" }],
    }),
  }),
}))
jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({})),
}))
jest.mock("@langchain/core/messages", () => ({
  HumanMessage: jest.fn().mockImplementation((content: string) => ({ content })),
  SystemMessage: jest.fn().mockImplementation((content: string) => ({ content })),
}))
jest.mock("@/game-core/agent/tools/validate-request", () => ({
  createValidateRequestTool: jest.fn().mockReturnValue({ name: "validate_request" }),
}))

const profile: NPCProfile = {
  id: "npc_1", name: "토끼", personality: ["친절함"], dislikeds: [],
  speechStyle: "반말", waypoints: [], habits: [],
}
const memory: NPCMemory = { npcId: "npc_1", conversationHistory: [], relationshipScore: 0 }
const gameState: GameState = {
  clock: { currentMinute: 60, day: 1 },
  availableItems: [], availableLocations: [], npcPositions: {},
}

it("일반 대화 응답과 memoryUpdate 반환", async () => {
  const result = await interactWithNPC({
    npcProfile: profile, npcMemory: memory,
    userMessage: "안녕!", gameState, gameTimestamp: 60,
  })
  expect(result.responseText).toBe("안녕! 오늘 날씨 좋다~")
  expect(result.memoryUpdate).toMatchObject({
    speaker: "npc", type: "chat",
    message: "안녕! 오늘 날씨 좋다~", timestamp: 60,
  })
  expect(result.decision).toBeUndefined()
})

it("characterPrompt가 시스템 메시지에 character_background 블록으로 주입됨", async () => {
  const { SystemMessage } = jest.requireMock("@langchain/core/messages") as {
    SystemMessage: jest.Mock
  }
  SystemMessage.mockClear()

  await interactWithNPC({
    npcProfile: profile, npcMemory: memory,
    userMessage: "안녕!", gameState, gameTimestamp: 60,
    characterPrompt: "당신은 용감한 기사입니다.",
  })

  expect(SystemMessage).toHaveBeenCalledWith(
    expect.stringContaining("<character_background>")
  )
  expect(SystemMessage).toHaveBeenCalledWith(
    expect.stringContaining("당신은 용감한 기사입니다.")
  )
})

it("characterPrompt가 없으면 character_background 블록이 없음", async () => {
  const { SystemMessage } = jest.requireMock("@langchain/core/messages") as {
    SystemMessage: jest.Mock
  }
  SystemMessage.mockClear()

  await interactWithNPC({
    npcProfile: profile, npcMemory: memory,
    userMessage: "안녕!", gameState, gameTimestamp: 60,
  })

  expect(SystemMessage).toHaveBeenCalledWith(
    expect.not.stringContaining("<character_background>")
  )
})
```

- [ ] **Step 2: 실패 확인**

```bash
npx jest tests/game-core/agent/interact.test.ts --no-coverage
```

Expected: 새 두 테스트 FAIL

- [ ] **Step 3: interact.ts 수정**

`src/game-core/agent/interact.ts`를 다음으로 교체:

```typescript
import { createAgent } from "langchain"
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { createValidateRequestTool, type RequestResult } from "@/game-core/agent/tools/validate-request"
import { loadPrompt } from "@/game-core/agent/prompts/load-prompt"
import type { PromptOverrides } from "@/game-core/agent/prompt-overrides"
import type { NPCProfile, NPCMemory, ConversationEntry } from "@/game-core/types/npc"
import type { GameState, NPCAction } from "@/game-core/types/game"

const interactTemplate = loadPrompt("interact.txt")

export type InteractResult = {
  responseText: string
  decision?: "ok" | "not_ok"
  action?: NPCAction
  memoryUpdate: ConversationEntry
}

export async function interactWithNPC(params: {
  npcProfile: NPCProfile
  npcMemory: NPCMemory
  userMessage: string
  gameState: GameState
  gameTimestamp: number
  promptOverrides?: PromptOverrides
  characterPrompt?: string
}): Promise<InteractResult> {
  const { npcProfile, npcMemory, userMessage, gameState, gameTimestamp, promptOverrides, characterPrompt } = params

  let requestResult: RequestResult | null = null as RequestResult | null

  const validateTool = createValidateRequestTool(
    npcProfile, npcMemory, gameState,
    (result) => { requestResult = result },
    promptOverrides
  )

  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.8,
  })

  const contextSize = parseInt(process.env.HISTORY_CONTEXT_SIZE ?? "10")
  const recentHistory = npcMemory.conversationHistory
    .slice(-contextSize)
    .map((e) => `${e.speaker === "user" ? "유저" : npcProfile.name}: ${e.message}`)
    .join("\n")

  const interactSource = promptOverrides?.interact ?? interactTemplate
  const systemPrompt = interactSource
    .replaceAll("{name}", npcProfile.name)
    .replaceAll("{personality}", npcProfile.personality.join(", "))
    .replaceAll("{speechStyle}", npcProfile.speechStyle)
    .replaceAll("{history}", recentHistory || "(없음)")

  const characterBg = characterPrompt?.trim()
  const worldKnowledge = promptOverrides?.worldKnowledge?.trim()

  const finalPrompt = [
    systemPrompt,
    characterBg ? `<character_background>\n${characterBg}\n</character_background>` : null,
    worldKnowledge ? `<worldKnowledge>\n${worldKnowledge}\n</worldKnowledge>` : null,
  ]
    .filter(Boolean)
    .join("\n\n")

  const agent = createAgent({ model, tools: [validateTool] })
  const agentResult = await agent.invoke({
    messages: [new SystemMessage(finalPrompt), new HumanMessage(userMessage)],
  })

  const lastMessage = agentResult.messages[agentResult.messages.length - 1]
  const responseText =
    requestResult !== null ? requestResult.responseText : String(lastMessage.content)

  const memoryUpdate: ConversationEntry = {
    timestamp: gameTimestamp,
    speaker: "npc",
    message: responseText,
    type: requestResult !== null ? "request" : "chat",
    decision: requestResult !== null ? requestResult.decision : undefined,
  }

  return {
    responseText,
    decision: requestResult !== null ? requestResult.decision : undefined,
    action: requestResult !== null ? requestResult.action : undefined,
    memoryUpdate,
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest tests/game-core/agent/interact.test.ts --no-coverage
```

Expected: 3개 모두 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/game-core/agent/interact.ts tests/game-core/agent/interact.test.ts
git commit -m "feat: inject characterPrompt as character_background block in NPC system prompt"
```

---

## Task 7: API 라우트 업데이트 (파일 로드 + 오버라이드)

**Files:**
- Modify: `src/app/api/agent/interact/route.ts`

- [ ] **Step 1: route.ts 수정**

`src/app/api/agent/interact/route.ts`를 다음으로 교체:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { interactWithNPC } from "@/game-core/agent/interact"
import { loadNpcCharacterPromptDefault } from "@/game-core/agent/prompts/load-prompt"
import type { PromptOverrides } from "@/game-core/agent/prompt-overrides"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"
import type { GameState } from "@/game-core/types/game"

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    npcProfile: NPCProfile
    npcMemory: NPCMemory
    userMessage: string
    gameState: GameState
    promptOverrides?: PromptOverrides
    characterPromptOverride?: string
  }

  const gameTimestamp =
    body.gameState.clock.currentMinute + body.gameState.clock.day * 1440

  const defaultCharacterPrompt = body.npcProfile.characterPromptKey
    ? loadNpcCharacterPromptDefault(body.npcProfile.characterPromptKey)
    : ""

  const characterPrompt = body.characterPromptOverride ?? defaultCharacterPrompt

  const result = await interactWithNPC({
    npcProfile: body.npcProfile,
    npcMemory: body.npcMemory,
    userMessage: body.userMessage,
    gameState: body.gameState,
    promptOverrides: body.promptOverrides,
    gameTimestamp,
    characterPrompt: characterPrompt || undefined,
  })
  return NextResponse.json(result)
}
```

- [ ] **Step 2: API 테스트 확인**

```bash
npx jest tests/app/api/agent/interact.test.ts --no-coverage
```

Expected: PASS (interactWithNPC mock은 그대로이므로 영향 없음)

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/agent/interact/route.ts
git commit -m "feat: load NPC character prompt file in interact API route"
```

---

## Task 8: /api/prompts/npc/[npcId] 라우트 생성

**Files:**
- Create: `src/app/api/prompts/npc/[npcId]/route.ts`

- [ ] **Step 1: 라우트 파일 생성**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { loadNpcCharacterPromptDefault } from "@/game-core/agent/prompts/load-prompt"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ npcId: string }> }
) {
  const { npcId } = await params
  const content = loadNpcCharacterPromptDefault(npcId)
  return NextResponse.json({ content })
}
```

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/prompts/npc/
git commit -m "feat: add GET /api/prompts/npc/[npcId] for studio default preview"
```

---

## Task 9: next.config.ts 파일 추적 업데이트

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: npcs/*.txt 경로 추가**

`next.config.ts`를 다음으로 교체:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/agent/interact": [
      "src/game-core/agent/prompts/**/*.txt",
    ],
    "/api/prompts/npc/[npcId]": [
      "src/game-core/agent/prompts/npcs/*.txt",
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: 커밋**

```bash
git add next.config.ts
git commit -m "chore: include npcs/*.txt in output file tracing"
```

---

## Task 10: npc-character-prompt-storage.ts 생성

**Files:**
- Create: `src/game-core/storage/npc-character-prompt-storage.ts`
- Create: `tests/game-core/storage/npc-character-prompt-storage.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/game-core/storage/npc-character-prompt-storage.test.ts` 생성:

```typescript
import {
  loadNpcCharacterPrompt,
  saveNpcCharacterPrompt,
  clearNpcCharacterPrompt,
} from "@/game-core/storage/npc-character-prompt-storage"

const mockStorage: Record<string, string> = {}

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k])
  global.localStorage = {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockStorage[k] = v },
    removeItem: (k: string) => { delete mockStorage[k] },
    clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]) },
    key: () => null,
    length: 0,
  } as Storage
})

describe("loadNpcCharacterPrompt", () => {
  it("저장된 값이 없으면 null 반환", () => {
    expect(loadNpcCharacterPrompt("npc_guard")).toBeNull()
  })

  it("저장된 오버라이드를 반환", () => {
    mockStorage["hometown:npc-character-prompt:npc_guard"] = "커스텀 프롬프트"
    expect(loadNpcCharacterPrompt("npc_guard")).toBe("커스텀 프롬프트")
  })
})

describe("saveNpcCharacterPrompt", () => {
  it("올바른 키로 localStorage에 저장됨", () => {
    saveNpcCharacterPrompt("npc_guard", "테스트 내용")
    expect(mockStorage["hometown:npc-character-prompt:npc_guard"]).toBe("테스트 내용")
  })
})

describe("clearNpcCharacterPrompt", () => {
  it("저장된 값 삭제", () => {
    mockStorage["hometown:npc-character-prompt:npc_guard"] = "삭제될 내용"
    clearNpcCharacterPrompt("npc_guard")
    expect(mockStorage["hometown:npc-character-prompt:npc_guard"]).toBeUndefined()
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npx jest tests/game-core/storage/npc-character-prompt-storage.test.ts --no-coverage
```

Expected: FAIL — 모듈 없음

- [ ] **Step 3: 스토리지 모듈 생성**

`src/game-core/storage/npc-character-prompt-storage.ts` 생성:

```typescript
const KEY = (npcId: string) => `hometown:npc-character-prompt:${npcId}`

export function loadNpcCharacterPrompt(npcId: string): string | null {
  if (typeof localStorage === "undefined") return null
  return localStorage.getItem(KEY(npcId))
}

export function saveNpcCharacterPrompt(npcId: string, prompt: string): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(KEY(npcId), prompt)
}

export function clearNpcCharacterPrompt(npcId: string): void {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(KEY(npcId))
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest tests/game-core/storage/npc-character-prompt-storage.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/game-core/storage/npc-character-prompt-storage.ts tests/game-core/storage/npc-character-prompt-storage.test.ts
git commit -m "feat: add NPC character prompt localStorage storage module"
```

---

## Task 11: 게임 월드 페이지에서 characterPromptOverride 전송

**Files:**
- Modify: `src/app/dev/world/page.tsx`

- [ ] **Step 1: import 추가 + API 호출 수정**

`src/app/dev/world/page.tsx`에서 import 섹션을 찾아 아래 import를 추가:

```typescript
import { loadNpcCharacterPrompt } from "@/game-core/storage/npc-character-prompt-storage"
```

그리고 `fetch("/api/agent/interact", ...)` 호출 부분에서 `body: JSON.stringify({...})` 안에 `characterPromptOverride` 필드를 추가:

기존:
```typescript
body: JSON.stringify({
  npcProfile: resolveWorldNPCProfile(npcId),
  npcMemory: loadNPCMemory(npcId),
  userMessage,
  gameState: WORLD_DIALOGUE_STATE,
  promptOverrides: loadPromptOverrides(),
}),
```

변경:
```typescript
const resolvedProfile = resolveWorldNPCProfile(npcId)
const characterPromptOverride = resolvedProfile.characterPromptKey
  ? loadNpcCharacterPrompt(resolvedProfile.characterPromptKey) ?? undefined
  : undefined

body: JSON.stringify({
  npcProfile: resolvedProfile,
  npcMemory: loadNPCMemory(npcId),
  userMessage,
  gameState: WORLD_DIALOGUE_STATE,
  promptOverrides: loadPromptOverrides(),
  characterPromptOverride,
}),
```

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/app/dev/world/page.tsx
git commit -m "feat: send NPC characterPromptOverride from localStorage to interact API"
```

---

## Task 12: Prompt Studio에 "NPC 프롬프트" 탭 추가

**Files:**
- Modify: `src/app/studio/page.tsx`

- [ ] **Step 1: `src/app/studio/page.tsx` 상단 import 추가**

파일 상단 import 섹션에 추가:

```typescript
import { WORLD_NPC_CHARACTER_PROMPTS } from "@/game-core/game-loop/world-dialogue"
import {
  loadNpcCharacterPrompt,
  saveNpcCharacterPrompt,
  clearNpcCharacterPrompt,
} from "@/game-core/storage/npc-character-prompt-storage"
```

- [ ] **Step 2: TabKey 타입에 "npcs" 추가**

기존:
```typescript
type TabKey = "interact" | "pipeline" | "world" | "settings"
```
변경:
```typescript
type TabKey = "interact" | "pipeline" | "world" | "npcs" | "settings"
```

- [ ] **Step 3: TABS 배열에 NPC 탭 추가**

기존:
```typescript
const TABS: { key: TabKey; label: string }[] = [
  { key: "interact", label: "응답 프롬프트" },
  { key: "pipeline", label: "검증 파이프라인" },
  { key: "world", label: "세계지식" },
  { key: "settings", label: "설정" },
]
```
변경:
```typescript
const TABS: { key: TabKey; label: string }[] = [
  { key: "interact", label: "응답 프롬프트" },
  { key: "pipeline", label: "검증 파이프라인" },
  { key: "world", label: "세계지식" },
  { key: "npcs", label: "NPC 프롬프트" },
  { key: "settings", label: "설정" },
]
```

- [ ] **Step 4: NPC 탭 관련 state 추가**

`StudioPage` 함수 내 기존 state 선언들 아래에 추가:

```typescript
const [selectedNpcKey, setSelectedNpcKey] = useState<string>(
  WORLD_NPC_CHARACTER_PROMPTS[0]?.characterPromptKey ?? ""
)
const [npcDefaults, setNpcDefaults] = useState<Record<string, string>>({})
const [npcDrafts, setNpcDrafts] = useState<Record<string, string>>({})
const [npcSaved, setNpcSaved] = useState<Record<string, string>>({})
```

- [ ] **Step 5: NPC 기본값 로딩 useEffect 추가**

기존 `/api/prompts` fetch useEffect 아래에 추가:

```typescript
useEffect(() => {
  const entries = WORLD_NPC_CHARACTER_PROMPTS
  if (entries.length === 0) return

  Promise.all(
    entries.map((entry) =>
      fetch(`/api/prompts/npc/${entry.characterPromptKey}`)
        .then((res) => res.json() as Promise<{ content: string }>)
        .then((data) => ({ key: entry.characterPromptKey, content: data.content }))
        .catch(() => ({ key: entry.characterPromptKey, content: "" }))
    )
  ).then((results) => {
    const defaults: Record<string, string> = {}
    const saved: Record<string, string> = {}
    const drafts: Record<string, string> = {}
    for (const { key, content } of results) {
      defaults[key] = content
      const override = loadNpcCharacterPrompt(key)
      saved[key] = override ?? content
      drafts[key] = override ?? content
    }
    setNpcDefaults(defaults)
    setNpcSaved(saved)
    setNpcDrafts(drafts)
  })
}, [])
```

- [ ] **Step 6: NPC 탭 핸들러 추가**

`handleClearHistory` useCallback 아래에 추가:

```typescript
const handleNpcSave = useCallback(
  (key: string) => {
    const value = npcDrafts[key] ?? ""
    saveNpcCharacterPrompt(key, value)
    setNpcSaved((prev) => ({ ...prev, [key]: value }))
  },
  [npcDrafts]
)

const handleNpcReset = useCallback(
  (key: string) => {
    const defaultValue = npcDefaults[key] ?? ""
    clearNpcCharacterPrompt(key)
    setNpcDrafts((prev) => ({ ...prev, [key]: defaultValue }))
    setNpcSaved((prev) => ({ ...prev, [key]: defaultValue }))
  },
  [npcDefaults]
)
```

- [ ] **Step 7: NPC 탭 콘텐츠 추가**

`tabBody` 내에서 `{defaults && tab === "settings" && (` 블록 바로 앞에 추가:

```typescript
{tab === "npcs" && (
  <div style={styles.npcTab}>
    <div style={styles.npcList}>
      {WORLD_NPC_CHARACTER_PROMPTS.map((entry) => {
        const isSelected = entry.characterPromptKey === selectedNpcKey
        const isOverridden = npcSaved[entry.characterPromptKey] !== npcDefaults[entry.characterPromptKey]
        return (
          <button
            key={entry.characterPromptKey}
            onClick={() => setSelectedNpcKey(entry.characterPromptKey)}
            style={{
              ...styles.npcListItem,
              ...(isSelected ? styles.npcListItemActive : {}),
            }}
          >
            <span style={styles.npcListName}>{entry.name}</span>
            {isOverridden && <span style={styles.flagOverride}>수정됨</span>}
          </button>
        )
      })}
    </div>
    <div style={styles.npcEditor}>
      {selectedNpcKey && (
        <NpcCharacterEditor
          npcKey={selectedNpcKey}
          npcName={
            WORLD_NPC_CHARACTER_PROMPTS.find(
              (e) => e.characterPromptKey === selectedNpcKey
            )?.name ?? selectedNpcKey
          }
          draft={npcDrafts[selectedNpcKey] ?? ""}
          saved={npcSaved[selectedNpcKey] ?? ""}
          defaultValue={npcDefaults[selectedNpcKey] ?? ""}
          onChange={(v) =>
            setNpcDrafts((prev) => ({ ...prev, [selectedNpcKey]: v }))
          }
          onSave={() => handleNpcSave(selectedNpcKey)}
          onReset={() => handleNpcReset(selectedNpcKey)}
        />
      )}
    </div>
  </div>
)}
```

- [ ] **Step 8: NpcCharacterEditor 컴포넌트 추가**

파일 맨 아래 `PromptEditor` 함수 아래에 추가:

```typescript
function NpcCharacterEditor(props: {
  npcKey: string
  npcName: string
  draft: string
  saved: string
  defaultValue: string
  onChange: (value: string) => void
  onSave: () => void
  onReset: () => void
}) {
  const { npcName, draft, saved, defaultValue, onChange, onSave, onReset } = props
  const dirty = draft !== saved
  const overridden = saved !== defaultValue

  return (
    <div style={styles.editor}>
      <div style={styles.editorHead}>
        <div>
          <h3 style={styles.editorTitle}>{npcName}</h3>
          <p style={styles.editorHint}>
            이 NPC만의 배경·설정·성격을 자유롭게 작성하세요. 응답 프롬프트에 캐릭터 컨텍스트로 주입됩니다.
          </p>
        </div>
        <div style={styles.editorFlags}>
          {dirty && <span style={styles.flagDirty}>저장 안 됨</span>}
          {overridden && <span style={styles.flagOverride}>수정됨</span>}
        </div>
      </div>
      <textarea
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        style={{ ...styles.textarea, minHeight: 280 }}
        placeholder="당신은 [이름]입니다. 배경, 성격, 습관 등을 자유롭게 작성하세요."
      />
      <div style={styles.btnRow}>
        <button onClick={onSave} disabled={!dirty} style={styles.primaryBtn}>
          저장
        </button>
        <button onClick={onReset} style={styles.ghostBtn}>
          원본으로 리셋
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: 스타일 추가**

`styles` 객체에 추가:

```typescript
  npcTab: {
    display: "flex",
    gap: 12,
    height: "100%",
  },
  npcList: {
    width: 180,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    overflowY: "auto" as const,
  },
  npcListItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 10px",
    background: "transparent",
    color: "#8b8f9c",
    border: "1px solid transparent",
    borderRadius: 6,
    cursor: "pointer",
    textAlign: "left" as const,
    fontSize: 12,
    gap: 6,
  },
  npcListItemActive: {
    background: "#171a22",
    color: "#e6e6ea",
    border: "1px solid #2a2d36",
  },
  npcListName: {
    flex: 1,
  },
  npcEditor: {
    flex: 1,
    minWidth: 0,
  },
```

- [ ] **Step 10: TypeScript 컴파일 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 11: 전체 테스트 통과 확인**

```bash
npx jest --no-coverage
```

Expected: 모든 테스트 PASS

- [ ] **Step 12: 커밋**

```bash
git add src/app/studio/page.tsx
git commit -m "feat: add NPC 프롬프트 tab to Prompt Studio for per-NPC character prompt editing"
```

---

## Task 13: 최종 통합 확인 및 PR

- [ ] **Step 1: 전체 테스트 통과 확인**

```bash
npx jest --no-coverage
```

Expected: 모든 테스트 PASS

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: PR 생성**

```bash
git push origin claude/jovial-tesla-81d117
gh pr create \
  --title "feat: register 9 new NPCs with per-NPC character prompt system" \
  --body "$(cat <<'EOF'
## Summary
- Adds 9 new NPC characters (guard, innkeeper, noble, street-vendor, vegetable-vendor, townsfolk, villager, sheep, blacksmith2) to the game world
- Each NPC has its own character prompt `.txt` file in `src/game-core/agent/prompts/npcs/`
- Character prompts are injected as `<character_background>` into the NPC system prompt at runtime
- Prompt Studio gains a new "NPC 프롬프트" tab with NPC list + per-NPC editor backed by localStorage overrides
- Server always reads the default `.txt` file; client overrides take precedence when set

## Test plan
- [ ] Run `npx jest --no-coverage` — all pass
- [ ] Open `/studio`, click "NPC 프롬프트" tab — NPC list appears
- [ ] Select a NPC, edit prompt, save — localStorage stores override
- [ ] Reset — reverts to `.txt` file default
- [ ] Open `/dev/world`, interact with npc_5 (경비대원 카엔) — character background is in effect

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
