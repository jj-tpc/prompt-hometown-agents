import type { VisionEvent, VisionResult } from "@/game-core/types/map"

type DetectedEntity = VisionResult["detectedEntities"][number]

function byEntityId(result: VisionResult): Map<string, DetectedEntity> {
  return new Map(result.detectedEntities.map((entity) => [entity.entityId, entity]))
}

export function diffVisionResults(
  npcId: string,
  previous: VisionResult,
  current: VisionResult,
  timestamp: number
): VisionEvent[] {
  const previousById = byEntityId(previous)
  const currentById = byEntityId(current)
  const events: VisionEvent[] = []

  for (const [entityId, entity] of currentById) {
    if (previousById.has(entityId)) continue

    events.push({
      type: "DETECTED",
      npcId,
      targetId: entityId,
      targetPosition: entity.position,
      distance: entity.distance,
      timestamp,
    })
  }

  for (const [entityId, entity] of previousById) {
    if (currentById.has(entityId)) continue

    events.push({
      type: "LOST_SIGHT",
      npcId,
      targetId: entityId,
      targetPosition: entity.position,
      distance: entity.distance,
      timestamp,
    })
  }

  return events
}

export const emitVisionEvents = diffVisionResults
