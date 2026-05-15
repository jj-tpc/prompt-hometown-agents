# Agent Core System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js 기반 Agent 코어 시스템 구현 — `/api/agent/interact` 엔드포인트로 NPC가 유저 메시지를 받아 대화하거나, 3-Step 검증 파이프라인(ValidateChain → PersonalityChain → DecisionChain)을 통해 OK/NOT OK를 판단하고 게임 액션을 반환

**Architecture:** LangChain.js `AgentExecutor`가 `validate_request` 툴을 장착. 일반 대화는 LLM 1회 호출, 구체적 요청은 툴을 통해 최대 OpenAI API 3회 순차 호출. NPC 메모리는 클라이언트 LocalStorage에 저장되며 API 호출 시 body로 전달됨. `game:` 네임스페이스로 다른 LocalStorage 데이터와 격리.

**Tech Stack:** Next.js 15 (App Router), `langchain`, `@langchain/openai`, `@langchain/core`, Zod, Jest + ts-jest

---

## File Structure

```
src/
  game-core/
    types/
      npc.ts                — NPCProfile, NPCMemory, ConversationEntry
      game.ts               — GameState, GameClock, NPCAction, QueuedAction
    storage/
      npc-memory.ts         — LocalStorage: NPC 메모리 read/write/append
      game-clock.ts         — LocalStorage: GameClock read/write
      reset.ts              — LocalStorage: game: prefix 전체 삭제
    agent/
      chains/
        validate-chain.ts       — Step 1: 게임 세계 유효성 검사
        personality-chain.ts    — Step 2: NPC 성격/히스토리 충돌 검사
        decision-chain.ts       — Step 3: 최종 응답 + 액션 결정
      tools/
        validate-request.ts     — validate_request 툴 (3-Step 실행 + onResult 콜백)
      interact.ts               — AgentExecutor 조립 + 응답 가공
  app/
    api/
      agent/
        interact/
          route.ts          — POST /api/agent/interact

tests/
  game-core/
    storage/
      npc-memory.test.ts
      reset.test.ts
    agent/
      chains/
        validate-chain.test.ts
        personality-chain.test.ts
        decision-chain.test.ts
      tools/
        validate-request.test.ts
      interact.test.ts
  app/
    api/
      agent/
        interact.test.ts
```

---

### Task 0: Next.js 프로젝트 초기화 및 의존성 설치

**Files:**
- Create: `package.json` (자동 생성)
- Create: `.env.local`
- Create: `jest.config.ts`

- [ ] **Step 1: Next.js 프로젝트 초기화**

현재 디렉토리(`prompt-hometown-agents`)에서 실행. 대화형 프롬프트가 나오면 모두 기본값으로 진행(TypeScript: Yes, ESLint: Yes, App Router: Yes, src/ directory: Yes, `@/*` alias: Yes):

```powershell
npx create-next-app@latest . --typescript --eslint --app --src-dir --import-alias "@/*" --no-tailwind --no-turbopack
```

- [ ] **Step 2: LangChain.js 및 OpenAI 의존성 설치**

```powershell
npm install langchain @langchain/openai @langchain/core zod
```

- [ ] **Step 3: Jest 테스트 환경 설치**

```powershell
npm install -D jest ts-jest @types/jest
```

- [ ] **Step 4: jest.config.ts 생성**

`jest.config.ts`:
```ts
import type { Config } from "jest"

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["**/tests/**/*.test.ts"],
}

export default config
```

- [ ] **Step 5: package.json 의 scripts 에 test 추가**

`package.json` 의 `"scripts"` 안에 아래 두 줄 추가:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 6: .env.local 생성**

`.env.local`:
```
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=gpt-4o-mini
HISTORY_CONTEXT_SIZE=10
```

- [ ] **Step 7: 빌드 확인**

```powershell
npm run build
```
Expected: `✓ Compiled successfully`

- [ ] **Step 8: 커밋**

```bash
git add .
git commit -m "chore: initialize Next.js project with LangChain.js and Jest"
```

---

### Task 1: Core Type Definitions

**Files:**
- Create: `src/game-core/types/npc.ts`
- Create: `src/game-core/types/game.ts`

