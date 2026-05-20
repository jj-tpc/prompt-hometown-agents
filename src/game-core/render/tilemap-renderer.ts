// Read-only TileMap canvas renderer.
// Draw order: ground -> decoration -> object -> overlay.

import { TILE_DEFINITIONS } from "@/game-core/map/tile-definitions"
import {
  grassAutotile,
  dirtAutotile,
  sandAutotile,
  pathAutotile,
  cliffAutotile,
  type AutotilePos,
} from "@/game-core/render/autotile"
import {
  SPRITE_ATLAS,
  STAIRS_BOTTOM_TILE,
  STAIRS_TOP_TILE,
} from "@/game-core/render/terrain-tiles"
import {
  TILE_PX,
  ELEVATION_STEP_PX,
  RENDER_SCALE,
  type Camera,
  type RenderEntity,
} from "@/game-core/render/types"
import { sortRenderables } from "@/game-core/render/depth-sort"
import type { LayerName, TileMap, TileSpriteOverride, TileType } from "@/game-core/types/map"

export type RenderInput = { map: TileMap; camera: Camera; entities?: RenderEntity[] }
export type LoadedSpriteAssets = { images: Record<string, CanvasImageSource> }

export type TileDrawSource = {
  atlasId: string
  sx: number
  sy: number
  sw?: number
  sh?: number
  elevation: number
}

const LAND_AUTOTILERS: Partial<
  Record<TileType, (isSame: (x: number, y: number) => boolean, x: number, y: number) => AutotilePos>
> = {
  grass: grassAutotile,
  dirt: dirtAutotile,
  sand: sandAutotile,
  path: pathAutotile,
}

function isInBounds(map: TileMap, x: number, y: number): boolean {
  return y >= 0 && y < map.height && x >= 0 && x < map.width
}

// Grid coordinates to unscaled screen pixels. Elevation lifts tiles upward.
export function gridToScreen(
  gridX: number,
  gridY: number,
  elevation: number,
  camera: Camera
): { x: number; y: number } {
  return {
    x: gridX * TILE_PX - camera.x,
    y: gridY * TILE_PX - elevation * ELEVATION_STEP_PX - camera.y,
  }
}

export function tileSpriteIdFor(
  map: TileMap,
  layerName: LayerName,
  x: number,
  y: number
): string | null {
  const layer = map.layers.find((l) => l.name === layerName)
  const tile = layer?.tiles[y]?.[x]
  if (tile == null) return null
  return TILE_DEFINITIONS[tile].spriteId
}

export function spriteOverrideFor(
  map: TileMap,
  layerName: LayerName,
  x: number,
  y: number
): TileSpriteOverride | null {
  if (!isInBounds(map, x, y)) return null
  return (
    map.spriteOverrides?.find(
      (override) => override.layer === layerName && override.x === x && override.y === y
    ) ?? null
  )
}

function spriteOverrideSourceFor(
  map: TileMap,
  layerName: LayerName,
  x: number,
  y: number,
  elevation: number
): TileDrawSource | null {
  const override = spriteOverrideFor(map, layerName, x, y)
  if (!override) return null
  return {
    atlasId: override.atlasId,
    sx: override.sx,
    sy: override.sy,
    sw: override.sw,
    sh: override.sh,
    elevation,
  }
}

function normalizedGroundBaseTile(tile: TileType | null | undefined): TileType | null {
  if (tile == null) return null
  return tile === "water" || tile === "shallow_water" ? tile : "grass"
}

function effectiveGroundTileFor(
  map: TileMap,
  ground: { tiles: (TileType | null)[][] },
  x: number,
  y: number
): TileType | null {
  if (!isInBounds(map, x, y)) return null

  const tile = ground.tiles[y]?.[x] ?? null
  const override = spriteOverrideFor(map, "ground", x, y)
  if (!override) return tile

  return normalizedGroundBaseTile(override.baseTile ?? tile)
}

