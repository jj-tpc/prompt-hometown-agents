import type { SpriteAtlas, SpriteAtlasEntry } from "@/game-core/render/types"
import type { Direction } from "@/game-core/types/map"

export const ATLAS_IMAGES = {
  grass: "/assets/sprout-lands/tilesets/grass.png",
  water: "/assets/sprout-lands/tilesets/water.png",
  path: "/assets/sprout-lands/tilesets/paths.png",
  dirt: "/assets/sprout-lands/tilesets/tilled-dirt-v2.png",
  sand: "/assets/sprout-lands/tilesets/tilled-dirt-alt.png",
  hills: "/assets/sprout-lands/tilesets/hills.png",
  character: "/assets/sprout-lands/characters/basic-character.png",
  fence: "/assets/sprout-lands/tilesets/fences.png",
} as const

export const STAIRS_TOP_TILE = { col: 9, row: 5 } as const
export const STAIRS_BOTTOM_TILE = { col: 9, row: 6 } as const
export const CLIFF_ROW = 2

export type CharacterSpriteKind = "player" | "npc"

const CHARACTER_CELL_PX = 48
const CHARACTER_FRAME_COUNT = 4
const CHARACTER_DIRECTIONS: Direction[] = ["down", "up", "right", "left"]
const CHARACTER_KINDS: CharacterSpriteKind[] = ["player", "npc"]
const CHARACTER_ROW: Record<Direction, number> = {
  down: 0,
  up: 1,
  left: 2,
  right: 3,
}

function wrapCharacterFrame(frame: number): number {
  return ((Math.floor(frame) % CHARACTER_FRAME_COUNT) + CHARACTER_FRAME_COUNT) % CHARACTER_FRAME_COUNT
}

export function characterSpriteId(
  kind: CharacterSpriteKind,
  direction: Direction,
  frame = 0
): string {
  return `entity:${kind}:${direction}:${wrapCharacterFrame(frame)}`
}

function characterSpriteEntry(direction: Direction, frame: number): SpriteAtlasEntry {
  const isSide = direction === "left" || direction === "right"
  return {
    atlasId: "character",
    sx: frame * CHARACTER_CELL_PX + (isSide ? 19 : 17),
    sy: CHARACTER_ROW[direction] * CHARACTER_CELL_PX + 16,
    sw: isSide ? 10 : 14,
    sh: 16,
  }
}

const CHARACTER_SPRITES: SpriteAtlas = {}

for (const kind of CHARACTER_KINDS) {
  for (const direction of CHARACTER_DIRECTIONS) {
    for (let frame = 0; frame < CHARACTER_FRAME_COUNT; frame += 1) {
      CHARACTER_SPRITES[characterSpriteId(kind, direction, frame)] = characterSpriteEntry(
        direction,
        frame
      )
    }
  }
}

export const SPRITE_ATLAS: SpriteAtlas = {
  "tiles:grass": { atlasId: "grass", sx: 16, sy: 16, sw: 16, sh: 16 },
  "tiles:dirt": { atlasId: "dirt", sx: 16, sy: 16, sw: 16, sh: 16 },
  "tiles:sand": { atlasId: "sand", sx: 16, sy: 16, sw: 16, sh: 16 },
  "tiles:path": { atlasId: "path", sx: 0, sy: 16, sw: 16, sh: 16 },
  "tiles:water": { atlasId: "water", sx: 0, sy: 0, sw: 16, sh: 16 },
  "tiles:cliff_face": { atlasId: "hills", sx: 16, sy: CLIFF_ROW * 16, sw: 16, sh: 16 },
  "tiles:fence": { atlasId: "fence", sx: 0, sy: 0, sw: 16, sh: 16 },
  "tiles:stairs": {
    atlasId: "hills",
    sx: STAIRS_TOP_TILE.col * 16,
    sy: STAIRS_TOP_TILE.row * 16,
    sw: 16,
    sh: 16,
  },
  ...CHARACTER_SPRITES,
  "entity:player:front": CHARACTER_SPRITES[characterSpriteId("player", "down", 0)],
  "entity:npc:front": CHARACTER_SPRITES[characterSpriteId("npc", "down", 0)],
}