- [ ] **Step 1: NPC 타입 정의**

`src/game-core/types/npc.ts`:
```ts
export type NPCProfile = {
  id: string
  name: string
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

- [ ] **Step 2: 게임 상태 타입 정의**

`src/game-core/types/game.ts`:
```ts
export type GameClock = {
  currentMinute: number
  day: number
}

export type GameState = {
  clock: GameClock
  availableItems: { id: string; name: string; quantity: number }[]
  availableLocations: string[]
  npcPositions: Record<string, { x: number; y: number }>
}

export type NPCAction =
  | { type: "give_item"; itemId: string; quantity: number }
  | { type: "move_to"; targetNpcId: string }

export type QueuedAction =
  | { source: "request"; action: NPCAction }
  | { source: "habit"; habitAction: string }
```

- [ ] **Step 3: 커밋**

```bash
git add src/game-core/types/
git commit -m "feat(game-core): add NPC and game state type definitions"
```

---

### Task 2: LocalStorage 유틸리티

**Files:**
- Create: `src/game-core/storage/npc-memory.ts`
- Create: `src/game-core/storage/game-clock.ts`
- Create: `src/game-core/storage/reset.ts`
- Test: `tests/game-core/storage/npc-memory.test.ts`
- Test: `tests/game-core/storage/reset.test.ts`

- [ ] **Step 1: npc-memory.test.ts 작성**

`tests/game-core/storage/npc-memory.test.ts`:
```ts
import { loadNPCMemory, saveNPCMemory, appendConversationEntry } from "@/game-core/storage/npc-memory"
import type { ConversationEntry } from "@/game-core/types/npc"

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

describe("loadNPCMemory", () => {
  it("존재하지 않는 NPC는 기본 메모리 반환", () => {
    const memory = loadNPCMemory("npc_1")
    expect(memory).toEqual({ npcId: "npc_1", conversationHistory: [], relationshipScore: 0 })
  })

  it("저장된 메모리를 올바르게 불러옴", () => {
    const data = { npcId: "npc_1", conversationHistory: [], relationshipScore: 5 }
    mockStorage["game:npc:npc_1:memory"] = JSON.stringify(data)
    expect(loadNPCMemory("npc_1")).toEqual(data)
  })
})

describe("saveNPCMemory", () => {
  it("game: 네임스페이스 키로 저장됨", () => {
    saveNPCMemory({ npcId: "npc_1", conversationHistory: [], relationshipScore: 0 })
    expect(mockStorage["game:npc:npc_1:memory"]).toBeDefined()
  })
})

