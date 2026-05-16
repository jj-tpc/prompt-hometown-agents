import type {
  ConeVision,
  Direction,
  LinearVision,
  NPCVisionProfile,
  RadiusVision,
  TileMap,
  VisionConfig,
  VisionResult,
} from "@/game-core/types/map"
import { hasLineOfSight, isTileTransparent } from "@/game-core/vision/line-of-sight"

export type VisionEntity = {
  id: string
  type: "player" | "npc" | "item"
  position: { x: number; y: number }
}

const DEFAULT_PROXIMITY_RANGE = 1

export function computeVision(
  npcPosition: { x: number; y: number },
  visionProfile: NPCVisionProfile,
  map: TileMap,
  entities: VisionEntity[]
): VisionResult {
  const base = computeByConfig(npcPosition, visionProfile.visionConfig, map, entities)
  const proximityRange = visionProfile.proximityRange ?? DEFAULT_PROXIMITY_RANGE

  return applyProximity(npcPosition, proximityRange, base, entities)
}

function computeByConfig(
  npcPosition: { x: number; y: number },
  visionConfig: VisionConfig,
  map: TileMap,
  entities: VisionEntity[]
): VisionResult {
  switch (visionConfig.type) {
    case "linear":
      return computeLinear(npcPosition, visionConfig, map, entities)
    case "cone":
      return computeCone(npcPosition, visionConfig, map, entities)
    case "radius":
      return computeRadius(npcPosition, visionConfig, map, entities)
  }
}

function applyProximity(
  npcPosition: { x: number; y: number },
  proximityRange: number,
  base: VisionResult,
  entities: VisionEntity[]
): VisionResult {
  const detectedEntities = [...base.detectedEntities]
  const seen = new Set(detectedEntities.map((entity) => entity.entityId))

  for (const entity of entities) {
    if (seen.has(entity.id)) continue

    const dx = entity.position.x - npcPosition.x
    const dy = entity.position.y - npcPosition.y
    const chebyshevDistance = Math.max(Math.abs(dx), Math.abs(dy))
    if (chebyshevDistance === 0 || chebyshevDistance > proximityRange) continue

    detectedEntities.push({
      entityId: entity.id,
      entityType: entity.type,
      position: entity.position,
      distance: Math.hypot(dx, dy),
      hasLOS: true,
    })
    seen.add(entity.id)
  }

  return {
    detectedEntities,
    visibleTilePositions: base.visibleTilePositions,
  }
}

function directionDelta(facing: Direction): { dx: number; dy: number } {
  switch (facing) {
    case "right":
      return { dx: 1, dy: 0 }
    case "left":
      return { dx: -1, dy: 0 }
    case "down":
      return { dx: 0, dy: 1 }
    case "up":
      return { dx: 0, dy: -1 }
  }
}

function addEntityAtTile(
  detectedEntities: VisionResult["detectedEntities"],
  entities: VisionEntity[],
  x: number,
  y: number,
  distance: number
): void {
  for (const entity of entities) {
    if (entity.position.x !== x || entity.position.y !== y) continue
    if (detectedEntities.some((detected) => detected.entityId === entity.id)) continue

    detectedEntities.push({
      entityId: entity.id,
      entityType: entity.type,
      position: entity.position,
      distance,
      hasLOS: true,
    })
  }
}

function computeLinear(
  npcPosition: { x: number; y: number },
  config: LinearVision,
  map: TileMap,
  entities: VisionEntity[]
): VisionResult {
  const delta = directionDelta(config.facing)
  const detectedEntities: VisionResult["detectedEntities"] = []
  const visibleTilePositions: VisionResult["visibleTilePositions"] = []

  for (let distance = 1; distance <= config.range; distance++) {
    const x = npcPosition.x + delta.dx * distance
    const y = npcPosition.y + delta.dy * distance

    if (x < 0 || x >= map.width || y < 0 || y >= map.height) break
    if (!isTileTransparent(map, x, y)) break

    visibleTilePositions.push({ x, y })
    addEntityAtTile(detectedEntities, entities, x, y, distance)
  }

  return { detectedEntities, visibleTilePositions }
}

function directionToAngleDeg(facing: Direction): number {
  switch (facing) {
    case "right":
      return 0
    case "down":
      return 90
    case "left":
      return 180
    case "up":
      return -90
  }
}

function angleDiffDeg(a: number, b: number): number {
  let diff = a - b
  while (diff > 180) diff -= 360
  while (diff < -180) diff += 360
  return Math.abs(diff)
}

function computeCone(
  npcPosition: { x: number; y: number },
  config: ConeVision,
  map: TileMap,
  entities: VisionEntity[]
): VisionResult {
  const facingAngle = directionToAngleDeg(config.facing)
  const detectedEntities: VisionResult["detectedEntities"] = []
  const visibleTilePositions: VisionResult["visibleTilePositions"] = []
  const minX = Math.max(0, npcPosition.x - config.range)
  const maxX = Math.min(map.width - 1, npcPosition.x + config.range)
  const minY = Math.max(0, npcPosition.y - config.range)
  const maxY = Math.min(map.height - 1, npcPosition.y + config.range)

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x === npcPosition.x && y === npcPosition.y) continue

      const distance = Math.hypot(x - npcPosition.x, y - npcPosition.y)
      if (distance > config.range) continue

      const tileAngle = Math.atan2(y - npcPosition.y, x - npcPosition.x) * (180 / Math.PI)
      if (angleDiffDeg(tileAngle, facingAngle) > config.halfAngle) continue
      if (!hasLineOfSight(map, npcPosition, { x, y })) continue

      visibleTilePositions.push({ x, y })
      addEntityAtTile(detectedEntities, entities, x, y, distance)
    }
  }

  return { detectedEntities, visibleTilePositions }
}

function computeRadius(
  npcPosition: { x: number; y: number },
  config: RadiusVision,
  map: TileMap,
  entities: VisionEntity[]
): VisionResult {
  const detectedEntities: VisionResult["detectedEntities"] = []
  const visibleTilePositions: VisionResult["visibleTilePositions"] = []
  const minX = Math.max(0, npcPosition.x - config.range)
  const maxX = Math.min(map.width - 1, npcPosition.x + config.range)
  const minY = Math.max(0, npcPosition.y - config.range)
  const maxY = Math.min(map.height - 1, npcPosition.y + config.range)

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x === npcPosition.x && y === npcPosition.y) continue

      const distance = Math.hypot(x - npcPosition.x, y - npcPosition.y)
      if (distance > config.range) continue
      if (!hasLineOfSight(map, npcPosition, { x, y })) continue

      visibleTilePositions.push({ x, y })
      addEntityAtTile(detectedEntities, entities, x, y, distance)
    }
  }

  return { detectedEntities, visibleTilePositions }
}
