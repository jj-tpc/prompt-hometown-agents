import type { VisionResult } from "@/game-core/types/map"
import { diffVisionResults } from "@/game-core/vision/vision-event-emitter"

function result(entityIds: string[]): VisionResult {
  return {
    detectedEntities: entityIds.map((id, index) => ({
      entityId: id,
      entityType: "player",
      position: { x: index + 1, y: index + 2 },
      distance: index + 3,
      hasLOS: true,
    })),
    visibleTilePositions: [],
  }
}

describe("diffVisionResults", () => {
  it("emits DETECTED for newly visible entities", () => {
    const events = diffVisionResults("npc_1", result([]), result(["player"]), 100)

    expect(events).toEqual([
      expect.objectContaining({
        type: "DETECTED",
        npcId: "npc_1",
        targetId: "player",
        targetPosition: { x: 1, y: 2 },
        distance: 3,
        timestamp: 100,
      }),
    ])
  })

  it("emits LOST_SIGHT for entities that disappeared", () => {
    const events = diffVisionResults("npc_1", result(["player"]), result([]), 101)

    expect(events).toEqual([
      expect.objectContaining({
        type: "LOST_SIGHT",
        npcId: "npc_1",
        targetId: "player",
        targetPosition: { x: 1, y: 2 },
        distance: 3,
        timestamp: 101,
      }),
    ])
  })

  it("does not emit events for stable sightings", () => {
    expect(diffVisionResults("npc_1", result(["player"]), result(["player"]), 102)).toEqual([])
  })

  it("emits both lost and detected changes in a single diff", () => {
    const events = diffVisionResults("npc_1", result(["old", "stable"]), result(["stable", "new"]), 103)

    expect(events.map((event) => `${event.type}:${event.targetId}`).sort()).toEqual([
      "DETECTED:new",
      "LOST_SIGHT:old",
    ])
  })
})