describe("appendConversationEntry", () => {
  it("기존 히스토리에 항목이 추가됨", () => {
    saveNPCMemory({ npcId: "npc_1", conversationHistory: [], relationshipScore: 0 })
    const entry: ConversationEntry = { timestamp: 60, speaker: "user", message: "안녕", type: "chat" }
    appendConversationEntry("npc_1", entry)
    const memory = loadNPCMemory("npc_1")
    expect(memory.conversationHistory).toHaveLength(1)
    expect(memory.conversationHistory[0]).toEqual(entry)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```powershell
npx jest tests/game-core/storage/npc-memory.test.ts --no-coverage
```
Expected: FAIL (Cannot find module)

- [ ] **Step 3: npc-memory.ts 구현**

`src/game-core/storage/npc-memory.ts`:
```ts
import type { NPCMemory, ConversationEntry } from "@/game-core/types/npc"

const NAMESPACE = "game:"

function storageKey(npcId: string) {
  return `${NAMESPACE}npc:${npcId}:memory`
}

function defaultMemory(npcId: string): NPCMemory {
  return { npcId, conversationHistory: [], relationshipScore: 0 }
}

export function loadNPCMemory(npcId: string): NPCMemory {
  if (typeof window === "undefined") return defaultMemory(npcId)
  const raw = localStorage.getItem(storageKey(npcId))
  if (!raw) return defaultMemory(npcId)
  return JSON.parse(raw) as NPCMemory
}

export function saveNPCMemory(memory: NPCMemory): void {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey(memory.npcId), JSON.stringify(memory))
}

export function appendConversationEntry(npcId: string, entry: ConversationEntry): void {
  const memory = loadNPCMemory(npcId)
  memory.conversationHistory.push(entry)
  saveNPCMemory(memory)
}
```

- [ ] **Step 4: 테스트 통과 확인**

```powershell
npx jest tests/game-core/storage/npc-memory.test.ts --no-coverage
```
Expected: PASS (4 tests)

- [ ] **Step 5: reset.test.ts 작성**

`tests/game-core/storage/reset.test.ts`:
```ts
import { resetGameData } from "@/game-core/storage/reset"

const mockStorage: Record<string, string> = {}

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k])
  global.localStorage = {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockStorage[k] = v },
    removeItem: (k: string) => { delete mockStorage[k] },
    clear: () => {},
    key: (i: number) => Object.keys(mockStorage)[i] ?? null,
    get length() { return Object.keys(mockStorage).length },
  } as Storage
})

it("game: prefix 키만 삭제, 다른 키는 보존", () => {
  mockStorage["game:npc:npc_1:memory"] = "{}"
  mockStorage["game:clock"] = "{}"
  mockStorage["other-app:data"] = "keep-me"

  resetGameData()

  expect(mockStorage["game:npc:npc_1:memory"]).toBeUndefined()
  expect(mockStorage["game:clock"]).toBeUndefined()
  expect(mockStorage["other-app:data"]).toBe("keep-me")
})
```

- [ ] **Step 6: reset.ts 구현**

`src/game-core/storage/reset.ts`:
```ts
export function resetGameData(): void {
  if (typeof window === "undefined") return
  const keysToRemove = Object.keys(localStorage).filter((k) => k.startsWith("game:"))
  keysToRemove.forEach((k) => localStorage.removeItem(k))
}
```

- [ ] **Step 7: game-clock.ts 구현**

`src/game-core/storage/game-clock.ts`:
```ts
import type { GameClock } from "@/game-core/types/game"

const CLOCK_KEY = "game:clock"

function defaultClock(): GameClock {
  return { currentMinute: 0, day: 1 }
}

export function loadGameClock(): GameClock {
  if (typeof window === "undefined") return defaultClock()
  const raw = localStorage.getItem(CLOCK_KEY)
  if (!raw) return defaultClock()
  return JSON.parse(raw) as GameClock
}

export function saveGameClock(clock: GameClock): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CLOCK_KEY, JSON.stringify(clock))
}
```

- [ ] **Step 8: 전체 storage 테스트 통과 확인**

```powershell
npx jest tests/game-core/storage/ --no-coverage
```
Expected: PASS (5 tests)

- [ ] **Step 9: 커밋**

```bash
git add src/game-core/storage/ tests/game-core/storage/
git commit -m "feat(game-core): add LocalStorage utilities for NPC memory, clock, and reset"
```

---

### Task 3: ValidateChain (Step 1)

**Files:**
- Create: `src/game-core/agent/chains/validate-chain.ts`
- Test: `tests/game-core/agent/chains/validate-chain.test.ts`

- [ ] **Step 1: validate-chain.test.ts 작성**

`tests/game-core/agent/chains/validate-chain.test.ts`:
```ts
import { runValidateChain } from "@/game-core/agent/chains/validate-chain"
import type { GameState } from "@/game-core/types/game"

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    withStructuredOutput: jest.fn().mockReturnValue({
      invoke: jest.fn().mockResolvedValue({ valid: true, reason: "낚시터는 존재하는 장소입니다." }),
    }),
  })),
}))

const gameState: GameState = {
  clock: { currentMinute: 420, day: 1 },
  availableItems: [{ id: "fish_rod", name: "낚싯대", quantity: 1 }],
  availableLocations: ["낚시터", "광장", "마을 입구"],
  npcPositions: { npc_1: { x: 5, y: 5 } },
}

it("유효한 요청에 valid: true 반환", async () => {
  const result = await runValidateChain("낚시터에 가줘", gameState)
  expect(result.valid).toBe(true)
  expect(result.reason).toBeTruthy()
})
```

- [ ] **Step 2: 테스트 실패 확인**

```powershell
npx jest tests/game-core/agent/chains/validate-chain.test.ts --no-coverage
```
Expected: FAIL (Cannot find module)

- [ ] **Step 3: validate-chain.ts 구현**

`src/game-core/agent/chains/validate-chain.ts`:
```ts
import { ChatOpenAI } from "@langchain/openai"
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import type { GameState } from "@/game-core/types/game"

const schema = z.object({
  valid: z.boolean(),
  reason: z.string(),
})

const systemTemplate = `You are validating whether a user's request to an NPC is physically possible in the game world.

Available locations: {locations}
Available items: {items}
Current game time: Day {day}, {hour}:{minute}

Respond in Korean. Determine only whether the request is possible given the game world constraints.`

export async function runValidateChain(
  userRequest: string,
  gameState: GameState
): Promise<{ valid: boolean; reason: string }> {
  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0,
  }).withStructuredOutput(schema)

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemTemplate],
    ["human", "{userRequest}"],
  ])

  const chain = prompt.pipe(model)
  const hour = Math.floor(gameState.clock.currentMinute / 60)
  const minute = gameState.clock.currentMinute % 60

  return chain.invoke({
    locations: gameState.availableLocations.join(", "),
    items: gameState.availableItems.map((i) => `${i.name}(${i.quantity}개)`).join(", "),
    day: gameState.clock.day,
    hour: String(hour).padStart(2, "0"),
    minute: String(minute).padStart(2, "0"),
    userRequest,
  })
}
```

- [ ] **Step 4: 테스트 통과 확인**

```powershell
npx jest tests/game-core/agent/chains/validate-chain.test.ts --no-coverage
```
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/game-core/agent/chains/validate-chain.ts tests/game-core/agent/chains/validate-chain.test.ts
git commit -m "feat(game-core): add ValidateChain (Step 1 of request pipeline)"
```

---

### Task 4: PersonalityChain (Step 2)

**Files:**
- Create: `src/game-core/agent/chains/personality-chain.ts`
- Test: `tests/game-core/agent/chains/personality-chain.test.ts`

- [ ] **Step 1: personality-chain.test.ts 작성**

`tests/game-core/agent/chains/personality-chain.test.ts`:
```ts
import { runPersonalityChain } from "@/game-core/agent/chains/personality-chain"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    withStructuredOutput: jest.fn().mockReturnValue({
      invoke: jest.fn().mockResolvedValue({ compatible: false, reason: "겁쟁이라서 위험한 곳은 싫어해요." }),
    }),
  })),
}))

