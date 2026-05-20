import { canTraverse, isCellWalkable } from "@/game-core/map/traversal"
import type { Direction, TileMap, TileType } from "@/game-core/types/map"
import { DIRECTION_DELTAS, type GridPosition } from "@/game-core/game-loop/world-interaction"

export type NpcDestinationKind = "house" | "forest" | "sand" | "waterfront" | "grass"

export type NpcDestinationPlan =
  | {
      ok: true
      destination: GridPosition
      anchor: GridPosition
      destinationKind: NpcDestinationKind
      label: string
      path: GridPosition[]
      responseText: string
    }
  | {
      ok: false
      destinationKind: NpcDestinationKind
      responseText: string
    }

export type NpcWanderStep =
  | { moved: true; position: GridPosition; facing: Direction; path?: GridPosition[] }
  | { moved: false }

const DESTINATION_LABELS: Record<NpcDestinationKind, string> = {
  house: "집 주변",
  forest: "숲 근처",
  sand: "모래 지형",
  waterfront: "물가",
  grass: "잔디밭",
}

const DIRECTION_ORDER: Direction[] = ["down", "right", "left", "up"]

function positionKey(position: GridPosition): string {
  return `${position.x}:${position.y}`
}

function samePosition(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y
}

function manhattanDistance(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function inBounds(map: TileMap, x: number, y: number): boolean {
  return x >= 0 && x < map.width && y >= 0 && y < map.height
}

function tileAt(map: TileMap, layerName: string, x: number, y: number): TileType | null {
  return map.layers.find((layer) => layer.name === layerName)?.tiles[y]?.[x] ?? null
}

function anyLayerTileAt(map: TileMap, x: number, y: number): TileType[] {
  return map.layers
    .map((layer) => layer.tiles[y]?.[x] ?? null)
    .filter((tile): tile is TileType => tile != null)
}

function neighbors(position: GridPosition): Array<GridPosition & { direction: Direction }> {
  return DIRECTION_ORDER.map((direction) => ({
    direction,
    x: position.x + DIRECTION_DELTAS[direction].x,
    y: position.y + DIRECTION_DELTAS[direction].y,
  }))
}

function directionBetween(from: GridPosition, to: GridPosition): Direction {
  if (to.x > from.x) return "right"
  if (to.x < from.x) return "left"
  if (to.y < from.y) return "up"
  return "down"
}

function occupiedKeySet(occupied: GridPosition[], ignored: GridPosition[]): Set<string> {
  const ignoredKeys = new Set(ignored.map(positionKey))
  return new Set(
    occupied
      .map(positionKey)
      .filter((key) => !ignoredKeys.has(key))
  )
}

function isHouseCandidate(map: TileMap, x: number, y: number): boolean {
  const tiles = anyLayerTileAt(map, x, y)
  if (tiles.includes("building_floor") || tiles.includes("door")) return true

  return neighbors({ x, y }).some((neighbor) => {
    if (!inBounds(map, neighbor.x, neighbor.y)) return false
    const nearbyTiles = anyLayerTileAt(map, neighbor.x, neighbor.y)
    return (
      nearbyTiles.includes("building_wall") ||
      nearbyTiles.includes("roof") ||
      nearbyTiles.includes("door")
    )
  })
}

function isForestCandidate(map: TileMap, x: number, y: number): boolean {
  return neighbors({ x, y }).some((neighbor) => {
    if (!inBounds(map, neighbor.x, neighbor.y)) return false
    const nearbyTiles = anyLayerTileAt(map, neighbor.x, neighbor.y)
    return (
      nearbyTiles.includes("tree") ||
      nearbyTiles.includes("bush") ||
      nearbyTiles.includes("tall_grass")
    )
  })
}

function isWaterfrontCandidate(map: TileMap, x: number, y: number): boolean {
  return neighbors({ x, y }).some((neighbor) => {
    if (!inBounds(map, neighbor.x, neighbor.y)) return false
    const groundTile = tileAt(map, "ground", neighbor.x, neighbor.y)
    return groundTile === "water" || groundTile === "shallow_water"
  })
}

function matchesDestinationKind(map: TileMap, kind: NpcDestinationKind, x: number, y: number): boolean {
  if (!isCellWalkable(map, x, y)) return false

  const groundTile = tileAt(map, "ground", x, y)
  switch (kind) {
    case "house":
      return isHouseCandidate(map, x, y)
    case "forest":
      return isForestCandidate(map, x, y)
    case "sand":
      return groundTile === "sand"
    case "waterfront":
      return isWaterfrontCandidate(map, x, y)
    case "grass":
      return groundTile === "grass"
  }
}

function findPathToNearest(
  map: TileMap,
  start: GridPosition,
  occupied: GridPosition[],
  matches: (position: GridPosition) => boolean
): GridPosition[] | null {
  if (!inBounds(map, start.x, start.y) || !isCellWalkable(map, start.x, start.y)) return null

  const blocked = occupiedKeySet(occupied, [start])
  const queue: GridPosition[] = [start]
  const visited = new Set([positionKey(start)])
  const previous = new Map<string, GridPosition>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (!samePosition(current, start) && matches(current)) {
      const path: GridPosition[] = []
      let cursor = current
      while (!samePosition(cursor, start)) {
        path.unshift(cursor)
        cursor = previous.get(positionKey(cursor))!
      }
      return path
    }

    for (const next of neighbors(current)) {
      if (!inBounds(map, next.x, next.y)) continue
      const key = positionKey(next)
      if (visited.has(key) || blocked.has(key)) continue
      if (!canTraverse(map, current, next)) continue
      visited.add(key)
      previous.set(key, current)
      queue.push({ x: next.x, y: next.y })
    }
  }

  return null
}

