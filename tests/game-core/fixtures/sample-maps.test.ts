import {
  sampleElevatedMap,
  sampleOpenMap,
  sampleWalledMap,
} from "@/game-core/fixtures/sample-maps"

describe("sample map fixtures", () => {
  it("creates an 8x8 open map with player and npc spawns", () => {
    const map = sampleOpenMap()

    expect(map.meta.id).toBe("open_test")
    expect(map.width).toBe(8)
    expect(map.height).toBe(8)
    expect(map.tileSize).toBe(16)
    expect(map.layers.map((layer) => layer.name)).toEqual([
      "ground",
      "decoration",
      "object",
      "overlay",
    ])
    expect(map.layers[0].tiles[3][1]).toBe("grass")
    expect(map.elevation[7][7]).toBe(0)
    expect(map.spawnPoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityType: "player", x: 1, y: 3 }),
        expect.objectContaining({ entityType: "npc", npcId: "npc_rabbit", x: 6, y: 3 }),
      ])
    )
  })

  it("creates a walled map with an opaque barrier at x=4", () => {
    const objectLayer = sampleWalledMap().layers.find((layer) => layer.name === "object")

    expect(objectLayer?.tiles[0][4]).toBeNull()
    for (let y = 1; y <= 6; y++) {
      expect(objectLayer?.tiles[y][4]).toBe("wall")
    }
    expect(objectLayer?.tiles[7][4]).toBeNull()
  })

  it("creates an elevated map with a stair crossing through the cliff", () => {
    const map = sampleElevatedMap()
    const objectLayer = map.layers.find((layer) => layer.name === "object")

    expect(map.elevation[1][3]).toBe(0)
    expect(map.elevation[1][4]).toBe(1)
    expect(objectLayer?.tiles[1][4]).toBe("cliff_face")
    expect(objectLayer?.tiles[4][4]).toBe("stairs")
  })
})
