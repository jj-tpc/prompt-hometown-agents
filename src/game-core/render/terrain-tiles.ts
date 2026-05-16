// 지형 타일셋 아틀라스 정의.
// Sprout Lands 타일셋은 16px 논리 타일. 자동타일 지형의 atlasId는 지형 타입 이름과
// 동일하게 맞춘다 (renderer가 `assets.images[terrainType]`로 바로 조회).

import type { SpriteAtlas } from "@/game-core/render/types"

// atlasId → public 이미지 경로
export const ATLAS_IMAGES = {
  grass: "/assets/sprout-lands/tilesets/grass.png",
  water: "/assets/sprout-lands/tilesets/water.png",
  path: "/assets/sprout-lands/tilesets/paths.png",
  dirt: "/assets/sprout-lands/tilesets/tilled-dirt-v2.png",
  sand: "/assets/sprout-lands/tilesets/tilled-dirt-alt.png",
  hills: "/assets/sprout-lands/tilesets/hills.png",
  character: "/assets/sprout-lands/characters/basic-character.png",
} as const

// spriteId → 아틀라스 crop.
// 자동타일 지형(grass/dirt/sand/path)은 여기 좌표가 "기본(중앙) 타일"이며,
// renderer가 autotiler로 col/row를 덮어쓴다.
// cliff_face/stairs/entity 좌표는 Task 5·7에서 확정 — 현재는 임시값.
export const SPRITE_ATLAS: SpriteAtlas = {
  "tiles:grass": { atlasId: "grass", sx: 16, sy: 16, sw: 16, sh: 16 },
  "tiles:dirt": { atlasId: "dirt", sx: 16, sy: 16, sw: 16, sh: 16 },
  "tiles:sand": { atlasId: "sand", sx: 16, sy: 16, sw: 16, sh: 16 },
  "tiles:path": { atlasId: "path", sx: 0, sy: 16, sw: 16, sh: 16 },
  "tiles:water": { atlasId: "water", sx: 0, sy: 0, sw: 16, sh: 16 },
  "tiles:cliff_face": { atlasId: "hills", sx: 16, sy: 48, sw: 16, sh: 16 },
  "tiles:stairs": { atlasId: "hills", sx: 0, sy: 64, sw: 16, sh: 16 },
  "entity:player:front": { atlasId: "character", sx: 0, sy: 0, sw: 48, sh: 48 },
  "entity:npc:front": { atlasId: "character", sx: 0, sy: 0, sw: 48, sh: 48 },
}
