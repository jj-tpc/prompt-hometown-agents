// Y-sort 깊이 정렬.
// 3/4 탑다운에서 화면 아래쪽(카메라에 가까운 것)을 나중에 그려야 자연스럽게 겹친다.

import { ELEVATION_STEP_PX, TILE_PX } from "@/game-core/render/types"

// 정렬 키 = base(발밑)의 월드 Y. elevation은 키를 위로 끌어올린다.
// 키가 작을수록 먼저(뒤에) 그린다.
export function depthSortKey(gridY: number, elevation: number): number {
  return gridY * TILE_PX - elevation * ELEVATION_STEP_PX
}

// depthSortKey 오름차순 정렬. 키가 같으면 elevation이 높은 쪽을 먼저(뒤에).
// 원본 배열을 변경하지 않는다.
export function sortRenderables<T extends { gridY: number; elevation: number }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const diff = depthSortKey(a.gridY, a.elevation) - depthSortKey(b.gridY, b.elevation)
    return diff !== 0 ? diff : b.elevation - a.elevation
  })
}