export function groundTileSourceFor(
  map: TileMap,
  x: number,
  y: number
): TileDrawSource | null {
  if (!isInBounds(map, x, y)) return null

  const ground = map.layers.find((layer) => layer.name === "ground")
  if (!ground) return null

  const tile = effectiveGroundTileFor(map, ground, x, y)
  if (tile == null) return null

  const cellElev = map.elevation[y]?.[x] ?? 0
  const override = spriteOverrideSourceFor(map, "ground", x, y, cellElev)
  if (override) return override

  const autotiler = LAND_AUTOTILERS[tile]

  if (tile === "grass" && cellElev > 0) {
    const isRaisedGrass = (xx: number, yy: number) =>
      isInBounds(map, xx, yy) &&
      effectiveGroundTileFor(map, ground, xx, yy) === "grass" &&
      map.elevation[yy][xx] === cellElev
    const openN = !isRaisedGrass(x, y - 1)
    const openW = !isRaisedGrass(x - 1, y)
    const openE = !isRaisedGrass(x + 1, y)
    const col = openW && openE ? 3 : openW ? 0 : openE ? 2 : 1
    const row = openN ? 0 : 1

    return {
      atlasId: "hills",
      sx: col * TILE_PX,
      sy: row * TILE_PX,
      elevation: 0,
    }
  }

  if (!autotiler) {
    const entry = SPRITE_ATLAS[TILE_DEFINITIONS[tile].spriteId]
    if (!entry) return null
    return { atlasId: entry.atlasId, sx: entry.sx, sy: entry.sy, elevation: cellElev }
  }

  const isSame = (xx: number, yy: number) =>
    !isInBounds(map, xx, yy) ||
    (effectiveGroundTileFor(map, ground, xx, yy) === tile && map.elevation[yy][xx] === cellElev)
  const pos = autotiler(isSame, x, y)

  return {
    atlasId: tile,
    sx: pos.col * TILE_PX,
    sy: pos.row * TILE_PX,
    elevation: cellElev,
  }
}

// hills/dirt/sand/path 타일은 가장자리가 투명하다 → 그 아래 잔디 중앙 타일을 깔아야
// 투명 가장자리로 잔디가 비친다 (검은 테두리 방지).
const GRASS_BACKED_ATLASES = new Set(["hills", "dirt", "sand", "path", "fence"])

export function grassBackfillSourceFor(
  source: TileDrawSource | null
): TileDrawSource | null {
  if (!source || !GRASS_BACKED_ATLASES.has(source.atlasId)) return null

  return {
    atlasId: "grass",
    sx: TILE_PX,
    sy: TILE_PX,
    elevation: source.elevation,
  }
}

function basicTileSourceFor(tile: TileType | null | undefined, elevation: number): TileDrawSource | null {
  if (tile == null) return null
  const entry = SPRITE_ATLAS[TILE_DEFINITIONS[tile].spriteId]
  if (!entry) return null
  return {
    atlasId: entry.atlasId,
    sx: entry.sx,
    sy: entry.sy,
    sw: entry.sw,
    sh: entry.sh,
    elevation,
  }
}

function groundOverrideBackfillSourceFor(
  map: TileMap,
  x: number,
  y: number,
  tile: TileType,
  source: TileDrawSource
): TileDrawSource | null {
  const override = spriteOverrideFor(map, "ground", x, y)
  if (!override) return null

  const fallbackBaseTile: TileType = source.atlasId === "fence" ? "grass" : tile
  const requestedBase = override.baseTile ?? fallbackBaseTile
  const baseTile =
    requestedBase === "water" || requestedBase === "shallow_water" ? requestedBase : "grass"
  return basicTileSourceFor(baseTile, map.elevation[y]?.[x] ?? 0)
}

export function elevationGapBackfillSourceFor(
  map: TileMap,
  x: number,
  y: number,
  source: TileDrawSource | null
): TileDrawSource | null {
  if (!source || source.atlasId !== "grass") return null

  const currentElevation = map.elevation[y]?.[x] ?? 0
  const hasHigherNeighbor =
    (map.elevation[y - 1]?.[x] ?? currentElevation) > currentElevation ||
    (map.elevation[y + 1]?.[x] ?? currentElevation) > currentElevation ||
    (map.elevation[y]?.[x - 1] ?? currentElevation) > currentElevation ||
    (map.elevation[y]?.[x + 1] ?? currentElevation) > currentElevation

  if (!hasHigherNeighbor) return null

  return {
    atlasId: "grass",
    sx: TILE_PX,
    sy: TILE_PX,
    elevation: source.elevation,
  }
}

export function hillObjectTileFor(
  map: TileMap,
  x: number,
  y: number
): Extract<TileType, "cliff_face" | "stairs"> | null {
  if (!isInBounds(map, x, y)) return null

  const objectLayer = map.layers.find((layer) => layer.name === "object")
  const explicitTile = objectLayer?.tiles[y]?.[x]
  if (explicitTile === "cliff_face" || explicitTile === "stairs") return explicitTile
  if (explicitTile != null) return null

  const currentElevation = map.elevation[y]?.[x] ?? 0
  const northElevation = y > 0 ? map.elevation[y - 1]?.[x] ?? currentElevation : currentElevation
  return northElevation > currentElevation ? "cliff_face" : null
}

function hillObjectElevationFor(map: TileMap, x: number, y: number): number {
  return map.elevation[y]?.[x] ?? 0
}

