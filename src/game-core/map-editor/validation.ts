import { TILE_DEFINITIONS } from "@/game-core/map/tile-definitions"
import { isCellWalkable } from "@/game-core/map/traversal"
import { loadMap } from "@/game-core/map/loader"
import { SPRITE_ATLAS } from "@/game-core/render/terrain-tiles"
import type { LayerName, TileMap, TileType } from "@/game-core/types/map"

export type MapEditorIssueLevel = "error" | "warning"

export type MapEditorIssue = {
  level: MapEditorIssueLevel
  message: string
  x?: number
  y?: number
  layer?: LayerName
}

function isKnownTile(value: unknown): value is TileType {
  return typeof value === "string" && value in TILE_DEFINITIONS
}

function pushLoadMapIssue(issues: MapEditorIssue[], map: TileMap): void {
  try {
    loadMap(map)
  } catch (error) {
    issues.push({
      level: "error",
      message: error instanceof Error ? error.message : "Invalid TileMap",
    })
  }
}

function validateDimensions(issues: MapEditorIssue[], map: TileMap): void {
  for (const layer of map.layers) {
    if (layer.tiles.length !== map.height) {
      issues.push({
        level: "error",
        message: `${layer.name} layer must have ${map.height} rows`,
        layer: layer.name,
      })
      continue
    }

    layer.tiles.forEach((row, y) => {
      if (row.length !== map.width) {
        issues.push({
          level: "error",
          message: `${layer.name} row ${y} must have ${map.width} columns`,
          y,
          layer: layer.name,
        })
      }
    })
  }

  if (map.elevation.length !== map.height) {
    issues.push({ level: "error", message: `Elevation must have ${map.height} rows` })
    return
  }

  map.elevation.forEach((row, y) => {
    if (row.length !== map.width) {
      issues.push({
        level: "error",
        message: `Elevation row ${y} must have ${map.width} columns`,
        y,
      })
    }
  })
}

function validateTiles(issues: MapEditorIssue[], map: TileMap): void {
  for (const layer of map.layers) {
    layer.tiles.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (tile == null) return
        if (!isKnownTile(tile)) {
          issues.push({
            level: "error",
            message: `Unknown tile type: ${String(tile)}`,
            x,
            y,
            layer: layer.name,
          })
          return
        }

        const spriteId = TILE_DEFINITIONS[tile].spriteId
        if (!SPRITE_ATLAS[spriteId]) {
          issues.push({
            level: "warning",
            message: `Missing sprite: ${spriteId}`,
            x,
            y,
            layer: layer.name,
          })
        }
      })
    })
  }
}

function validateSpawns(issues: MapEditorIssue[], map: TileMap): void {
  const playerSpawns = map.spawnPoints.filter((spawn) => spawn.entityType === "player")
  if (playerSpawns.length === 0) {
    issues.push({ level: "error", message: "Missing player spawn" })
  } else if (playerSpawns.length > 1) {
    issues.push({ level: "warning", message: "More than one player spawn" })
  }

  for (const spawn of map.spawnPoints) {
    if (spawn.x < 0 || spawn.x >= map.width || spawn.y < 0 || spawn.y >= map.height) {
      issues.push({
        level: "error",
        message: `Spawn ${spawn.id} is out of bounds`,
        x: spawn.x,
        y: spawn.y,
      })
      continue
    }

    if (!isCellWalkable(map, spawn.x, spawn.y)) {
      issues.push({
        level: "warning",
        message: `Spawn ${spawn.id} is on a non-walkable cell`,
        x: spawn.x,
        y: spawn.y,
      })
    }
  }
}

export function validateMapForEditing(map: TileMap): MapEditorIssue[] {
  const issues: MapEditorIssue[] = []
  pushLoadMapIssue(issues, map)
  validateDimensions(issues, map)
  validateTiles(issues, map)
  validateSpawns(issues, map)
  return issues
}

