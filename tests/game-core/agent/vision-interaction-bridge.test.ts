import type { GameState } from "@/game-core/types/game"
import type { NPCMemory, NPCProfile } from "@/game-core/types/npc"
import type { NPCVisionProfile, VisionEvent } from "@/game-core/types/map"

jest.mock("@/game-core/agent/interact", () => ({
  interactWithNPC: jest.fn(async () => ({
    responseText: "I saw you!",
    memoryUpdate: { timestamp: 0, speaker: "npc", message: "I saw you!", type: "chat" },
  })),
}))

import { interactWithNPC } from "@/game-core/agent/interact"
import { createSightingState, processVisionEvents } from "@/game-core/agent/vision-interaction-bridge"

const mockInteract = interactWithNPC as jest.Mock

const gameState: GameState = {
  clock: { currentMinute: 600, day: 1 },
  availableItems: [],
  availableLocations: [],
  npcPositions: {},
}

const memory: NPCMemory = {
  npcId: "npc_test",
  conversationHistory: [],
  relationshipScore: 0,
}

function profile(reactionType: NPCVisionProfile["reactionType"]): NPCProfile {
  return {
    id: "npc_test",
    name: "Test NPC",
    personality: [],
    dislikeds: [],
    speechStyle: "brief",
    waypoints: [],
    habits: [],
    visionProfile: {
      visionConfig: { type: "linear", range: 4, facing: "down" },
      proximityRange: 1,
      reactionType,
    },
  }
}

function event(type: VisionEvent["type"] = "DETECTED"): VisionEvent {
  return {
    type,
    npcId: "npc_test",
    targetId: "player",
    targetPosition: { x: 3, y: 3 },
    distance: 2,
    timestamp: 600,
  }
}

beforeEach(() => mockInteract.mockClear())

describe("processVisionEvents", () => {
  it("calls interactWithNPC once for DETECTED exclamation and alert reactions", async () => {
    for (const reaction of ["exclamation", "alert"] as const) {
      mockInteract.mockClear()
      await processVisionEvents([event()], createSightingState(), {
        resolveNPC: () => ({ profile: profile(reaction), memory }),
        gameState,
      })

      expect(mockInteract).toHaveBeenCalledTimes(1)
      expect(mockInteract).toHaveBeenCalledWith(
        expect.objectContaining({
          npcProfile: expect.objectContaining({ id: "npc_test" }),
          npcMemory: memory,
          gameState,
          gameTimestamp: 600,
        })
      )
    }
  })

  it("does not call interactWithNPC for ignore or approach reactions", async () => {
    for (const reaction of ["ignore", "approach"] as const) {
      mockInteract.mockClear()
      await processVisionEvents([event()], createSightingState(), {
        resolveNPC: () => ({ profile: profile(reaction), memory }),
        gameState,
      })
      expect(mockInteract).not.toHaveBeenCalled()
    }
  })

  it("deduplicates repeated DETECTED events until LOST_SIGHT resets the pair", async () => {
    const state = createSightingState()
    const deps = {
      resolveNPC: () => ({ profile: profile("exclamation"), memory }),
      gameState,
    }

    await processVisionEvents([event()], state, deps)
    await processVisionEvents([event()], state, deps)
    await processVisionEvents([event("LOST_SIGHT")], state, deps)
    await processVisionEvents([event()], state, deps)

    expect(mockInteract).toHaveBeenCalledTimes(2)
  })

  it("skips events when resolveNPC returns null", async () => {
    const interactions = await processVisionEvents([event()], createSightingState(), {
      resolveNPC: () => null,
      gameState,
    })

    expect(mockInteract).not.toHaveBeenCalled()
    expect(interactions).toEqual([])
  })

  it("returns interaction results with npc and target ids", async () => {
    const interactions = await processVisionEvents([event()], createSightingState(), {
      resolveNPC: () => ({ profile: profile("exclamation"), memory }),
      gameState,
    })

    expect(interactions).toEqual([
      {
        npcId: "npc_test",
        targetId: "player",
        result: expect.objectContaining({ responseText: "I saw you!" }),
      },
    ])
  })
})