export function cliffTileSourceFor(
  map: TileMap,
  x: number,
  y: number
): TileDrawSource | null {
  if (hillObjectTileFor(map, x, y) !== "cliff_face") return null

  const isCliffConnector = (xx: number, yy: number) => {
    const tile = hillObjectTileFor(map, xx, yy)
    return tile === "cliff_face" || tile === "stairs"
  }
  const pos = cliffAutotile(isCliffConnector, x, y)

  return {
    atlasId: "hills",
    sx: pos.col * TILE_PX,
    sy: pos.row * TILE_PX,
    elevation: hillObjectElevationFor(map, x, y),
  }
}

export function stairsTileSourceFor(
  map: TileMap,
  x: number,
  y: number
): TileDrawSource | null {
  if (hillObjectTileFor(map, x, y) !== "stairs") return null

  const objectLayer = map.layers.find((layer) => layer.name === "object")
  const hasStairsAbove = objectLayer?.tiles[y - 1]?.[x] === "stairs"
  const hasStairsBelow = objectLayer?.tiles[y + 1]?.[x] === "stairs"
  const hasStairsLeft = objectLayer?.tiles[y]?.[x - 1] === "stairs"
  const hasStairsRight = objectLayer?.tiles[y]?.[x + 1] === "stairs"
  const tile = hasStairsAbove && !hasStairsBelow ? STAIRS_BOTTOM_TILE : STAIRS_TOP_TILE
  const colOffset = hasStairsLeft && !hasStairsRight ? 1 : 0

  return {
    atlasId: "hills",
    sx: (tile.col + colOffset) * TILE_PX,
    sy: tile.row * TILE_PX,
    elevation: hillObjectElevationFor(map, x, y),
  }
}

