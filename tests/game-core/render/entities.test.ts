import { entitiesFromSpawns } from "@/game-core/render/entities"
import { SPRITE_ATLAS, characterSpriteId } from "@/game-core/render/terrain-tiles"
import type { TileMap } from "@/game-core/types/map"

const stubMap = {
  spawnPoints: [
    { id: "player_start", x: 1, y: 1, facing: "down", entityType: "player" },
    { id: "npc_a", x: 3, y: 2, facing: "left", entityType: "npc", npcId: "npc_a" },
  ],
  elevation: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
} as unknown as TileMap

describe("entitiesFromSpawns", () => {
  it("creates a RenderEntity for each spawn point", () => {
    expect(entitiesFromSpawns(stubMap)).toHaveLength(2)
  })

  it("player spawn uses the facing direction's idle sprite", () => {
    const player = entitiesFromSpawns(stubMap).find((e) => e.id === "player_start")

    expect(player?.spriteId).toBe("entity:player:down:0")
    expect(player).toMatchObject({ gridX: 1, gridY: 1, elevation: 0 })
  })

  it("npc spawn uses the facing direction's idle sprite", () => {
    const npc = entitiesFromSpawns(stubMap).find((e) => e.id === "npc_a")

    expect(npc?.spriteId).toBe("entity:npc:left:0")
    expect(npc).toMatchObject({ gridX: 3, gridY: 2 })
  })
})

describe("characterSpriteId", () => {
  it("maps every direction and frame to the basic character sheet", () => {
    expect(characterSpriteId("player", "down", 0)).toBe("entity:player:down:0")
    expect(characterSpriteId("player", "up", 2)).toBe("entity:player:up:2")
    expect(characterSpriteId("player", "right", 3)).toBe("entity:player:right:3")
    expect(characterSpriteId("player", "left", 1)).toBe("entity:player:left:1")
  })

  it("wraps walking frames across the four available columns", () => {
    expect(characterSpriteId("player", "down", 5)).toBe("entity:player:down:1")
  })

  it("registers atlas crops for directional walking frames", () => {
    expect(SPRITE_ATLAS[characterSpriteId("player", "down", 0)]).toMatchObject({
      atlasId: "character",
      sx: 17,
      sy: 16,
      sw: 14,
      sh: 16,
    })
    expect(SPRITE_ATLAS[characterSpriteId("player", "up", 0)]).toMatchObject({
      sx: 17,
      sy: 64,
    })
    expect(SPRITE_ATLAS[characterSpriteId("player", "right", 0)]).toMatchObject({
      sx: 19,
      sy: 112,
      sw: 10,
    })
    expect(SPRITE_ATLAS[characterSpriteId("player", "left", 0)]).toMatchObject({
      sx: 19,
      sy: 160,
      sw: 10,
    })
  })
})
