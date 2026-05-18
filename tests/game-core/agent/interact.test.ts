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