export function renderTileMap(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  assets: LoadedSpriteAssets
): void {
  const { map, camera } = input
  ctx.imageSmoothingEnabled = false
  const drawDp = TILE_PX * RENDER_SCALE

  // 뷰포트에 보이는 타일 범위만 그린다 (대형 맵 컬링).
  const cullMargin = 2
  const camTileX = Math.floor(camera.x / TILE_PX)
  const camTileY = Math.floor(camera.y / TILE_PX)
  const minX = Math.max(0, camTileX - cullMargin)
  const maxX = Math.min(map.width, camTileX + Math.ceil(ctx.canvas.width / drawDp) + cullMargin)
  const minY = Math.max(0, camTileY - cullMargin)
  const maxY = Math.min(map.height, camTileY + Math.ceil(ctx.canvas.height / drawDp) + cullMargin)

  const blit = (
    img: CanvasImageSource,
    sx: number,
    sy: number,
    gx: number,
    gy: number,
    elevation: number,
    sw = TILE_PX,
    sh = TILE_PX
  ) => {
    const s = gridToScreen(gx, gy, elevation, camera)
    ctx.drawImage(
      img,
      sx,
      sy,
      sw,
      sh,
      s.x * RENDER_SCALE,
      s.y * RENDER_SCALE + drawDp - sh * RENDER_SCALE,
      sw * RENDER_SCALE,
      sh * RENDER_SCALE
    )
  }

  const drawSource = (source: TileDrawSource, x: number, y: number) => {
    const img = assets.images[source.atlasId]
    if (!img) return
    blit(
      img,
      source.sx,
      source.sy,
      x,
      y,
      source.elevation,
      source.sw ?? TILE_PX,
      source.sh ?? TILE_PX
    )
  }

  const drawAtlasTile = (tile: TileType, layerName: LayerName, x: number, y: number) => {
    const override = spriteOverrideSourceFor(
      map,
      layerName,
      x,
      y,
      map.elevation[y]?.[x] ?? 0
    )
    if (override) {
      drawSource(override, x, y)
      return
    }

    const entry = SPRITE_ATLAS[TILE_DEFINITIONS[tile].spriteId]
    const img = entry && assets.images[entry.atlasId]
    if (!entry || !img) return

    const s = gridToScreen(x, y, map.elevation[y][x], camera)
    const dw = entry.sw * RENDER_SCALE
    const dh = entry.sh * RENDER_SCALE
    ctx.drawImage(
      img,
      entry.sx,
      entry.sy,
      entry.sw,
      entry.sh,
      s.x * RENDER_SCALE,
      s.y * RENDER_SCALE + drawDp - dh,
      dw,
      dh
    )
  }

  const drawGenericLayer = (layerName: LayerName) => {
    const layer = map.layers.find((l) => l.name === layerName)
    if (!layer) return
    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const tile = layer.tiles[y]?.[x]
        if (tile != null) drawAtlasTile(tile, layerName, x, y)
      }
    }
  }

  const ground = map.layers.find((l) => l.name === "ground")
  if (ground) {
    const groundType = (x: number, y: number): TileType | null =>
      isInBounds(map, x, y) ? effectiveGroundTileFor(map, ground, x, y) : null

    const water = assets.images.water
    if (water) {
      for (let y = minY; y < maxY; y++) {
        for (let x = minX; x < maxX; x++) {
          let nearWater = false
          for (let dy = -1; dy <= 1 && !nearWater; dy++) {
            for (let dx = -1; dx <= 1 && !nearWater; dx++) {
              if (groundType(x + dx, y + dy) === "water") nearWater = true
            }
          }
          if (nearWater) blit(water, 0, 0, x, y, map.elevation[y][x])
        }
      }
    }

    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const source = groundTileSourceFor(map, x, y)
        if (!source) continue
        const tile = ground.tiles[y]?.[x]
        if (tile == null) continue

        const overrideBackfill = groundOverrideBackfillSourceFor(map, x, y, tile, source)
        const overrideBackfillImg = overrideBackfill && assets.images[overrideBackfill.atlasId]
        if (overrideBackfill && overrideBackfillImg) {
          blit(
            overrideBackfillImg,
            overrideBackfill.sx,
            overrideBackfill.sy,
            x,
            y,
            overrideBackfill.elevation,
            overrideBackfill.sw ?? TILE_PX,
            overrideBackfill.sh ?? TILE_PX
          )
        }

        const elevationGapBackfill = elevationGapBackfillSourceFor(map, x, y, source)
        const elevationGapBackfillImg =
          elevationGapBackfill && assets.images[elevationGapBackfill.atlasId]
        if (elevationGapBackfill && elevationGapBackfillImg) {
          blit(
            elevationGapBackfillImg,
            elevationGapBackfill.sx,
            elevationGapBackfill.sy,
            x,
            y,
            elevationGapBackfill.elevation
          )
        }

        const backfill = grassBackfillSourceFor(source)
        const backfillImg = backfill && assets.images[backfill.atlasId]
        if (backfill && backfillImg) {
          blit(backfillImg, backfill.sx, backfill.sy, x, y, backfill.elevation)
        }

        const img = assets.images[source.atlasId]
        if (!img) continue
        blit(
          img,
          source.sx,
          source.sy,
          x,
          y,
          source.elevation,
          source.sw ?? TILE_PX,
          source.sh ?? TILE_PX
        )
      }
    }
  }

  drawGenericLayer("decoration")

  const objectLayer = map.layers.find((l) => l.name === "object")
  const hills = assets.images.hills

  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const tile = objectLayer?.tiles[y]?.[x] ?? null
      const hillTile = hillObjectTileFor(map, x, y)
      const liftedElev = hillObjectElevationFor(map, x, y)
      const override = spriteOverrideSourceFor(map, "object", x, y, liftedElev)

      if (override) {
        drawSource(override, x, y)
      } else if (hillTile === "cliff_face" && hills) {
        const cliff = cliffTileSourceFor(map, x, y)

        const backfill = grassBackfillSourceFor(cliff)
        const backfillImg = backfill && assets.images[backfill.atlasId]
        if (backfill && backfillImg) {
          blit(backfillImg, backfill.sx, backfill.sy, x, y, backfill.elevation)
        }
        if (cliff) blit(hills, cliff.sx, cliff.sy, x, y, liftedElev)
      } else if (hillTile === "stairs" && hills) {
        const stairs = stairsTileSourceFor(map, x, y)

        const backfill = grassBackfillSourceFor(stairs)
        const backfillImg = backfill && assets.images[backfill.atlasId]
        if (backfill && backfillImg) {
          blit(backfillImg, backfill.sx, backfill.sy, x, y, backfill.elevation)
        }
        if (stairs) blit(hills, stairs.sx, stairs.sy, x, y, stairs.elevation)
      } else if (tile != null) {
        drawAtlasTile(tile, "object", x, y)
      }
    }
  }

  // ─ entities: Y-sort 후 그림 (object 위, overlay 아래) ─
  for (const entity of sortRenderables(input.entities ?? [])) {
    if (
      entity.gridX < minX ||
      entity.gridX >= maxX ||
      entity.gridY < minY ||
      entity.gridY >= maxY
    ) {
      continue
    }
    const entry = SPRITE_ATLAS[entity.spriteId]
    const img = entry && assets.images[entry.atlasId]
    if (!entry || !img) continue
    const s = gridToScreen(
      entity.gridX + (entity.offsetX ?? 0) / TILE_PX,
      entity.gridY + (entity.offsetY ?? 0) / TILE_PX,
      entity.elevation,
      camera
    )
    const dw = entry.sw * RENDER_SCALE
    const dh = entry.sh * RENDER_SCALE
    ctx.drawImage(
      img,
      entry.sx, entry.sy, entry.sw, entry.sh,
      s.x * RENDER_SCALE + drawDp / 2 - dw / 2, // 타일 가로 중앙
      s.y * RENDER_SCALE + drawDp - dh, // 발밑을 타일 바닥에 맞춤
      dw, dh
    )
  }

  drawGenericLayer("overlay")
}
