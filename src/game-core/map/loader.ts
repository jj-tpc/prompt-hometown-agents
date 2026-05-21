import { TILE_DEFINITIONS } from "@/game-core/map/tile-definitions"
import type { Direction, LayerName, TileMap, TileType } from "@/game-core/types/map"

const LAYER_NAMES: LayerName[] = ["ground", "decoration", "object", "overlay"]
const BIOMES = ["village", "forest", "beach", "mountain", "cave", "indoor"] as const
const WEATHER = ["clear", "rain", "snow"] as const
const DIRECTIONS: Direction[] = ["up", "down", "left", "right"]

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0
}

function hasAllTopLevelFields(value: Record<string, unknown>): boolean {
  return [
    "meta",
    "width",
    "height",
    "tileSize",
    "layers",
    "elevation",
    "spawnPoints",
    "transitions",
  ].every((key) => key in value)
}

function assertMeta(meta: unknown): void {
  if (!isObject(meta)) throw new Error("Invalid TileMap: meta must be an object")
  if (typeof meta.id !== "string" || typeof meta.name !== "string") {
    throw new Error("Invalid TileMap: meta.id and meta.name must be strings")
  }
  if (!BIOMES.includes(meta.biome as (typeof BIOMES)[number])) {
    throw new Error("Invalid TileMap: meta.biome")
  }
  if (meta.weather !== undefined && !WEATHER.includes(meta.weather as (typeof WEATHER)[number])) {
    throw new Error("Invalid TileMap: meta.weather")
  }
}

function assertBounds(
  label: string,
  x: unknown,
  y: unknown,
  width: number,
  height: number
): void {
  if (
    !isNonNegativeInteger(x) ||
    !isNonNegativeInteger(y) ||
    x >= width ||
    y >= height
  ) {
    throw new Error(`Invalid TileMap: ${label} is out of bounds`)
  }
}

function isTileType(value: unknown): value is TileType {
  return typeof value === "string" && value in TILE_DEFINITIONS
}

function assertLayers(layers: unknown, width: number, height: number): void {
  if (!Array.isArray(layers)) throw new Error("Invalid TileMap: layers must be an array")
  if (layers.length !== LAYER_NAMES.length) {
    throw new Error("Invalid TileMap: layers must contain exactly 4 layers")
  }

  layers.forEach((layer, layerIndex) => {
    if (!isObject(layer)) throw new Error(`Invalid TileMap: layer[${layerIndex}] must be an object`)
    const expectedName = LAYER_NAMES[layerIndex]
    if (layer.name !== expectedName) {
      throw new Error(`Invalid TileMap: layer[${layerIndex}].name must be "${expectedName}"`)
    }
    if (!Array.isArray(layer.tiles)) {
      throw new Error(`Invalid TileMap: layer[${layerIndex}].tiles must be an array`)
    }
    if (layer.tiles.length !== height) {
      throw new Error(`Invalid TileMap: layer[${layerIndex}].tiles must have ${height} rows`)
    }

    layer.tiles.forEach((row, y) => {
      if (!Array.isArray(row) || row.length !== width) {
        throw new Error(`Invalid TileMap: layer[${layerIndex}].tiles[${y}] must have ${width} columns`)
      }
      row.forEach((tile, x) => {
        if (tile !== null && !isTileType(tile)) {
          throw new Error(
            `Invalid TileMap: layer[${layerIndex}].tiles[${y}][${x}] is not a valid TileType`
          )
        }
      })
    })
  })
}

function assertElevation(elevation: unknown, width: number, height: number): void {
  if (!Array.isArray(elevation) || elevation.length !== height) {
    throw new Error(`Invalid TileMap: elevation must have ${height} rows`)
  }

  elevation.forEach((row, y) => {
    if (!Array.isArray(row) || row.length !== width) {
      throw new Error(`Invalid TileMap: elevation[${y}] must have ${width} columns`)
    }
    row.forEach((value, x) => {
      if (!Number.isInteger(value)) {
        throw new Error(`Invalid TileMap: elevation[${y}][${x}] must be an integer`)
      }
    })
  })
}

