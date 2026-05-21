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
        invoke: jest.fn().mockResolvedValue({ prohibitViolated: true, compatible: false, reason: "겁쟁이라서 위험한 곳은 싫어해요." }),
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
  habitBehavior: "늘 조심스럽게 말한다.",
  prohibitBehavior: "위험한 숲으로 이동하지 않는다.",
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

it("prohibitViolated=true면 compatible=false를 코드 레벨에서 강제", async () => {
  const { ChatPromptTemplate } = jest.requireMock("@langchain/core/prompts") as {
    ChatPromptTemplate: { fromMessages: jest.Mock }
  }
  const chain = ChatPromptTemplate.fromMessages.mock.results.at(-1)?.value.pipe.mock.results.at(-1)?.value
  // LLM이 compatible=true를 잘못 반환했더라도 prohibitViolated=true면 false로 강제됨
  chain.invoke.mockResolvedValueOnce({ prohibitViolated: true, compatible: true, reason: "금지 행동 위반" })

  const result = await runPersonalityChain("위험한 숲에 가줘", profile, memory)
  expect(result.prohibitViolated).toBe(true)
  expect(result.compatible).toBe(false)
})

it("습관 행동과 금지 행동을 2번째 검증 입력에 포함", async () => {
  await runPersonalityChain("위험한 숲에 가줘", profile, memory)

  const { ChatPromptTemplate } = jest.requireMock("@langchain/core/prompts") as {
    ChatPromptTemplate: {
      fromMessages: jest.Mock
    }
  }
  const prompt = ChatPromptTemplate.fromMessages.mock.results.at(-1)?.value
  const chain = prompt.pipe.mock.results.at(-1)?.value

  expect(chain.invoke).toHaveBeenCalledWith(
    expect.objectContaining({
      habitBehavior: "늘 조심스럽게 말한다.",
      prohibitBehavior: "위험한 숲으로 이동하지 않는다.",
    })
  )
})
