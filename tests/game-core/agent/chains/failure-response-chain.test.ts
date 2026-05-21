import { runFailureResponseChain } from "@/game-core/agent/chains/failure-response-chain"
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
  personality: ["친절함"],
  dislikeds: ["위험한 장소"],
  speechStyle: "반말",
  habitBehavior: "말끝을 흐린다",
  prohibitBehavior: "위험한 곳에는 가지 않는다",
  waypoints: [],
  habits: [],
}

beforeEach(() => {
  getMockInvoke().mockReset()
})

it("validate 실패 응답 생성을 별도 failure 프롬프트로 호출", async () => {
  getMockInvoke().mockResolvedValueOnce({
    responseText: "내가 사는 곳에서는 그 부탁은 안 될 것 같아.",
  })

  const result = await runFailureResponseChain({
    userRequest: "마을 밖으로 가줘",
    profile,
    failureStage: "validate",
    validateResult: { valid: false, reason: "마을 밖은 이동 가능한 장소가 아님" },
  })

  expect(result.responseText).toBe("내가 사는 곳에서는 그 부탁은 안 될 것 같아.")
  expect(getMockInvoke()).toHaveBeenCalledWith(
    expect.objectContaining({
      failureStage: "validate",
      failureGuidance: expect.stringContaining("내가 사는 곳에서는"),
      prohibitBehavior: "위험한 곳에는 가지 않는다",
    })
  )
})

it("personality 실패 응답 생성을 별도 failure 프롬프트로 호출", async () => {
  getMockInvoke().mockResolvedValueOnce({
    responseText: "그건 내 방식이랑 안 맞아.",
  })

  await runFailureResponseChain({
    userRequest: "위험한 곳으로 가줘",
    profile,
    failureStage: "personality",
    validateResult: { valid: true, reason: "장소는 존재함" },
    personalityResult: { compatible: false, reason: "위험한 곳을 피함" },
  })

  expect(getMockInvoke()).toHaveBeenCalledWith(
    expect.objectContaining({
      failureStage: "personality",
      failureGuidance: expect.stringContaining("personality"),
      personalityResult: "compatible=false, reason: 위험한 곳을 피함",
    })
  )
})
