import { AgentPipelineError, interactWithNPC } from "@/game-core/agent/interact"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"
import type { GameState } from "@/game-core/types/game"

jest.mock("@/game-core/agent/llm-models", () => ({
  getLLMModelDebugInfo: jest.fn().mockReturnValue({
    selection: "openai-default",
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.8,
  }),
  createChatModel: jest.fn().mockReturnValue({
    invoke: jest.fn().mockResolvedValue({ content: "안녕! 오늘 날씨 좋다~" }),
  }),
}))
jest.mock("@langchain/core/messages", () => ({
  HumanMessage: jest.fn().mockImplementation((content: string) => ({ content })),
  SystemMessage: jest.fn().mockImplementation((content: string) => ({ content })),
}))
jest.mock("@/game-core/agent/chains/validate-chain", () => ({
  runValidateChain: jest.fn().mockResolvedValue({ valid: true, reason: "가능한 요청" }),
}))
jest.mock("@/game-core/agent/chains/personality-chain", () => ({
  runPersonalityChain: jest.fn().mockResolvedValue({ compatible: true, reason: "잘 어울림" }),
}))
jest.mock("@/game-core/agent/chains/decision-chain", () => ({
  runDecisionChain: jest.fn().mockResolvedValue({
    decision: "ok",
    responseText: "좋아, 도와줄게!",
    action: undefined,
  }),
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

it("요청형 대화는 검증 파이프라인을 직접 실행해 결과를 반환", async () => {
  const { runValidateChain } = jest.requireMock("@/game-core/agent/chains/validate-chain") as {
    runValidateChain: jest.Mock
  }

  const result = await interactWithNPC({
    npcProfile: profile, npcMemory: memory,
    userMessage: "혹시 나 좀 도와줄 수 있어?", gameState, gameTimestamp: 60,
  })

  expect(runValidateChain).toHaveBeenCalled()
  expect(result.responseText).toBe("좋아, 도와줄게!")
  expect(result.decision).toBe("ok")
  expect(result.memoryUpdate).toMatchObject({ type: "request", decision: "ok" })
})

it("검증 파이프라인 실패 지점을 stage 정보로 감싼다", async () => {
  const { runDecisionChain } = jest.requireMock("@/game-core/agent/chains/decision-chain") as {
    runDecisionChain: jest.Mock
  }
  runDecisionChain.mockRejectedValueOnce(new Error("schema mismatch"))

  await expect(
    interactWithNPC({
      npcProfile: profile, npcMemory: memory,
      userMessage: "혹시 나 좀 도와줄 수 있어?", gameState, gameTimestamp: 60,
    })
  ).rejects.toMatchObject({
    name: "AgentPipelineError",
    stage: "decision",
  } satisfies Partial<AgentPipelineError>)
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
