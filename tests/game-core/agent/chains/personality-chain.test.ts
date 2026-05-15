import { runPersonalityChain } from "@/game-core/agent/chains/personality-chain"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    withStructuredOutput: jest.fn().mockReturnValue({}),
  })),
}))

jest.mock("@langchain/core/prompts", () => ({
  ChatPromptTemplate: {
    fromMessages: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnValue({
        invoke: jest.fn().mockResolvedValue({ compatible: false, reason: "겁쟁이라서 위험한 곳은 싫어해요." }),
      }),
    }),
  },
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