const profile: NPCProfile = {
  id: "npc_1",
  name: "토끼",
  personality: ["겁쟁이", "친절함"],
  dislikeds: ["위험한 장소"],
  speechStyle: "반말, 수줍음",
  waypoints: [{ x: 5, y: 5, label: "낚시터" }],
  habits: [{ action: "낚시", location: "낚시터", gameHour: 7, duration: 60 }],
}

const memory: NPCMemory = {
  npcId: "npc_1",
  conversationHistory: [],
  relationshipScore: 10,
}

it("성격과 충돌하는 요청에 compatible: false 반환", async () => {
  const result = await runPersonalityChain("위험한 숲에 가줘", profile, memory)
  expect(result.compatible).toBe(false)
  expect(result.reason).toBeTruthy()
})
```

- [ ] **Step 2: 테스트 실패 확인**

```powershell
npx jest tests/game-core/agent/chains/personality-chain.test.ts --no-coverage
```
Expected: FAIL (Cannot find module)

- [ ] **Step 3: personality-chain.ts 구현**

`src/game-core/agent/chains/personality-chain.ts`:
```ts
import { ChatOpenAI } from "@langchain/openai"
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"

const schema = z.object({
  compatible: z.boolean(),
  reason: z.string(),
})

const systemTemplate = `You are evaluating whether a request is compatible with this NPC's personality and history.

NPC Name: {name}
Personality: {personality}
Dislikes: {dislikeds}
Habits: {habits}
Relationship score with user: {relationshipScore}

Recent conversation history:
{history}

Respond in Korean. Determine if the request conflicts with the NPC's character or past interactions.`

