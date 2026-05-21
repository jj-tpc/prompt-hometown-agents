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
    personality: ["조심스러움"],
    dislikeds: [],
    speechStyle: "반말",
    waypoints: [],
    habits: [],
    prohibitBehavior: "위험한 물건을 건네지 않는다",
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

it("검증 파이프라인 예외는 NPC 답변과 단계 정보를 포함한 결과로 반환", async () => {
  mockInteractWithNPC.mockRejectedValueOnce(
    Object.assign(new Error("validate prompt variable missing"), { pipelineStage: "validate" })
  )

  const res = await POST(request())
  const data = await res.json()

  expect(res.status).toBe(200)
  expect(data.decision).toBe("not_ok")
  expect(data.failedStage).toBe("validate")
  expect(data.errorMessage).toBe("validate prompt variable missing")
  expect(data.responseText).toContain("다른")
  expect(data.memoryUpdate).toMatchObject({
    speaker: "npc",
    message: data.responseText,
    type: "chat",
    decision: "not_ok",
  })
  expect(data.error).toEqual({
    code: "validation_pipeline_failed",
    pipelineStage: "validate",
    pipelineStageLabel: "검증(validate)",
    message: "validate prompt variable missing",
  })
})

it("personality 단계 실패는 캐릭터 성격에 맞춘 거절 답변으로 반환", async () => {
  mockInteractWithNPC.mockRejectedValueOnce(
    new AgentPipelineError("personality", new Error("personality schema failed"))
  )

  const res = await POST(request())
  const data = await res.json()

  expect(res.status).toBe(200)
  expect(data.decision).toBe("not_ok")
  expect(data.failedStage).toBe("personality")
  expect(data.responseText).toContain("내 방식")
  expect(data.responseText).toContain("위험한 물건")
  expect(data.error).toEqual({
    code: "validation_pipeline_failed",
    pipelineStage: "personality",
    pipelineStageLabel: "성격(personality)",
    message: "personality schema failed",
  })
})

it("chat 단계 예외는 다시 말해달라는 캐릭터 답변으로 반환", async () => {
  const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined)
  mockInteractWithNPC.mockRejectedValueOnce(new AgentPipelineError("chat", new Error("model failed")))

  const res = await POST(request())
  const data = await res.json()

  expect(res.status).toBe(200)
  expect(data.decision).toBe("not_ok")
  expect(data.responseText).toBe("잘 못 들었는데... 다시 한 번 말해봐.")
  expect(data.failedStage).toBe("chat")
  expect(data.errorMessage).toBe("Agent pipeline failed at chat")
  expect(data.memoryUpdate).toMatchObject({
    speaker: "npc",
    type: "chat",
    decision: "not_ok",
  })
  consoleSpy.mockRestore()
})
