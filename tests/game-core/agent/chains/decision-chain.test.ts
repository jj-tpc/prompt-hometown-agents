import { runDecisionChain } from "@/game-core/agent/chains/decision-chain"
import type { NPCProfile } from "@/game-core/types/npc"

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    withStructuredOutput: jest.fn().mockReturnValue({}),
  })),
}))

jest.mock("@langchain/core/prompts", () => ({
  ChatPromptTemplate: {
    fromMessages: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnValue({ invoke: jest.fn() }),
    }),
  },
}))

function getMockInvoke() {
  const { ChatPromptTemplate } = jest.requireMock("@langchain/core/prompts")
  return ChatPromptTemplate.fromMessages().pipe().invoke as jest.Mock
}

const profile: NPCProfile = {
  id: "npc_1",
  name: "토끼",
  personality: ["겁쟁이"],
  dislikeds: ["위험한 장소"],
  speechStyle: "반말, 수줍음",
  waypoints: [],
  habits: [],
}

beforeEach(() => {
  getMockInvoke().mockReset()
})

it("not_ok 결정 시 action 없이 반환", async () => {
  getMockInvoke().mockResolvedValueOnce({ decision: "not_ok", responseText: "무서워서 못 가겠어...", action: null })
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
  getMockInvoke().mockResolvedValueOnce({
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
