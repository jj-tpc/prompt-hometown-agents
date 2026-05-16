import { TILE_DEFINITIONS } from "@/game-core/map/tile-definitions"
import type { TileType } from "@/game-core/types/map"

const ALL_TILE_TYPES: TileType[] = [
  "void",
  "grass",
  "dirt",
  "path",
  "sand",
  "water",
  "shallow_water",
  "mountain",
  "tree",
  "bush",
  "tall_grass",
  "wall",
  "fence",
  "building_floor",
  "building_wall",
  "roof",
  "cliff_face",
  "stairs",
  "door",
  "chest",
  "sign",
  "npc_spawn",
  "player_spawn",
]

describe("TILE_DEFINITIONS", () => {
  it("defines every TileType", () => {
    for (const type of ALL_TILE_TYPES) {
      expect(TILE_DEFINITIONS[type]).toBeDefined()
      expect(TILE_DEFINITIONS[type].type).toBe(type)
    }
  })

  it("marks impassable terrain as not walkable", () => {
    expect(TILE_DEFINITIONS.void.walkable).toBe(false)
    expect(TILE_DEFINITIONS.water.walkable).toBe(false)
    expect(TILE_DEFINITIONS.mountain.walkable).toBe(false)
    expect(TILE_DEFINITIONS.tree.walkable).toBe(false)
    expect(TILE_DEFINITIONS.wall.walkable).toBe(false)
    expect(TILE_DEFINITIONS.building_wall.walkable).toBe(false)
    expect(TILE_DEFINITIONS.cliff_face.walkable).toBe(false)
  })

  it("marks passable terrain as walkable", () => {
    expect(TILE_DEFINITIONS.grass.walkable).toBe(true)
    expect(TILE_DEFINITIONS.path.walkable).toBe(true)
    expect(TILE_DEFINITIONS.building_floor.walkable).toBe(true)
    expect(TILE_DEFINITIONS.tall_grass.walkable).toBe(true)
    expect(TILE_DEFINITIONS.shallow_water.walkable).toBe(true)
    expect(TILE_DEFINITIONS.stairs.walkable).toBe(true)
  })

  it("marks sight blockers as opaque", () => {
    expect(TILE_DEFINITIONS.void.transparent).toBe(false)
    expect(TILE_DEFINITIONS.wall.transparent).toBe(false)
    expect(TILE_DEFINITIONS.building_wall.transparent).toBe(false)
    expect(TILE_DEFINITIONS.tree.transparent).toBe(false)
    expect(TILE_DEFINITIONS.mountain.transparent).toBe(false)
    expect(TILE_DEFINITIONS.cliff_face.transparent).toBe(false)
  })

  it("marks non-blocking tiles as transparent", () => {
    expect(TILE_DEFINITIONS.grass.transparent).toBe(true)
    expect(TILE_DEFINITIONS.water.transparent).toBe(true)
    expect(TILE_DEFINITIONS.fence.transparent).toBe(true)
    expect(TILE_DEFINITIONS.tall_grass.transparent).toBe(true)
    expect(TILE_DEFINITIONS.building_floor.transparent).toBe(true)
    expect(TILE_DEFINITIONS.stairs.transparent).toBe(true)
  })

  it("provides sprite ids for every tile", () => {
    for (const type of ALL_TILE_TYPES) {
      expect(TILE_DEFINITIONS[type].spriteId).not.toBe("")
    }
  })
})
