import type { SpriteAtlas, SpriteAtlasEntry } from "@/game-core/render/types"
import type { Direction } from "@/game-core/types/map"

export type AtlasImageCategory = "ground" | "building" | "object" | "character"

export const ATLAS_IMAGE_GROUPS = {
  ground: {
    grass: "/assets/sprout-lands/tilesets/grass.png",
    water: "/assets/sprout-lands/tilesets/water.png",
    path: "/assets/sprout-lands/tilesets/paths.png",
    dirt: "/assets/sprout-lands/tilesets/tilled-dirt-v2.png",
    sand: "/assets/sprout-lands/tilesets/tilled-dirt-alt.png",
    hills: "/assets/sprout-lands/tilesets/hills.png",
    tilledDirt: "/assets/sprout-lands/tilesets/tilled-dirt.png",
    tilledDirtWide: "/assets/sprout-lands/tilesets/tilled-dirt-wide.png",
    tilledDirtWideV2: "/assets/sprout-lands/tilesets/tilled-dirt-wide-v2.png",
    gravel: "/assets/sprout-lands/tilesets/town_tilesets/gravel.png",
    townSand: "/assets/sprout-lands/tilesets/town_tilesets/sand.png",
    sandPath: "/assets/sprout-lands/tilesets/town_tilesets/sand-path.png",
    snow: "/assets/sprout-lands/tilesets/town_tilesets/snow.png",
    stone: "/assets/sprout-lands/tilesets/town_tilesets/stone.png",
    stoneFloor: "/assets/sprout-lands/tilesets/town_tilesets/stone-floor.png",
    stonePath: "/assets/sprout-lands/tilesets/town_tilesets/stone-path.png",
    woodFloor: "/assets/sprout-lands/tilesets/town_tilesets/wood-floor.png",
  },
  building: {
    buildingWall: "/assets/sprout-lands/tilesets/town_tilesets/building-wall.png",
    doors: "/assets/sprout-lands/tilesets/doors.png",
    woodenHouse: "/assets/sprout-lands/tilesets/wooden-house.png",
    woodenHouseRoof: "/assets/sprout-lands/tilesets/wooden-house-roof.png",
    woodenHouseWalls: "/assets/sprout-lands/tilesets/wooden-house-walls.png",
    forge: "/assets/sprout-lands/objects/buildings/forge.png",
    marketStall: "/assets/sprout-lands/objects/buildings/market-stall.png",
    buildingProps: "/assets/sprout-lands/objects/buildings/props.png",
    well: "/assets/sprout-lands/objects/buildings/well.png",
  },
  object: {
    fence: "/assets/sprout-lands/tilesets/fences.png",
    chest: "/assets/sprout-lands/objects/chest.png",
    chickenHouse: "/assets/sprout-lands/objects/chicken-house.png",
    eggItem: "/assets/sprout-lands/objects/egg-item.png",
    furniture: "/assets/sprout-lands/objects/furniture.png",
    cottageSet: "/assets/sprout-lands/objects/furniture/cottage-set.png",
    grassBiomeThings: "/assets/sprout-lands/objects/grass-biome-things.png",
    toolsAndLoot: "/assets/sprout-lands/objects/items/tools-and-loot.png",
    milkAndGrassItem: "/assets/sprout-lands/objects/milk-and-grass-item.png",
    plants: "/assets/sprout-lands/objects/plants.png",
    toolsAndMaterials: "/assets/sprout-lands/objects/tools-and-materials.png",
    woodBridge: "/assets/sprout-lands/objects/wood-bridge.png",
  },
  character: {
    character: "/assets/sprout-lands/characters/basic-character.png",
    characterActions: "/assets/sprout-lands/characters/basic-character-actions.png",
    blacksmith: "/assets/sprout-lands/characters/blacksmith.png",
    chicken: "/assets/sprout-lands/characters/chicken.png",
    cow: "/assets/sprout-lands/characters/cow.png",
    eggAndNest: "/assets/sprout-lands/characters/egg-and-nest.png",
    guard: "/assets/sprout-lands/characters/guard.png",
    innkeeper: "/assets/sprout-lands/characters/innkeeper.png",
    noble: "/assets/sprout-lands/characters/noble.png",
    sheep: "/assets/sprout-lands/characters/sheep.png",
    streetVendor: "/assets/sprout-lands/characters/street-vendor.png",
    characterTools: "/assets/sprout-lands/characters/tools.png",
    townsfolk: "/assets/sprout-lands/characters/townsfolk.png",
    vegetableVendor: "/assets/sprout-lands/characters/vegetable-vendor.png",
    villager: "/assets/sprout-lands/characters/villager.png",
  },
} as const

