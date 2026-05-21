import { POST } from "@/app/api/agent/interact/route"
import { interactWithNPC } from "@/game-core/agent/interact"
import { NextRequest } from "next/server"

jest.mock("@/game-core/agent/interact", () => ({
  interactWithNPC: jest.fn(),
}))

const mockInteractWithNPC = interactWithNPC as jest.Mock

const body = {
  npcProfile: { id: "npc_1", name: "토끼", personality: [], dislikeds: [], speechStyle: "반말", waypoints: [], habits: [] },
  npcMemory: { npcId: "npc_1", conversationHistory: [], relationshipScore: 0 },
  userMessage: "낚싯대 줘",
  gameState: { clock: { currentMinute: 60, day: 1 }, availableItems: [], availableLocations: [], npcPositions: {} },
}

function request() {
  return new NextRequest("http://localhost/api/agent/interact", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  mockInteractWithNPC.mockReset()
  mockInteractWithNPC.mockResolvedValue({
    responseText: "응, 알겠어!",
    decision: "ok",
    action: { type: "give_item", itemId: "fish_rod", quantity: 1 },
    memoryUpdate: { timestamp: 60, speaker: "npc", message: "응, 알겠어!", type: "request", decision: "ok" },
  })
})

it("POST /api/agent/interact 가 InteractResult 반환", async () => {
  const res = await POST(request())
  const data = await res.json()

  expect(res.status).toBe(200)
  expect(data.responseText).toBe("응, 알겠어!")
  expect(data.decision).toBe("ok")
  expect(data.action).toEqual({ type: "give_item", itemId: "fish_rod", quantity: 1 })
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
