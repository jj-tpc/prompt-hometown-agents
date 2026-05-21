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
jest.mock("@/game-core/agent/chains/failure-response-chain", () => ({
  runFailureResponseChain: jest.fn().mockResolvedValue({
    responseText: "내가 사는 곳에서는 그 부탁은 안 될 것 같아.",
  }),
}))

const profile: NPCProfile = {
  id: "npc_1",
  name: "토끼",
  personality: ["친절함"],
  dislikeds: [],
  speechStyle: "반말",
  waypoints: [],
  habits: [],
}
const memory: NPCMemory = { npcId: "npc_1", conversationHistory: [], relationshipScore: 0 }
const gameState: GameState = {
  clock: { currentMinute: 0, day: 1 },
  availableItems: [],
  availableLocations: ["광장"],
  npcPositions: {},
}

beforeEach(() => {
  const { runValidateChain } = jest.requireMock("@/game-core/agent/chains/validate-chain") as {
    runValidateChain: jest.Mock
  }
  const { runPersonalityChain } = jest.requireMock("@/game-core/agent/chains/personality-chain") as {
    runPersonalityChain: jest.Mock
  }
  const { runDecisionChain } = jest.requireMock("@/game-core/agent/chains/decision-chain") as {
    runDecisionChain: jest.Mock
  }
  const { runFailureResponseChain } = jest.requireMock(
    "@/game-core/agent/chains/failure-response-chain"
  ) as {
    runFailureResponseChain: jest.Mock
  }

  runValidateChain.mockReset()
  runValidateChain.mockResolvedValue({ valid: false, reason: "장소가 없음" })
  runPersonalityChain.mockReset()
  runPersonalityChain.mockResolvedValue({ compatible: true, reason: "괜찮음" })
  runDecisionChain.mockReset()
  runDecisionChain.mockResolvedValue({
    decision: "not_ok",
    responseText: "그런 곳은 없는걸...",
    action: undefined,
  })
  runFailureResponseChain.mockReset()
  runFailureResponseChain.mockResolvedValue({
    responseText: "내가 사는 곳에서는 그 부탁은 안 될 것 같아.",
  })
})

it("Step 1 실패 시 Step 2를 건너뛰고 결과 반환", async () => {
  const { runPersonalityChain } = jest.requireMock("@/game-core/agent/chains/personality-chain")
  let capturedResult: unknown
  const tool = createValidateRequestTool(profile, memory, gameState, (r) => { capturedResult = r })

  await tool.invoke({ userRequest: "없는 곳에 가줘" })

  expect(runPersonalityChain).not.toHaveBeenCalled()
  expect(capturedResult).toMatchObject({ decision: "not_ok" })
})

it("Step 1 실패 이유를 세계 규칙 실패로 failure 응답 체인에 전달", async () => {
  const { runValidateChain } = jest.requireMock("@/game-core/agent/chains/validate-chain") as {
    runValidateChain: jest.Mock
  }
  const { runDecisionChain } = jest.requireMock("@/game-core/agent/chains/decision-chain") as {
    runDecisionChain: jest.Mock
  }
  const { runFailureResponseChain } = jest.requireMock(
    "@/game-core/agent/chains/failure-response-chain"
  ) as {
    runFailureResponseChain: jest.Mock
  }
  runValidateChain.mockResolvedValueOnce({ valid: false, reason: "지도에 없는 장소" })

  const tool = createValidateRequestTool(profile, memory, gameState, () => undefined)

  await tool.invoke({ userRequest: "없는 곳에 가줘" })

  expect(runDecisionChain).not.toHaveBeenCalled()
  expect(runFailureResponseChain).toHaveBeenCalledWith({
    userRequest: "없는 곳에 가줘",
    profile,
    failureStage: "validate",
    validateResult: expect.objectContaining({ valid: false, reason: "지도에 없는 장소" }),
    systemPromptOverride: undefined,
    modelSelection: undefined,
  })
})