export const ATLAS_IMAGES = {
  ...ATLAS_IMAGE_GROUPS.ground,
  ...ATLAS_IMAGE_GROUPS.building,
  ...ATLAS_IMAGE_GROUPS.object,
  ...ATLAS_IMAGE_GROUPS.character,
} as const

export type AtlasImageId = keyof typeof ATLAS_IMAGES

export function atlasCategoryFor(atlasId: string): AtlasImageCategory | null {
  for (const category of Object.keys(ATLAS_IMAGE_GROUPS) as AtlasImageCategory[]) {
    if (atlasId in ATLAS_IMAGE_GROUPS[category]) return category
  }
  return null
}

const CHARACTER_SPRITE_ATLAS_ALIASES: Record<string, string> = {
  "street-vendor": "streetVendor",
  "vegetable-vendor": "vegetableVendor",
}

export function atlasIdForCharacterSprite(spriteId: string): string | null {
  const atlasId = CHARACTER_SPRITE_ATLAS_ALIASES[spriteId] ?? spriteId
  return atlasId in ATLAS_IMAGE_GROUPS.character ? atlasId : null
}

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

export function npcCharacterSpriteId(
  atlasId: string,
  direction: Direction,
  frame = 0
): string {
  return `entity:npc:${atlasId}:${direction}:${wrapCharacterFrame(frame)}`
}

function characterSpriteEntry(
  atlasId: string,
  direction: Direction,
  frame: number
): SpriteAtlasEntry {
  const isSide = direction === "left" || direction === "right"
  return {
    atlasId,
    sx: frame * CHARACTER_CELL_PX + (isSide ? 19 : 17),
    sy: CHARACTER_ROW[direction] * CHARACTER_CELL_PX + 16,
    sw: isSide ? 10 : 14,
    sh: 16,
  }
}

const CHARACTER_SPRITES: SpriteAtlas = {}
const NPC_CHARACTER_ATLAS_IDS = [
  "blacksmith",
  "chicken",
  "cow",
  "guard",
  "innkeeper",
  "noble",
  "sheep",
  "streetVendor",
  "townsfolk",
  "vegetableVendor",
  "villager",
] as const
const NPC_CHARACTER_SPRITES: SpriteAtlas = {}

for (const kind of CHARACTER_KINDS) {
  for (const direction of CHARACTER_DIRECTIONS) {
    for (let frame = 0; frame < CHARACTER_FRAME_COUNT; frame += 1) {
      CHARACTER_SPRITES[characterSpriteId(kind, direction, frame)] = characterSpriteEntry(
        "character",
        direction,
        frame
      )
    }
  }
}

for (const atlasId of NPC_CHARACTER_ATLAS_IDS) {
  for (const direction of CHARACTER_DIRECTIONS) {
    for (let frame = 0; frame < CHARACTER_FRAME_COUNT; frame += 1) {
      NPC_CHARACTER_SPRITES[npcCharacterSpriteId(atlasId, direction, frame)] =
        characterSpriteEntry(atlasId, direction, frame)
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
  ...NPC_CHARACTER_SPRITES,
  "entity:player:front": CHARACTER_SPRITES[characterSpriteId("player", "down", 0)],
  "entity:npc:front": CHARACTER_SPRITES[characterSpriteId("npc", "down", 0)],
}