export async function runPersonalityChain(
  userRequest: string,
  profile: NPCProfile,
  memory: NPCMemory
): Promise<{ compatible: boolean; reason: string }> {
  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0,
  }).withStructuredOutput(schema)

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemTemplate],
    ["human", "{userRequest}"],
  ])

  const chain = prompt.pipe(model)
  const contextSize = parseInt(process.env.HISTORY_CONTEXT_SIZE ?? "10")
  const recentHistory = memory.conversationHistory
    .slice(-contextSize)
    .map((e) => `[${e.speaker}] ${e.message}${e.decision ? ` (${e.decision})` : ""}`)
    .join("\n")

  return chain.invoke({
    name: profile.name,
    personality: profile.personality.join(", "),
    dislikeds: profile.dislikeds.join(", "),
    habits: profile.habits
      .map((h) => `${h.action} at ${h.location} around ${h.gameHour}:00`)
      .join(", "),
    relationshipScore: memory.relationshipScore,
    history: recentHistory || "(없음)",
    userRequest,
  })
}
```

- [ ] **Step 4: 테스트 통과 확인**

```powershell
npx jest tests/game-core/agent/chains/personality-chain.test.ts --no-coverage
```
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/game-core/agent/chains/personality-chain.ts tests/game-core/agent/chains/personality-chain.test.ts
git commit -m "feat(game-core): add PersonalityChain (Step 2 of request pipeline)"
```

---

### Task 5: DecisionChain (Step 3)

**Files:**
- Create: `src/game-core/agent/chains/decision-chain.ts`
- Test: `tests/game-core/agent/chains/decision-chain.test.ts`

- [ ] **Step 1: decision-chain.test.ts 작성**

`tests/game-core/agent/chains/decision-chain.test.ts`:
```ts
import { runDecisionChain } from "@/game-core/agent/chains/decision-chain"
import type { NPCProfile } from "@/game-core/types/npc"

const mockInvoke = jest.fn()

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    withStructuredOutput: jest.fn().mockReturnValue({ invoke: mockInvoke }),
  })),
}))

const profile: NPCProfile = {
  id: "npc_1",
  name: "토끼",
  personality: ["겁쟁이"],
  dislikeds: ["위험한 장소"],
  speechStyle: "반말, 수줍음",
  waypoints: [],
  habits: [],
}

it("not_ok 결정 시 action 없이 반환", async () => {
  mockInvoke.mockResolvedValueOnce({ decision: "not_ok", responseText: "무서워서 못 가겠어...", action: null })
  const result = await runDecisionChain(
    "위험한 숲에 가줘",
    profile,
    { valid: true, reason: "장소는 존재함" },
    { compatible: false, reason: "겁쟁이라서 위험한 곳 싫어함" }
  )
  expect(result.decision).toBe("not_ok")
  expect(result.responseText).toBeTruthy()
  expect(result.action).toBeUndefined()
})

it("ok 결정 시 give_item action 반환", async () => {
  mockInvoke.mockResolvedValueOnce({
    decision: "ok",
    responseText: "알겠어, 가져다줄게!",
    action: { type: "give_item", itemId: "fish_rod", quantity: 1 },
  })
  const result = await runDecisionChain(
    "낚싯대 줘",
    profile,
    { valid: true, reason: "아이템 존재함" },
    { compatible: true, reason: "친절한 성격이라 OK" }
  )
  expect(result.decision).toBe("ok")
  expect(result.action).toEqual({ type: "give_item", itemId: "fish_rod", quantity: 1 })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```powershell
npx jest tests/game-core/agent/chains/decision-chain.test.ts --no-coverage
```
Expected: FAIL (Cannot find module)

- [ ] **Step 3: decision-chain.ts 구현**

`src/game-core/agent/chains/decision-chain.ts`:
```ts
import { ChatOpenAI } from "@langchain/openai"
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import type { NPCProfile } from "@/game-core/types/npc"
import type { NPCAction } from "@/game-core/types/game"