it("Step 2 실패 이유를 personality 실패로 failure 응답 체인에 전달", async () => {
  const { runValidateChain } = jest.requireMock("@/game-core/agent/chains/validate-chain") as {
    runValidateChain: jest.Mock
  }
  const { runPersonalityChain } = jest.requireMock("@/game-core/agent/chains/personality-chain") as {
    runPersonalityChain: jest.Mock
  }
  const { runDecisionChain } = jest.requireMock("@/game-core/agent/chains/decision-chain") as {
    runDecisionChain: jest.Mock
  }
  const { runFailureResponseChain } = jest.requireMock(
    "@/game-core/agent/chains/failure-response-chain"
  ) as {
    runFailureResponseChain: jest.Mock
  }
  runValidateChain.mockResolvedValueOnce({ valid: true, reason: "장소는 존재함" })
  runPersonalityChain.mockResolvedValueOnce({ compatible: false, reason: "성격상 싫어함" })

  const tool = createValidateRequestTool(profile, memory, gameState, () => undefined)

  await tool.invoke({ userRequest: "광장에 가줘" })

  expect(runDecisionChain).not.toHaveBeenCalled()
  expect(runFailureResponseChain).toHaveBeenCalledWith({
    userRequest: "광장에 가줘",
    profile,
    failureStage: "personality",
    validateResult: expect.objectContaining({ valid: true, reason: "장소는 존재함" }),
    personalityResult: expect.objectContaining({ compatible: false, reason: "성격상 싫어함" }),
    systemPromptOverride: undefined,
    modelSelection: undefined,
  })
})

it("validate 단계 예외에 파이프라인 단계 정보를 붙여 던진다", async () => {
  const { runValidateChain } = jest.requireMock("@/game-core/agent/chains/validate-chain") as {
    runValidateChain: jest.Mock
  }
  runValidateChain.mockRejectedValueOnce(new Error("validate prompt variable missing"))

  const tool = createValidateRequestTool(profile, memory, gameState, () => undefined)

  await expect(tool.invoke({ userRequest: "없는 곳에 가줘" })).rejects.toMatchObject({
    pipelineStage: "validate",
    message: "validate prompt variable missing",
  })
})

it("personality 단계 예외에 파이프라인 단계 정보를 붙여 던진다", async () => {
  const { runValidateChain } = jest.requireMock("@/game-core/agent/chains/validate-chain") as {
    runValidateChain: jest.Mock
  }
  const { runPersonalityChain } = jest.requireMock("@/game-core/agent/chains/personality-chain") as {
    runPersonalityChain: jest.Mock
  }
  runValidateChain.mockResolvedValueOnce({ valid: true, reason: "가능함" })
  runPersonalityChain.mockRejectedValueOnce(new Error("personality schema failed"))

  const tool = createValidateRequestTool(profile, memory, gameState, () => undefined)

  await expect(tool.invoke({ userRequest: "광장에 가줘" })).rejects.toMatchObject({
    pipelineStage: "personality",
    message: "personality schema failed",
  })
})

it("decision 단계 예외에 파이프라인 단계 정보를 붙여 던진다", async () => {
  const { runValidateChain } = jest.requireMock("@/game-core/agent/chains/validate-chain") as {
    runValidateChain: jest.Mock
  }
  const { runPersonalityChain } = jest.requireMock("@/game-core/agent/chains/personality-chain") as {
    runPersonalityChain: jest.Mock
  }
  const { runDecisionChain } = jest.requireMock("@/game-core/agent/chains/decision-chain") as {
    runDecisionChain: jest.Mock
  }
  runValidateChain.mockResolvedValueOnce({ valid: true, reason: "가능함" })
  runPersonalityChain.mockResolvedValueOnce({ compatible: true, reason: "어울림" })
  runDecisionChain.mockRejectedValueOnce(new Error("decision output invalid"))

  const tool = createValidateRequestTool(profile, memory, gameState, () => undefined)

  await expect(tool.invoke({ userRequest: "없는 곳에 가줘" })).rejects.toMatchObject({
    pipelineStage: "decision",
    message: "decision output invalid",
  })
})