function assertSpriteOverrides(overrides: unknown, width: number, height: number): void {
  if (overrides === undefined) return
  if (!Array.isArray(overrides)) {
    throw new Error("Invalid TileMap: spriteOverrides must be an array")
  }

  overrides.forEach((override, index) => {
    if (!isObject(override)) {
      throw new Error(`Invalid TileMap: spriteOverrides[${index}] must be an object`)
    }
    if (!LAYER_NAMES.includes(override.layer as LayerName)) {
      throw new Error(`Invalid TileMap: spriteOverrides[${index}].layer must be a valid layer`)
    }
    if (
      override.baseTile !== undefined &&
      override.baseTile !== null &&
      !isTileType(override.baseTile)
    ) {
      throw new Error(`Invalid TileMap: spriteOverrides[${index}].baseTile must be a valid TileType`)
    }
    assertBounds(`spriteOverrides[${index}]`, override.x, override.y, width, height)
    if (typeof override.atlasId !== "string") {
      throw new Error(`Invalid TileMap: spriteOverrides[${index}].atlasId must be a string`)
    }
    for (const key of ["sx", "sy", "sw", "sh"] as const) {
      if (!isNonNegativeInteger(override[key])) {
        throw new Error(`Invalid TileMap: spriteOverrides[${index}].${key} must be an integer`)
      }
    }
    if (override.sw === 0 || override.sh === 0) {
      throw new Error(`Invalid TileMap: spriteOverrides[${index}] must have positive size`)
    }
  })
}

function assertBlockedCells(blockedCells: unknown, width: number, height: number): void {
  if (blockedCells === undefined) return
  if (!Array.isArray(blockedCells)) {
    throw new Error("Invalid TileMap: blockedCells must be an array")
  }

  blockedCells.forEach((cell, index) => {
    if (!isObject(cell)) {
      throw new Error(`Invalid TileMap: blockedCells[${index}] must be an object`)
    }
    assertBounds(`blockedCells[${index}]`, cell.x, cell.y, width, height)
  })
}

function assertDirection(label: string, value: unknown): void {
  if (!DIRECTIONS.includes(value as Direction)) {
    throw new Error(`Invalid TileMap: ${label} must be a valid direction`)
  }
}

function assertSpawnPoints(spawnPoints: unknown, width: number, height: number): void {
  if (!Array.isArray(spawnPoints)) {
    throw new Error("Invalid TileMap: spawnPoints must be an array")
  }

  spawnPoints.forEach((spawnPoint, index) => {
    if (!isObject(spawnPoint)) {
      throw new Error(`Invalid TileMap: spawnPoints[${index}] must be an object`)
    }
    if (typeof spawnPoint.id !== "string") {
      throw new Error(`Invalid TileMap: spawnPoints[${index}].id must be a string`)
    }
    assertBounds(`spawnPoints[${index}]`, spawnPoint.x, spawnPoint.y, width, height)
    assertDirection(`spawnPoints[${index}].facing`, spawnPoint.facing)
    if (spawnPoint.entityType !== "player" && spawnPoint.entityType !== "npc") {
      throw new Error(`Invalid TileMap: spawnPoints[${index}].entityType`)
    }
    if (spawnPoint.entityType === "npc" && typeof spawnPoint.npcId !== "string") {
      throw new Error(`Invalid TileMap: spawnPoints[${index}].npcId must be a string`)
    }
  })
}

function assertTransitions(transitions: unknown, width: number, height: number): void {
  if (!Array.isArray(transitions)) {
    throw new Error("Invalid TileMap: transitions must be an array")
  }

  transitions.forEach((transition, index) => {
    if (!isObject(transition)) {
      throw new Error(`Invalid TileMap: transitions[${index}] must be an object`)
    }
    assertBounds(`transitions[${index}]`, transition.x, transition.y, width, height)
    if (typeof transition.targetMapId !== "string") {
      throw new Error(`Invalid TileMap: transitions[${index}].targetMapId must be a string`)
    }
    if (!isNonNegativeInteger(transition.targetX) || !isNonNegativeInteger(transition.targetY)) {
      throw new Error(`Invalid TileMap: transitions[${index}].target is out of bounds`)
    }
    assertDirection(`transitions[${index}].facing`, transition.facing)
  })
}

export function loadMap(input: unknown): TileMap {
  if (!isObject(input)) throw new Error("Invalid TileMap: not an object")
  if (!hasAllTopLevelFields(input)) {
    throw new Error("Invalid TileMap: missing required fields")
  }
  if (!isPositiveInteger(input.width)) {
    throw new Error("Invalid TileMap: width must be a positive integer")
  }
  if (!isPositiveInteger(input.height)) {
    throw new Error("Invalid TileMap: height must be a positive integer")
  }
  if (input.tileSize !== 16) throw new Error("Invalid TileMap: tileSize must be 16")

  assertMeta(input.meta)
  assertLayers(input.layers, input.width, input.height)
  assertElevation(input.elevation, input.width, input.height)
  assertSpriteOverrides(input.spriteOverrides, input.width, input.height)
  assertBlockedCells(input.blockedCells, input.width, input.height)
  assertSpawnPoints(input.spawnPoints, input.width, input.height)
  assertTransitions(input.transitions, input.width, input.height)

  return input as TileMap
}
