// 플레이어 추적 카메라.
// 카메라는 뷰포트 좌상단의 월드 픽셀 좌표(타일 픽셀 단위, RENDER_SCALE 적용 전).

import { TILE_PX, type Camera } from "@/game-core/render/types"
import type { TileMap } from "@/game-core/types/map"

// 한 축의 카메라 위치를 맵 경계 안으로 clamp.
// 맵이 뷰포트보다 작으면 0(정렬).
function clampAxis(value: number, mapPx: number, viewPx: number): number {
  if (mapPx <= viewPx) return 0
  return Math.max(0, Math.min(value, mapPx - viewPx))
}

// 플레이어를 뷰포트 중앙에 두되, 맵 밖 여백이 보이지 않도록 clamp한다.
// player.worldX/Y, viewport.width/height 모두 타일 픽셀 단위.
export function cameraForPlayer(
  player: { worldX: number; worldY: number },
  map: TileMap,
  viewport: { width: number; height: number }
): Camera {
  return {
    x: clampAxis(player.worldX - viewport.width / 2, map.width * TILE_PX, viewport.width),
    y: clampAxis(player.worldY - viewport.height / 2, map.height * TILE_PX, viewport.height),
  }
}