const schema = z.object({
  decision: z.enum(["ok", "not_ok"]),
  responseText: z.string(),
  action: z
    .union([
      z.object({ type: z.literal("give_item"), itemId: z.string(), quantity: z.number() }),
      z.object({ type: z.literal("move_to"), targetNpcId: z.string() }),
      z.null(),
    ])
    .nullable()
    .optional(),
})

const systemTemplate = `You are generating a response for an NPC in a game.

NPC Name: {name}
Speech style: {speechStyle}
Personality: {personality}

Validation result: {validateResult}
Personality check result: {personalityResult}

Decide if the NPC accepts (ok) or declines (not_ok) the request.
Write responseText in Korean using the NPC's speech style.
If decision is ok and the request involves giving an item, include action with type "give_item".
If decision is ok and the request involves going to meet another NPC, include action with type "move_to".
Otherwise omit or set action to null.`

export async function runDecisionChain(
  userRequest: string,
  profile: NPCProfile,
  validateResult: { valid: boolean; reason: string },
  personalityResult: { compatible: boolean; reason: string }
): Promise<{ decision: "ok" | "not_ok"; responseText: string; action?: NPCAction }> {
  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.7,
  }).withStructuredOutput(schema)

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemTemplate],
    ["human", "{userRequest}"],
  ])

  const chain = prompt.pipe(model)
  const raw = await chain.invoke({
    name: profile.name,
    speechStyle: profile.speechStyle,
    personality: profile.personality.join(", "),
    validateResult: `valid=${validateResult.valid}, reason: ${validateResult.reason}`,
    personalityResult: `compatible=${personalityResult.compatible}, reason: ${personalityResult.reason}`,
    userRequest,
  })

  return {
    decision: raw.decision,
    responseText: raw.responseText,
    action: raw.action ?? undefined,
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```powershell
npx jest tests/game-core/agent/chains/decision-chain.test.ts --no-coverage
```
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/game-core/agent/chains/decision-chain.ts tests/game-core/agent/chains/decision-chain.test.ts
git commit -m "feat(game-core): add DecisionChain (Step 3 of request pipeline)"
```

---

### Task 6: validate_request 툴 + Interact Handler

**Files:**
- Create: `src/game-core/agent/tools/validate-request.ts`
- Create: `src/game-core/agent/interact.ts`
- Test: `tests/game-core/agent/tools/validate-request.test.ts`
- Test: `tests/game-core/agent/interact.test.ts`

- [ ] **Step 1: validate-request.test.ts 작성**

`tests/game-core/agent/tools/validate-request.test.ts`:
```ts
import { createValidateRequestTool } from "@/game-core/agent/tools/validate-request"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"
import type { GameState } from "@/game-core/types/game"

jest.mock("@/game-core/agent/chains/validate-chain", () => ({
  runValidateChain: jest.fn().mockResolvedValue({ valid: false, reason: "장소가 없음" }),
}))
jest.mock("@/game-core/agent/chains/personality-chain", () => ({
  runPersonalityChain: jest.fn(),
}))
jest.mock("@/game-core/agent/chains/decision-chain", () => ({
  runDecisionChain: jest.fn().mockResolvedValue({
    decision: "not_ok",
    responseText: "그런 곳은 없는걸...",
    action: undefined,
  }),
}))

const profile: NPCProfile = {
  id: "npc_1", name: "토끼", personality: ["친절함"], dislikeds: [],
  speechStyle: "반말", waypoints: [], habits: [],
}
const memory: NPCMemory = { npcId: "npc_1", conversationHistory: [], relationshipScore: 0 }
const gameState: GameState = {
  clock: { currentMinute: 0, day: 1 },
  availableItems: [], availableLocations: ["광장"], npcPositions: {},
}

it("Step 1 실패 시 Step 2를 건너뛰고 결과 반환", async () => {
  const { runPersonalityChain } = jest.requireMock("@/game-core/agent/chains/personality-chain")
  let capturedResult: unknown
  const tool = createValidateRequestTool(profile, memory, gameState, (r) => { capturedResult = r })

  await tool.invoke({ userRequest: "없는 곳에 가줘" })

  expect(runPersonalityChain).not.toHaveBeenCalled()
  expect(capturedResult).toMatchObject({ decision: "not_ok" })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```powershell
npx jest tests/game-core/agent/tools/validate-request.test.ts --no-coverage
```
Expected: FAIL (Cannot find module)

- [ ] **Step 3: validate-request.ts 구현**

`src/game-core/agent/tools/validate-request.ts`:
```ts
import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { runValidateChain } from "@/game-core/agent/chains/validate-chain"
import { runPersonalityChain } from "@/game-core/agent/chains/personality-chain"
import { runDecisionChain } from "@/game-core/agent/chains/decision-chain"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"
import type { GameState, NPCAction } from "@/game-core/types/game"

export type RequestResult = {
  decision: "ok" | "not_ok"
  responseText: string
  action?: NPCAction
}

export function createValidateRequestTool(
  profile: NPCProfile,
  memory: NPCMemory,
  gameState: GameState,
  onResult: (result: RequestResult) => void
) {
  return tool(
    async ({ userRequest }: { userRequest: string }) => {
      const validateResult = await runValidateChain(userRequest, gameState)

      if (!validateResult.valid) {
        const decisionResult = await runDecisionChain(userRequest, profile, validateResult, {
          compatible: false,
          reason: "유효하지 않은 요청",
        })
        onResult(decisionResult)
        return JSON.stringify(decisionResult)
      }

      const personalityResult = await runPersonalityChain(userRequest, profile, memory)
      const decisionResult = await runDecisionChain(userRequest, profile, validateResult, personalityResult)
      onResult(decisionResult)
      return JSON.stringify(decisionResult)
    },
    {
      name: "validate_request",
      description:
        "유저가 NPC에게 구체적인 행동을 요청하거나 부탁할 때 호출한다. 단순 대화, 질문, 감정 표현에는 호출하지 않는다. 예시 트리거: '~해줘', '~해줄 수 있어?', '~부탁해'",
      schema: z.object({
        userRequest: z.string().describe("유저의 요청 내용"),
      }),
    }
  )
}
```

- [ ] **Step 4: 툴 테스트 통과 확인**

```powershell
npx jest tests/game-core/agent/tools/validate-request.test.ts --no-coverage
```
Expected: PASS

- [ ] **Step 5: interact.test.ts 작성**

`tests/game-core/agent/interact.test.ts`:
```ts
import { interactWithNPC } from "@/game-core/agent/interact"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"
import type { GameState } from "@/game-core/types/game"

jest.mock("langchain/agents", () => ({
  createOpenAIFunctionsAgent: jest.fn().mockResolvedValue({}),
  AgentExecutor: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ output: "안녕! 오늘 날씨 좋다~" }),
  })),
}))
jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({})),
}))
jest.mock("@langchain/core/prompts", () => ({
  ChatPromptTemplate: { fromMessages: jest.fn().mockReturnValue({}) },
  MessagesPlaceholder: jest.fn(),
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
```

- [ ] **Step 6: 테스트 실패 확인**

```powershell
npx jest tests/game-core/agent/interact.test.ts --no-coverage
```
Expected: FAIL (Cannot find module)

- [ ] **Step 7: interact.ts 구현**

`src/game-core/agent/interact.ts`:
```ts
import { ChatOpenAI } from "@langchain/openai"
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents"
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts"
import { createValidateRequestTool, type RequestResult } from "@/game-core/agent/tools/validate-request"
import type { NPCProfile, NPCMemory, ConversationEntry } from "@/game-core/types/npc"
import type { GameState, NPCAction } from "@/game-core/types/game"

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
}): Promise<InteractResult> {
  const { npcProfile, npcMemory, userMessage, gameState, gameTimestamp } = params

  let requestResult: RequestResult | null = null

  const validateTool = createValidateRequestTool(
    npcProfile, npcMemory, gameState,
    (result) => { requestResult = result }
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

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `당신은 ${npcProfile.name}입니다.\n성격: ${npcProfile.personality.join(", ")}\n말투: ${npcProfile.speechStyle}\n\n최근 대화:\n${recentHistory || "(없음)"}\n\n유저와 자연스럽게 대화하세요. 유저가 구체적인 행동을 요청하면 validate_request 툴을 사용하세요.`,
    ],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ])

  const agent = await createOpenAIFunctionsAgent({ llm: model, tools: [validateTool], prompt })
  const executor = new AgentExecutor({ agent, tools: [validateTool] })
  const agentResult = await executor.invoke({ input: userMessage, chat_history: [] })

  const responseText = requestResult?.responseText ?? String(agentResult.output)

  const memoryUpdate: ConversationEntry = {
    timestamp: gameTimestamp,
    speaker: "npc",
    message: responseText,
    type: requestResult ? "request" : "chat",
    decision: requestResult?.decision,
  }

  return {
    responseText,
    decision: requestResult?.decision,
    action: requestResult?.action,
    memoryUpdate,
  }
}
```

- [ ] **Step 8: 테스트 통과 확인**

```powershell
npx jest tests/game-core/agent/ --no-coverage
```
Expected: PASS (3 tests)

- [ ] **Step 9: 커밋**

```bash
git add src/game-core/agent/ tests/game-core/agent/
git commit -m "feat(game-core): add validate_request tool and NPC interact handler"
```

---

### Task 7: API Route

**Files:**
- Create: `src/app/api/agent/interact/route.ts`
- Test: `tests/app/api/agent/interact.test.ts`

- [ ] **Step 1: API route 테스트 작성**

`tests/app/api/agent/interact.test.ts`:
```ts
import { POST } from "@/app/api/agent/interact/route"
import { NextRequest } from "next/server"

jest.mock("@/game-core/agent/interact", () => ({
  interactWithNPC: jest.fn().mockResolvedValue({
    responseText: "응, 알겠어!",
    decision: "ok",
    action: { type: "give_item", itemId: "fish_rod", quantity: 1 },
    memoryUpdate: { timestamp: 60, speaker: "npc", message: "응, 알겠어!", type: "request", decision: "ok" },
  }),
}))

it("POST /api/agent/interact 가 InteractResult 반환", async () => {
  const body = {
    npcProfile: { id: "npc_1", name: "토끼", personality: [], dislikeds: [], speechStyle: "반말", waypoints: [], habits: [] },
    npcMemory: { npcId: "npc_1", conversationHistory: [], relationshipScore: 0 },
    userMessage: "낚싯대 줘",
    gameState: { clock: { currentMinute: 60, day: 1 }, availableItems: [], availableLocations: [], npcPositions: {} },
  }

  const req = new NextRequest("http://localhost/api/agent/interact", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })

  const res = await POST(req)
  const data = await res.json()

  expect(res.status).toBe(200)
  expect(data.responseText).toBe("응, 알겠어!")
  expect(data.decision).toBe("ok")
  expect(data.action).toEqual({ type: "give_item", itemId: "fish_rod", quantity: 1 })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```powershell
npx jest tests/app/api/agent/interact.test.ts --no-coverage
```
Expected: FAIL (Cannot find module)

- [ ] **Step 3: route.ts 구현**

`src/app/api/agent/interact/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server"
import { interactWithNPC } from "@/game-core/agent/interact"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"
import type { GameState } from "@/game-core/types/game"

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    npcProfile: NPCProfile
    npcMemory: NPCMemory
    userMessage: string
    gameState: GameState
  }

  const gameTimestamp =
    body.gameState.clock.currentMinute + body.gameState.clock.day * 1440

  const result = await interactWithNPC({ ...body, gameTimestamp })
  return NextResponse.json(result)
}
```

- [ ] **Step 4: API route 테스트 통과 확인**

```powershell
npx jest tests/app/ --no-coverage
```
Expected: PASS

- [ ] **Step 5: 전체 테스트 통과 확인**

```powershell
npx jest --no-coverage
```
Expected: All tests PASS

- [ ] **Step 6: 빌드 확인**

```powershell
npm run build
```
Expected: `✓ Compiled successfully`

- [ ] **Step 7: 최종 커밋**

```bash
git add src/app/api/agent/ tests/app/
git commit -m "feat: add POST /api/agent/interact route"
```
