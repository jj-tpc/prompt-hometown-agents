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
} from "@/game-core/render/types"
import type { LayerName, TileMap, TileType } from "@/game-core/types/map"

export type RenderInput = { map: TileMap; camera: Camera }
export type LoadedSpriteAssets = { images: Record<string, HTMLImageElement> }

export type TileDrawSource = {
  atlasId: string
  sx: number
  sy: number
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

export function groundTileSourceFor(
  map: TileMap,
  x: number,
  y: number
): TileDrawSource | null {
  if (!isInBounds(map, x, y)) return null

  const ground = map.layers.find((layer) => layer.name === "ground")
  if (!ground) return null

  const tile = ground.tiles[y]?.[x]
  if (tile == null) return null

  const cellElev = map.elevation[y]?.[x] ?? 0
  const autotiler = LAND_AUTOTILERS[tile]

  if (tile === "grass" && cellElev > 0) {
    const isRaisedGrass = (xx: number, yy: number) =>
      isInBounds(map, xx, yy) &&
      ground.tiles[yy][xx] === "grass" &&
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
    (ground.tiles[yy][xx] === tile && map.elevation[yy][xx] === cellElev)
  const pos = autotiler(isSame, x, y)

  return {
    atlasId: tile,
    sx: pos.col * TILE_PX,
    sy: pos.row * TILE_PX,
    elevation: cellElev,
  }
}

export function hillBackfillSourceFor(source: TileDrawSource | null): TileDrawSource | null {
  if (!source || source.atlasId !== "hills") return null

  return {
    atlasId: "grass",
    sx: TILE_PX,
    sy: TILE_PX,
    elevation: source.elevation,
  }
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

  const blit = (
    img: HTMLImageElement,
    sx: number,
    sy: number,
    gx: number,
    gy: number,
    elevation: number
  ) => {
    const s = gridToScreen(gx, gy, elevation, camera)
    ctx.drawImage(
      img,
      sx,
      sy,
      TILE_PX,
      TILE_PX,
      s.x * RENDER_SCALE,
      s.y * RENDER_SCALE,
      drawDp,
      drawDp
    )
  }

  const drawAtlasTile = (tile: TileType, x: number, y: number) => {
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
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = layer.tiles[y]?.[x]
        if (tile != null) drawAtlasTile(tile, x, y)
      }
    }
  }

  const ground = map.layers.find((l) => l.name === "ground")
  if (ground) {
    const groundType = (x: number, y: number): TileType | null =>
      isInBounds(map, x, y) ? ground.tiles[y][x] : null

    const water = assets.images.water
    if (water) {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
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

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const source = groundTileSourceFor(map, x, y)
        if (!source) continue

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

        const backfill = hillBackfillSourceFor(source)
        const backfillImg = backfill && assets.images[backfill.atlasId]
        if (backfill && backfillImg) {
          blit(backfillImg, backfill.sx, backfill.sy, x, y, backfill.elevation)
        }

        const img = assets.images[source.atlasId]
        if (!img) continue
        blit(img, source.sx, source.sy, x, y, source.elevation)
      }
    }
  }

  drawGenericLayer("decoration")

  const objectLayer = map.layers.find((l) => l.name === "object")
  const hills = assets.images.hills

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = objectLayer?.tiles[y]?.[x] ?? null
      const hillTile = hillObjectTileFor(map, x, y)
      const liftedElev = hillObjectElevationFor(map, x, y)

      if (hillTile === "cliff_face" && hills) {
        const cliff = cliffTileSourceFor(map, x, y)

        const backfill = hillBackfillSourceFor(cliff)
        const backfillImg = backfill && assets.images[backfill.atlasId]
        if (backfill && backfillImg) {
          blit(backfillImg, backfill.sx, backfill.sy, x, y, backfill.elevation)
        }
        if (cliff) blit(hills, cliff.sx, cliff.sy, x, y, liftedElev)
      } else if (hillTile === "stairs" && hills) {
        const stairs = stairsTileSourceFor(map, x, y)

        const backfill = hillBackfillSourceFor(stairs)
        const backfillImg = backfill && assets.images[backfill.atlasId]
        if (backfill && backfillImg) {
          blit(backfillImg, backfill.sx, backfill.sy, x, y, backfill.elevation)
        }
        if (stairs) blit(hills, stairs.sx, stairs.sy, x, y, stairs.elevation)
      } else if (tile != null) {
        drawAtlasTile(tile, x, y)
      }
    }
  }

  drawGenericLayer("overlay")
}
