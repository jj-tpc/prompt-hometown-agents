// 지형 타일셋 경로와 기본 좌표.
// Sprout Lands 타일셋은 16px 논리 타일 / 8px autotile 서브셀 구조.

export const TILE_PX = 16

export const TILESETS = {
  grass: "/assets/sprout-lands/tilesets/grass.png",
  water: "/assets/sprout-lands/tilesets/water.png",
} as const

// water.png — 4프레임 애니메이션. frame 0(col 0)을 정적 물 타일로 사용.
export const WATER_TILE = { col: 0, row: 0 } as const
