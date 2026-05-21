import type {
  LayerName,
  SpawnPoint,
  TileLayer,
  TileMap,
  TileSpriteOverride,
  TileType,
} from "@/game-core/types/map"

const MIN_ELEVATION = 0
const MAX_ELEVATION = 3

function isInBounds(map: TileMap, x: number, y: number): boolean {
  return x >= 0 && x < map.width && y >= 0 && y < map.height
}

function cloneLayerWithCell(
  layer: TileLayer,
  x: number,
  y: number,
  tile: TileType | null
): TileLayer {
  return {
    ...layer,
    tiles: layer.tiles.map((row, rowIndex) =>
      rowIndex === y ? row.map((cell, colIndex) => (colIndex === x ? tile : cell)) : row
    ),
  }
}

function updateLayerCell(
  map: TileMap,
  layerName: LayerName,
  x: number,
  y: number,
  tile: TileType | null
): TileMap {
  if (!isInBounds(map, x, y)) return map

  const layerIndex = map.layers.findIndex((layer) => layer.name === layerName)
  if (layerIndex < 0) return map

  const current = map.layers[layerIndex].tiles[y]?.[x]
  if (current === tile) return map

  return {
    ...map,
    layers: map.layers.map((layer, index) =>
      index === layerIndex ? cloneLayerWithCell(layer, x, y, tile) : layer
    ),
  }
}

function clampElevation(value: number): number {
  if (!Number.isFinite(value)) return MIN_ELEVATION
  return Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, Math.round(value)))
}

export function paintTile(
  map: TileMap,
  layer: LayerName,
  x: number,
  y: number,
  tile: TileType
): TileMap {
  return clearSpriteOverride(updateLayerCell(map, layer, x, y, tile), layer, x, y)
}

export function eraseTile(map: TileMap, layer: LayerName, x: number, y: number): TileMap {
  return clearSpriteOverride(
    updateLayerCell(map, layer, x, y, layer === "ground" ? "grass" : null),
    layer,
    x,
    y
  )
}

export function setSpriteOverride(map: TileMap, override: TileSpriteOverride): TileMap {
  if (!isInBounds(map, override.x, override.y)) return map
  if (!map.layers.some((layer) => layer.name === override.layer)) return map

  const currentOverrides = map.spriteOverrides ?? []
  const withoutCell = currentOverrides.filter(
    (entry) =>
      entry.layer !== override.layer || entry.x !== override.x || entry.y !== override.y
  )
  const nextOverride: TileSpriteOverride = {
    ...override,
    sx: Math.max(0, Math.floor(override.sx)),
    sy: Math.max(0, Math.floor(override.sy)),
    sw: Math.max(1, Math.floor(override.sw)),
    sh: Math.max(1, Math.floor(override.sh)),
  }

  return { ...map, spriteOverrides: [...withoutCell, nextOverride] }
}

export function clearSpriteOverride(
  map: TileMap,
  layer: LayerName,
  x: number,
  y: number
): TileMap {
  const currentOverrides = map.spriteOverrides ?? []
  const nextOverrides = currentOverrides.filter(
    (entry) => entry.layer !== layer || entry.x !== x || entry.y !== y
  )
  if (nextOverrides.length === currentOverrides.length) return map
  return { ...map, spriteOverrides: nextOverrides.length > 0 ? nextOverrides : undefined }
}

export function setElevation(map: TileMap, x: number, y: number, elevation: number): TileMap {
  if (!isInBounds(map, x, y)) return map

  const nextElevation = clampElevation(elevation)
  if (map.elevation[y]?.[x] === nextElevation) return map

  return {
    ...map,
    elevation: map.elevation.map((row, rowIndex) =>
      rowIndex === y
        ? row.map((cell, colIndex) => (colIndex === x ? nextElevation : cell))
        : row
    ),
  }
}

export function setCellBlocked(
  map: TileMap,
  x: number,
  y: number,
  blocked: boolean
): TileMap {
  if (!isInBounds(map, x, y)) return map

  const currentCells = map.blockedCells ?? []
  const exists = currentCells.some((cell) => cell.x === x && cell.y === y)
  if (blocked && exists) return map
  if (!blocked && !exists) return map

  if (blocked) {
    return {
      ...map,
      blockedCells: [...currentCells, { x, y }].sort((a, b) => a.y - b.y || a.x - b.x),
    }
  }

  const nextCells = currentCells.filter((cell) => cell.x !== x || cell.y !== y)
  return { ...map, blockedCells: nextCells.length > 0 ? nextCells : undefined }
}

export function moveSpawn(map: TileMap, spawnId: string, x: number, y: number): TileMap {
  if (!isInBounds(map, x, y)) return map
  if (!map.spawnPoints.some((spawn) => spawn.id === spawnId)) return map

  return {
    ...map,
    spawnPoints: map.spawnPoints.map((spawn) =>
      spawn.id === spawnId ? { ...spawn, x, y } : spawn
    ),
  }
}

export function upsertNpcSpawn(map: TileMap, spawn: SpawnPoint): TileMap {
  if (spawn.entityType !== "npc") return map
  if (!isInBounds(map, spawn.x, spawn.y)) return map
  if (!spawn.npcId) return map

  const exists = map.spawnPoints.some((current) => current.id === spawn.id)
  return {
    ...map,
    spawnPoints: exists
      ? map.spawnPoints.map((current) => (current.id === spawn.id ? { ...spawn } : current))
      : [...map.spawnPoints, { ...spawn }],
  }
}

export function removeSpawn(map: TileMap, spawnId: string): TileMap {
  if (!map.spawnPoints.some((spawn) => spawn.id === spawnId)) return map
  return {
    ...map,
    spawnPoints: map.spawnPoints.filter((spawn) => spawn.id !== spawnId),
  }
}
