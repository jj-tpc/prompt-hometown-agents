import { TILE_DEFINITIONS } from "@/game-core/map/tile-definitions"
import type { TileMap } from "@/game-core/types/map"

export function isTileTransparent(map: TileMap, x: number, y: number): boolean {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return false

  for (const layer of map.layers) {
    if (layer.name === "overlay") continue

    const tileType = layer.tiles[y]?.[x]
    if (tileType == null) continue
    if (!TILE_DEFINITIONS[tileType].transparent) return false
  }

  return true
}

export function hasLineOfSight(
  map: TileMap,
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean {
  if (from.x === to.x && from.y === to.y) return true
  if (
    from.x < 0 ||
    from.x >= map.width ||
    from.y < 0 ||
    from.y >= map.height ||
    to.x < 0 ||
    to.x >= map.width ||
    to.y < 0 ||
    to.y >= map.height
  ) {
    return false
  }

  let x = from.x
  let y = from.y
  const dx = Math.abs(to.x - x)
  const dy = Math.abs(to.y - y)
  const sx = x < to.x ? 1 : -1
  const sy = y < to.y ? 1 : -1
  let err = dx - dy

  while (x !== to.x || y !== to.y) {
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x += sx
    }
    if (e2 < dx) {
      err += dx
      y += sy
    }

    if (x === to.x && y === to.y) break
    if (!isTileTransparent(map, x, y)) return false
  }

  return true
}
