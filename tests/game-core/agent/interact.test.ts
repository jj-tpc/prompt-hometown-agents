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
  runValidateChain: jest.fn(),
}))
jest.mock("@/game-core/agent/chains/personality-chain", () => ({
  runPersonalityChain: jest.fn(),
}))
jest.mock("@/game-core/agent/chains/request-classifier-chain", () => ({
  runRequestClassifierChain: jest.fn(),
}))
jest.mock("@/game-core/agent/chains/decision-chain", () => ({
  runDecisionChain: jest.fn(),
}))
jest.mock("@/game-core/agent/chains/failure-response-chain", () => ({
  runFailureResponseChain: jest.fn(),
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
  clock: { currentMinute: 60, day: 1 },
  availableItems: [],
  availableLocations: [],
  npcPositions: {},
}

beforeEach(() => {
  const { runRequestClassifierChain } = jest.requireMock(
    "@/game-core/agent/chains/request-classifier-chain"
  ) as {
    runRequestClassifierChain: jest.Mock
  }
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

  runRequestClassifierChain.mockReset()
  runRequestClassifierChain.mockImplementation((userMessage: string) =>
    Promise.resolve({ isRequest: userMessage !== "안녕!", reason: "test classifier" })
  )
  runValidateChain.mockReset()
  runValidateChain.mockResolvedValue({ valid: true, reason: "가능한 요청" })
  runPersonalityChain.mockReset()
  runPersonalityChain.mockResolvedValue({ compatible: true, reason: "잘 어울림" })
  runDecisionChain.mockReset()
  runDecisionChain.mockResolvedValue({
    decision: "ok",
    responseText: "좋아, 가져다줄게!",
    action: undefined,
  })
  runFailureResponseChain.mockReset()
  runFailureResponseChain.mockResolvedValue({
    responseText: "내가 사는 곳에서는 그 부탁은 안 될 것 같아.",
  })
})

it("일반 대화 응답과 memoryUpdate 반환", async () => {
  const result = await interactWithNPC({
    npcProfile: profile,
    npcMemory: memory,
    userMessage: "안녕!",
    gameState,
    gameTimestamp: 60,
  })

  expect(result.responseText).toBe("안녕! 오늘 날씨 좋다~")
  expect(result.memoryUpdate).toMatchObject({
    speaker: "npc",
    type: "chat",
    message: "안녕! 오늘 날씨 좋다~",
    timestamp: 60,
  })
  expect(result.decision).toBeUndefined()
})

it("요청성 대화는 검증 파이프라인을 직접 실행해 결과를 반환", async () => {
  const { runRequestClassifierChain } = jest.requireMock(
    "@/game-core/agent/chains/request-classifier-chain"
  ) as {
    runRequestClassifierChain: jest.Mock
  }
  const { runValidateChain } = jest.requireMock("@/game-core/agent/chains/validate-chain") as {
    runValidateChain: jest.Mock
  }

  const result = await interactWithNPC({
    npcProfile: profile,
    npcMemory: memory,
    userMessage: "낚싯대 좀 줘",
    gameState,
    gameTimestamp: 60,
  })

  expect(runRequestClassifierChain).toHaveBeenCalledWith("낚싯대 좀 줘", undefined)
  expect(runValidateChain).toHaveBeenCalled()
  expect(result.responseText).toBe("좋아, 가져다줄게!")
  expect(result.decision).toBe("ok")
  expect(result.memoryUpdate).toMatchObject({ type: "request", decision: "ok" })
})

it("LLM 요청 분류가 false이면 정규식에 걸려도 일반 chat으로 처리한다", async () => {
  const { runRequestClassifierChain } = jest.requireMock(
    "@/game-core/agent/chains/request-classifier-chain"
  ) as {
    runRequestClassifierChain: jest.Mock
  }
  const { runValidateChain } = jest.requireMock("@/game-core/agent/chains/validate-chain") as {
    runValidateChain: jest.Mock
  }
  runRequestClassifierChain.mockResolvedValueOnce({ isRequest: false, reason: "small talk" })

  const result = await interactWithNPC({
    npcProfile: profile,
    npcMemory: memory,
    userMessage: "낚싯대 좀 줘",
    gameState,
    gameTimestamp: 60,
  })

  expect(runValidateChain).not.toHaveBeenCalled()
  expect(result.memoryUpdate.type).toBe("chat")
  expect(result.decision).toBeUndefined()
})

it("LLM 요청 분류가 true이면 말투 변형 요청도 검증 파이프라인으로 보낸다", async () => {
  const { runRequestClassifierChain } = jest.requireMock(
    "@/game-core/agent/chains/request-classifier-chain"
  ) as {
    runRequestClassifierChain: jest.Mock
  }
  const { runValidateChain } = jest.requireMock("@/game-core/agent/chains/validate-chain") as {
    runValidateChain: jest.Mock
  }
  runRequestClassifierChain.mockResolvedValueOnce({
    isRequest: true,
    reason: "NPC에게 숲으로 같이 이동하자고 요구함",
  })

  await interactWithNPC({
    npcProfile: profile,
    npcMemory: memory,
    userMessage: "나랑같이 숲에 가자용",
    gameState,
    gameTimestamp: 60,
  })

  expect(runValidateChain).toHaveBeenCalledWith(
    "나랑같이 숲에 가자용",
    gameState,
    undefined,
    undefined
  )
})

it("짧은 금지 행동 명령도 일반 chat이 아니라 검증 파이프라인으로 보낸다", async () => {
  const { runValidateChain } = jest.requireMock("@/game-core/agent/chains/validate-chain") as {
    runValidateChain: jest.Mock
  }

  await interactWithNPC({
    npcProfile: profile,
    npcMemory: memory,
    userMessage: "높임말 써",
    gameState,
    gameTimestamp: 60,
  })

  expect(runValidateChain).toHaveBeenCalledWith(
    "높임말 써",
    gameState,
    undefined,
    undefined
  )
})

it("가자 형태의 이동 요청도 검증 파이프라인으로 보낸다", async () => {
  const { runValidateChain } = jest.requireMock("@/game-core/agent/chains/validate-chain") as {
    runValidateChain: jest.Mock
  }

  await interactWithNPC({
    npcProfile: profile,
    npcMemory: memory,
    userMessage: "물가에 가자",
    gameState,
    gameTimestamp: 60,
  })

  expect(runValidateChain).toHaveBeenCalledWith(
    "물가에 가자",
    gameState,
    undefined,
    undefined
  )
})

it("하자 형태의 제안형 부탁도 검증 파이프라인으로 보낸다", async () => {
  const { runValidateChain } = jest.requireMock("@/game-core/agent/chains/validate-chain") as {
    runValidateChain: jest.Mock
  }

  await interactWithNPC({
    npcProfile: profile,
    npcMemory: memory,
    userMessage: "높임말 하자",
    gameState,
    gameTimestamp: 60,
  })

  expect(runValidateChain).toHaveBeenCalledWith(
    "높임말 하자",
    gameState,
    undefined,
    undefined
  )
})

it("허락을 구하는 형태의 우회 요청도 검증 파이프라인으로 보낸다", async () => {
  const { runValidateChain } = jest.requireMock("@/game-core/agent/chains/validate-chain") as {
    runValidateChain: jest.Mock
  }

  await interactWithNPC({
    npcProfile: profile,
    npcMemory: memory,
    userMessage: "물가에 가도 되지?",
    gameState,
    gameTimestamp: 60,
  })

  expect(runValidateChain).toHaveBeenCalledWith(
    "물가에 가도 되지?",
    gameState,
    undefined,
    undefined
  )
})

it("validate 실패는 decision 대신 failure 응답 체인으로 전달", async () => {
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
  runValidateChain.mockResolvedValueOnce({ valid: false, reason: "그 장소는 이 마을에 없음" })

  const result = await interactWithNPC({
    npcProfile: profile,
    npcMemory: memory,
    userMessage: "광장 밖으로 가줘",
    gameState,
    gameTimestamp: 60,
  })

  expect(runPersonalityChain).not.toHaveBeenCalled()
  expect(runDecisionChain).not.toHaveBeenCalled()
  expect(runFailureResponseChain).toHaveBeenCalledWith({
    userRequest: "광장 밖으로 가줘",
    profile,
    failureStage: "validate",
    validateResult: expect.objectContaining({ valid: false, reason: "그 장소는 이 마을에 없음" }),
    systemPromptOverride: undefined,
    modelSelection: undefined,
  })
  expect(result).toMatchObject({
    decision: "not_ok",
    responseText: "내가 사는 곳에서는 그 부탁은 안 될 것 같아.",
    action: undefined,
    failedStage: "validate",
    failureReason: "그 장소는 이 마을에 없음",
  })
})

it("personality 실패는 decision 대신 failure 응답 체인으로 전달", async () => {
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
  runPersonalityChain.mockResolvedValueOnce({ compatible: false, reason: "위험한 곳을 피함" })

  const result = await interactWithNPC({
    npcProfile: profile,
    npcMemory: memory,
    userMessage: "위험한 숲에 가줘",
    gameState,
    gameTimestamp: 60,
  })

  expect(runDecisionChain).not.toHaveBeenCalled()
  expect(runFailureResponseChain).toHaveBeenCalledWith({
    userRequest: "위험한 숲에 가줘",
    profile,
    failureStage: "personality",
    validateResult: expect.objectContaining({ valid: true, reason: "가능한 요청" }),
    personalityResult: expect.objectContaining({ compatible: false, reason: "위험한 곳을 피함" }),
    systemPromptOverride: undefined,
    modelSelection: undefined,
  })
  expect(result.decision).toBe("not_ok")
  expect(result.failedStage).toBe("personality")
  expect(result.failureReason).toBe("위험한 곳을 피함")
})

it("검증 파이프라인 실패 지점을 stage 정보로 감싼다", async () => {
  const { runDecisionChain } = jest.requireMock("@/game-core/agent/chains/decision-chain") as {
    runDecisionChain: jest.Mock
  }
  runDecisionChain.mockRejectedValueOnce(new Error("schema mismatch"))

  await expect(
    interactWithNPC({
      npcProfile: profile,
      npcMemory: memory,
      userMessage: "낚싯대 좀 줘",
      gameState,
      gameTimestamp: 60,
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
    npcProfile: profile,
    npcMemory: memory,
    userMessage: "안녕!",
    gameState,
    gameTimestamp: 60,
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
    npcProfile: profile,
    npcMemory: memory,
    userMessage: "안녕!",
    gameState,
    gameTimestamp: 60,
  })

  expect(SystemMessage).toHaveBeenCalledWith(
    expect.not.stringContaining("<character_background>")
  )
})