export function planNpcDestination(input: {
  map: TileMap
  npcId: string
  start: GridPosition
  occupiedPositions: GridPosition[]
  destinationKind: NpcDestinationKind
}): NpcDestinationPlan {
  const label = DESTINATION_LABELS[input.destinationKind]
  const path = findPathToNearest(
    input.map,
    input.start,
    input.occupiedPositions,
    (position) => matchesDestinationKind(input.map, input.destinationKind, position.x, position.y)
  )

  if (!path || path.length === 0) {
    return {
      ok: false,
      destinationKind: input.destinationKind,
      responseText: `${input.npcId}에게 ${label}로 이동하라고 지시했지만, 지금 갈 수 있는 경로를 찾지 못했어.`,
    }
  }

  const destination = path[path.length - 1]
  return {
    ok: true,
    destination,
    anchor: destination,
    destinationKind: input.destinationKind,
    label,
    path,
    responseText: `${input.npcId}에게 ${label}로 이동하라고 지시했어. 이동 가능한 경로가 확인되어 바로 움직이기 시작한다.`,
  }
}

export function nextNpcPathStep(input: {
  path: GridPosition[]
  position: GridPosition
}): NpcWanderStep {
  const [next, ...remaining] = input.path
  if (!next) return { moved: false }
  return {
    moved: true,
    position: next,
    facing: directionBetween(input.position, next),
    path: remaining,
  }
}

export function nextNpcWanderStep(input: {
  map: TileMap
  position: GridPosition
  anchor: GridPosition
  radius: number
  occupiedPositions: GridPosition[]
  tick: number
}): NpcWanderStep {
  const candidates = neighbors(input.position)
    .map((neighbor) => ({ x: neighbor.x, y: neighbor.y, direction: neighbor.direction }))
    .filter((neighbor) => {
      if (!inBounds(input.map, neighbor.x, neighbor.y)) return false
      if (manhattanDistance(input.anchor, neighbor) > input.radius) return false
      if (occupiedKeySet(input.occupiedPositions, [input.position]).has(positionKey(neighbor))) return false
      return canTraverse(input.map, input.position, neighbor)
    })

  if (candidates.length === 0) return { moved: false }

  const index = Math.abs(input.anchor.x * 31 + input.anchor.y * 17 + input.tick) % candidates.length
  const next = candidates[index]
  return {
    moved: true,
    position: { x: next.x, y: next.y },
    facing: next.direction,
  }
}
