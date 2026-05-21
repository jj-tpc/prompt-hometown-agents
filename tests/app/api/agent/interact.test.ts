import { POST } from "@/app/api/agent/interact/route"
import { AgentPipelineError, interactWithNPC } from "@/game-core/agent/interact"
import { NextRequest } from "next/server"

jest.mock("@/game-core/agent/interact", () => {
  const actual = jest.requireActual("@/game-core/agent/interact")
  return {
    AgentPipelineError: actual.AgentPipelineError,
    interactWithNPC: jest.fn(),
  }
})

const mockInteractWithNPC = interactWithNPC as jest.Mock

const body = {
  npcProfile: {
    id: "npc_1",
    name: "토미",
    personality: [],
    dislikeds: [],
    speechStyle: "반말",
    waypoints: [],
    habits: [],
  },
  npcMemory: { npcId: "npc_1", conversationHistory: [], relationshipScore: 0 },
  userMessage: "낚싯대 줘",
  gameState: {
    clock: { currentMinute: 60, day: 1 },
    availableItems: [],
    availableLocations: [],
    npcPositions: {},
  },
  modelSelection: "gemini-3.5-flash",
}

function request(requestBody = body) {
  return new NextRequest("http://localhost/api/agent/interact", {
    method: "POST",
    body: JSON.stringify(requestBody),
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  mockInteractWithNPC.mockReset()
  mockInteractWithNPC.mockResolvedValue({
    responseText: "응 낚싯대!",
    decision: "ok",
    action: { type: "give_item", itemId: "fish_rod", quantity: 1 },
    memoryUpdate: {
      timestamp: 60,
      speaker: "npc",
      message: "응 낚싯대!",
      type: "request",
      decision: "ok",
    },
  })
})

it("POST /api/agent/interact returns InteractResult and forwards model selection", async () => {
  const res = await POST(request())
  const data = await res.json()

  expect(res.status).toBe(200)
  expect(data.responseText).toBe("응 낚싯대!")
  expect(data.decision).toBe("ok")
  expect(data.action).toEqual({ type: "give_item", itemId: "fish_rod", quantity: 1 })
  expect(mockInteractWithNPC).toHaveBeenCalledWith(
    expect.objectContaining({
      modelSelection: "gemini-3.5-flash",
    })
  )
})

it("검증 파이프라인 예외는 단계 정보를 포함한 JSON 오류로 반환", async () => {
  mockInteractWithNPC.mockRejectedValueOnce(
    Object.assign(new Error("validate prompt variable missing"), { pipelineStage: "validate" })
  )

  const res = await POST(request())
  const data = await res.json()

  expect(res.status).toBe(502)
  expect(data.error).toEqual({
    code: "validation_pipeline_failed",
    pipelineStage: "validate",
    pipelineStageLabel: "검증(validate)",
    message: "validate prompt variable missing",
  })
})

it("AgentPipelineError의 검증 단계 예외도 단계 정보를 포함한 JSON 오류로 반환", async () => {
  mockInteractWithNPC.mockRejectedValueOnce(
    new AgentPipelineError("decision", new Error("decision output invalid"))
  )

  const res = await POST(request())
  const data = await res.json()

  expect(res.status).toBe(502)
  expect(data.error).toEqual({
    code: "validation_pipeline_failed",
    pipelineStage: "decision",
    pipelineStageLabel: "결정(decision)",
    message: "decision output invalid",
  })
})

it("chat 단계 예외는 안전한 fallback 응답으로 반환", async () => {
  const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined)
  mockInteractWithNPC.mockRejectedValueOnce(new AgentPipelineError("chat", new Error("model failed")))

  const res = await POST(request())
  const data = await res.json()

  expect(res.status).toBe(200)
  expect(data.decision).toBe("not_ok")
  expect(data.responseText).toContain("대화 처리 중 문제가 생겼어")
  expect(data.failedStage).toBe("chat")
  expect(data.errorMessage).toBe("Agent pipeline failed at chat")
  expect(data.memoryUpdate).toMatchObject({
    speaker: "npc",
    type: "chat",
    decision: "not_ok",
  })
  consoleSpy.mockRestore()
})
