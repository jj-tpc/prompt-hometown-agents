import { POST } from "@/app/api/agent/interact/route"
import { AgentPipelineError } from "@/game-core/agent/interact"
import { NextRequest } from "next/server"

jest.mock("@/game-core/agent/interact", () => ({
  AgentPipelineError: jest.requireActual("@/game-core/agent/interact").AgentPipelineError,
  interactWithNPC: jest.fn().mockResolvedValue({
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
  }),
}))

it("POST /api/agent/interact returns InteractResult and forwards model selection", async () => {
  const { interactWithNPC } = jest.requireMock("@/game-core/agent/interact") as {
    interactWithNPC: jest.Mock
  }
  interactWithNPC.mockClear()

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

  const req = new NextRequest("http://localhost/api/agent/interact", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })

  const res = await POST(req)
  const data = await res.json()

  expect(res.status).toBe(200)
  expect(data.responseText).toBe("응 낚싯대!")
  expect(data.decision).toBe("ok")
  expect(data.action).toEqual({ type: "give_item", itemId: "fish_rod", quantity: 1 })
  expect(interactWithNPC).toHaveBeenCalledWith(
    expect.objectContaining({
      modelSelection: "gemini-3.5-flash",
    })
  )
})

it("returns a safe fallback response when the agent throws", async () => {
  const { interactWithNPC } = jest.requireMock("@/game-core/agent/interact") as {
    interactWithNPC: jest.Mock
  }
  const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined)
  interactWithNPC.mockRejectedValueOnce(new AgentPipelineError("decision", new Error("model failed")))

  const req = new NextRequest("http://localhost/api/agent/interact", {
    method: "POST",
    body: JSON.stringify({
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
    }),
    headers: { "Content-Type": "application/json" },
  })

  const res = await POST(req)
  const data = await res.json()

  expect(res.status).toBe(200)
  expect(data.decision).toBe("not_ok")
  expect(data.responseText).toContain("대화 처리 중 문제가 생겼어")
  expect(data.failedStage).toBe("decision")
  expect(data.errorMessage).toBe("Agent pipeline failed at decision")
  expect(data.memoryUpdate).toMatchObject({
    speaker: "npc",
    type: "chat",
    decision: "not_ok",
  })
  consoleSpy.mockRestore()
})
