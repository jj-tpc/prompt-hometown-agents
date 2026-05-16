// TileMap 캔버스 렌더러.
// 게임 상태(TileMap)를 읽어 캔버스에 그리기만 한다. 상태를 변경하지 않는다.
// 그리는 순서: ground → decoration → object → overlay.
// (entity 렌더는 Task 6-7, UI 마커는 Task 8에서 추가)

import { TILE_DEFINITIONS } from "@/game-core/map/tile-definitions"
import {
  grassAutotile,
  dirtAutotile,
  sandAutotile,
  pathAutotile,
  type AutotilePos,
} from "@/game-core/render/autotile"
import { SPRITE_ATLAS } from "@/game-core/render/terrain-tiles"
import {
  TILE_PX,
  ELEVATION_STEP_PX,
  RENDER_SCALE,
  type Camera,
} from "@/game-core/render/types"
import type { LayerName, TileMap, TileType } from "@/game-core/types/map"

export type RenderInput = { map: TileMap; camera: Camera }
export type LoadedSpriteAssets = { images: Record<string, HTMLImageElement> }

// 격자 좌표 → 화면 좌표(타일 픽셀 단위, 배율 적용 전). elevation은 Y를 위로 끌어올린다.
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

// 지정 레이어 (x,y) 칸 타일의 spriteId. 빈 칸이면 null.
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

// 자동타일되는 지면 지형 → autotiler. atlasId는 지형 타입 이름과 동일.
const LAND_AUTOTILERS: Partial<
  Record<TileType, (isSame: (x: number, y: number) => boolean, x: number, y: number) => AutotilePos>
> = {
  grass: grassAutotile,
  dirt: dirtAutotile,
  sand: sandAutotile,
  path: pathAutotile,
}

export function renderTileMap(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  assets: LoadedSpriteAssets
): void {
  const { map, camera } = input
  ctx.imageSmoothingEnabled = false
  const drawDp = TILE_PX * RENDER_SCALE

  const inBounds = (x: number, y: number) =>
    y >= 0 && y < map.height && x >= 0 && x < map.width

  // 16×16 crop을 격자 칸에 그림
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
      sx, sy, TILE_PX, TILE_PX,
      s.x * RENDER_SCALE, s.y * RENDER_SCALE, drawDp, drawDp
    )
  }

  const ground = map.layers.find((l) => l.name === "ground")

  // ─ ground layer: 물 베이스 + 자동타일 지형 ─
  if (ground) {
    const groundType = (x: number, y: number): TileType | null =>
      inBounds(x, y) ? ground.tiles[y][x] : null

    // pass 1: 물 베이스. 물 칸 + 물에 8방향 인접한 칸 아래에 물을 깔아야
    // 잔디/흙 가장자리 조각의 투명부로 물가가 비친다.
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

    // pass 2: 자동타일 지형 (grass/dirt/sand/path)
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const t = groundType(x, y)
        if (t == null) continue
        const autotiler = LAND_AUTOTILERS[t]
        const img = assets.images[t]
        if (!autotiler || !img) continue
        // 맵 밖은 같은 지형으로 취급 (월드 경계에 잘린 가장자리 방지)
        const isSame = (xx: number, yy: number) =>
          !inBounds(xx, yy) || groundType(xx, yy) === t
        const pos = autotiler(isSame, x, y)
        blit(img, pos.col * TILE_PX, pos.row * TILE_PX, x, y, map.elevation[y][x])
      }
    }
  }

  // ─ decoration / object / overlay: 아틀라스 crop을 base(발밑) 앵커로 그림 ─
  for (const layerName of ["decoration", "object", "overlay"] as const) {
    const layer = map.layers.find((l) => l.name === layerName)
    if (!layer) continue
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = layer.tiles[y]?.[x]
        if (tile == null) continue
        const entry = SPRITE_ATLAS[TILE_DEFINITIONS[tile].spriteId]
        const img = entry && assets.images[entry.atlasId]
        if (!entry || !img) continue
        const s = gridToScreen(x, y, map.elevation[y][x], camera)
        const dw = entry.sw * RENDER_SCALE
        const dh = entry.sh * RENDER_SCALE
        ctx.drawImage(
          img,
          entry.sx, entry.sy, entry.sw, entry.sh,
          s.x * RENDER_SCALE,
          s.y * RENDER_SCALE + drawDp - dh, // 스프라이트 바닥을 칸 바닥에 맞춤
          dw, dh
        )
      }
    }
  }
}
