import { TILE_DEFINITIONS } from "@/game-core/map/tile-definitions"
import type { TileMap } from "@/game-core/types/map"

export function isCellBlocked(map: TileMap, x: number, y: number): boolean {
  return map.blockedCells?.some((cell) => cell.x === x && cell.y === y) ?? false
}

export function isCellWalkable(map: TileMap, x: number, y: number): boolean {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return false
  if (isCellBlocked(map, x, y)) return false

  for (const layer of map.layers) {
    if (layer.name === "overlay") continue

    const tile = layer.tiles[y]?.[x]
    if (tile == null) continue
    if (!TILE_DEFINITIONS[tile].walkable) return false
  }

  return true
}

function isStairs(map: TileMap, x: number, y: number): boolean {
  const objectLayer = map.layers.find((layer) => layer.name === "object")
  return objectLayer?.tiles[y]?.[x] === "stairs"
}

export function canTraverse(
  map: TileMap,
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean {
  const manhattanDistance = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
  if (manhattanDistance !== 1) return false
  if (!isCellWalkable(map, from.x, from.y)) return false
  if (!isCellWalkable(map, to.x, to.y)) return false

  const fromElevation = map.elevation[from.y][from.x]
  const toElevation = map.elevation[to.y][to.x]
  const elevationDifference = Math.abs(fromElevation - toElevation)

  if (elevationDifference === 0) return true
  if (elevationDifference === 1) {
    return isStairs(map, from.x, from.y) || isStairs(map, to.x, to.y)
  }

  return false
}
