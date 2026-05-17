import { demoTerrainMap } from "@/game-core/fixtures/demo-terrain-map"
import { loadMap } from "@/game-core/map/loader"
import { canTraverse } from "@/game-core/map/traversal"

describe("demoTerrainMap", () => {
  it("loads as a larger valid TileMap fixture for terrain rendering QA", () => {
    const map = loadMap(demoTerrainMap())

    expect(map.meta.id).toBe("demo_terrain")
    expect(map.width).toBe(20)
    expect(map.height).toBe(14)
    expect(map.layers.map((layer) => layer.name)).toEqual([
      "ground",
      "decoration",
      "object",
      "overlay",
    ])
  })

  it("keeps water around the island and grass where the hill sits", () => {
    const ground = loadMap(demoTerrainMap()).layers[0].tiles

    expect(ground[0].every((tile) => tile === "water")).toBe(true)
    expect(ground[1][3]).toBe("grass")
    expect(ground[5][8]).toBe("grass")
    expect(ground[12][10]).toBe("grass")
    expect(ground[13].every((tile) => tile === "water")).toBe(true)
  })

  it("raises a broad plateau to elevation 1", () => {
    const map = loadMap(demoTerrainMap())

    expect(map.elevation[4][4]).toBe(1)
    expect(map.elevation[6][8]).toBe(1)
    expect(map.elevation[7][12]).toBe(1)
    expect(map.elevation[8][8]).toBe(0)
    expect(map.elevation[1][1]).toBe(0)
  })

  it("places a south cliff with a connected 2x2 stair block", () => {
    const objectLayer = loadMap(demoTerrainMap()).layers[2].tiles

    expect(objectLayer[8][4]).toBe("cliff_face")
    expect(objectLayer[8][8]).toBe("stairs")
    expect(objectLayer[8][9]).toBe("stairs")
    expect(objectLayer[8][12]).toBe("cliff_face")
    expect(objectLayer[9][8]).toBe("stairs")
    expect(objectLayer[9][9]).toBe("stairs")
  })
})

describe("demoTerrainMap traversal", () => {
  const map = loadMap(demoTerrainMap())

  it("allows movement inside the plateau", () => {
    expect(canTraverse(map, { x: 6, y: 6 }, { x: 7, y: 6 })).toBe(true)
  })

  it("allows movement down through the connected stairs", () => {
    expect(canTraverse(map, { x: 8, y: 7 }, { x: 8, y: 8 })).toBe(true)
    expect(canTraverse(map, { x: 8, y: 8 }, { x: 8, y: 9 })).toBe(true)
    expect(canTraverse(map, { x: 9, y: 7 }, { x: 9, y: 8 })).toBe(true)
  })

  it("rejects movement through cliff faces", () => {
    expect(canTraverse(map, { x: 4, y: 7 }, { x: 4, y: 8 })).toBe(false)
  })
})
