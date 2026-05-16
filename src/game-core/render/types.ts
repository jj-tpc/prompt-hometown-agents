// 렌더러 공용 상수와 타입.

export const TILE_PX = 16 // 논리 타일 1칸의 픽셀 크기
export const ELEVATION_STEP_PX = 16 // elevation 1레벨당 위로 올리는 픽셀
export const RENDER_SCALE = 4 // 캔버스 정수 배율 (16px 타일 → 64px)

// 뷰포트 좌상단의 월드 픽셀 좌표 (타일 픽셀 단위, 배율 적용 전)
export type Camera = { x: number; y: number }

// spriteId → 아틀라스 이미지에서 잘라낼 사각형
export type SpriteAtlasEntry = {
  atlasId: string // 아틀라스 이미지 키
  sx: number
  sy: number
  sw: number
  sh: number
}

export type SpriteAtlas = Record<string, SpriteAtlasEntry>

// 격자 위에 그려지는 캐릭터/오브젝트 등 (entity 렌더는 Task 6-7에서 사용)
export type RenderEntity = {
  id: string
  spriteId: string
  gridX: number
  gridY: number
  elevation: number
  spriteHeightPx: number
}
