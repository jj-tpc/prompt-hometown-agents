import { createBlankTileMap } from "@/game-core/map-editor/create-map"
import {
  clearSpriteOverride,
  eraseTile,
  moveSpawn,
  paintTile,
  removeSpawn,
  setElevation,
  setSpriteOverride,
  upsertNpcSpawn,
} from "@/game-core/map-editor/editor-reducer"

function makeMap() {
  return createBlankTileMap({ id: "edit_test", name: "Edit Test", width: 5, height: 5 })
}

describe("map editor reducer helpers", () => {
  it("paints a tile immutably", () => {
    const map = makeMap()
    const next = paintTile(map, "ground", 1, 2, "water")

    expect(next).not.toBe(map)
    expect(next.layers[0].tiles[2][1]).toBe("water")
    expect(map.layers[0].tiles[2][1]).toBe("grass")
  })

  it("returns the same map for out-of-bounds paint", () => {
    const map = makeMap()
    expect(paintTile(map, "ground", -1, 0, "water")).toBe(map)
  })

  it("erases ground back to grass", () => {
    const map = paintTile(makeMap(), "ground", 1, 1, "water")
    const next = eraseTile(map, "ground", 1, 1)

    expect(next.layers[0].tiles[1][1]).toBe("grass")
  })

  it("erases nullable layers to null", () => {
    const map = paintTile(makeMap(), "object", 1, 1, "fence")
    const next = eraseTile(map, "object", 1, 1)

    expect(next.layers[2].tiles[1][1]).toBeNull()
  })

  it("stores exact sprite overrides by layer and cell", () => {
    const map = paintTile(makeMap(), "ground", 1, 1, "grass")
    const next = setSpriteOverride(map, {
      layer: "ground",
      x: 1,
      y: 1,
      baseTile: "grass",
      atlasId: "grass",
      sx: 32,
      sy: 16,
      sw: 16,
      sh: 16,
    })

    expect(next.spriteOverrides).toEqual([
      {
        layer: "ground",
        x: 1,
        y: 1,
        baseTile: "grass",
        atlasId: "grass",
        sx: 32,
        sy: 16,
        sw: 16,
        sh: 16,
      },
    ])
  })

  it("clears sprite overrides when the cell is repainted or erased", () => {
    const map = setSpriteOverride(makeMap(), {
      layer: "ground",
      x: 1,
      y: 1,
      atlasId: "grass",
      sx: 32,
      sy: 16,
      sw: 16,
      sh: 16,
    })

    expect(paintTile(map, "ground", 1, 1, "water").spriteOverrides).toBeUndefined()

    const withObjectOverride = setSpriteOverride(paintTile(makeMap(), "object", 2, 2, "fence"), {
      layer: "object",
      x: 2,
      y: 2,
      atlasId: "fence",
      sx: 16,
      sy: 0,
      sw: 16,
      sh: 16,
    })

    expect(eraseTile(withObjectOverride, "object", 2, 2).spriteOverrides).toBeUndefined()
    expect(clearSpriteOverride(withObjectOverride, "object", 2, 2).spriteOverrides).toBeUndefined()
  })

  it("sets and clamps elevation", () => {
    const high = setElevation(makeMap(), 2, 2, 9)
    const low = setElevation(high, 2, 2, -4)

    expect(high.elevation[2][2]).toBe(3)
    expect(low.elevation[2][2]).toBe(0)
  })

  it("moves an existing spawn without changing unrelated spawns", () => {
    const map = upsertNpcSpawn(makeMap(), {
      id: "npc_test",
      x: 1,
      y: 1,
      facing: "left",
      entityType: "npc",
      npcId: "npc_test",
    })
    const next = moveSpawn(map, "npc_test", 3, 4)

    expect(next.spawnPoints.find((spawn) => spawn.id === "player_start")).toEqual(
      map.spawnPoints.find((spawn) => spawn.id === "player_start")
    )
    expect(next.spawnPoints.find((spawn) => spawn.id === "npc_test")).toMatchObject({
      x: 3,
      y: 4,
    })
  })

  it("upserts npc spawns and ignores invalid npc spawns", () => {
    const map = makeMap()
    const withNpc = upsertNpcSpawn(map, {
      id: "npc_test",
      x: 1,
      y: 1,
      facing: "down",
      entityType: "npc",
      npcId: "npc_test",
    })
    const movedNpc = upsertNpcSpawn(withNpc, {
      id: "npc_test",
      x: 2,
      y: 2,
      facing: "up",
      entityType: "npc",
      npcId: "npc_test",
    })

    expect(withNpc.spawnPoints).toHaveLength(2)
    expect(movedNpc.spawnPoints).toHaveLength(2)
    expect(movedNpc.spawnPoints.find((spawn) => spawn.id === "npc_test")).toMatchObject({
      x: 2,
      y: 2,
      facing: "up",
    })
    expect(
      upsertNpcSpawn(map, { id: "bad", x: 1, y: 1, facing: "down", entityType: "player" })
    ).toBe(map)
  })

  it("removes a spawn by id", () => {
    const map = upsertNpcSpawn(makeMap(), {
      id: "npc_test",
      x: 1,
      y: 1,
      facing: "down",
      entityType: "npc",
      npcId: "npc_test",
    })

    expect(removeSpawn(map, "npc_test").spawnPoints.map((spawn) => spawn.id)).toEqual([
      "player_start",
    ])
  })
})
