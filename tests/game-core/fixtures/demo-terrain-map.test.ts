import { demoTerrainMap } from "@/game-core/fixtures/demo-terrain-map"
import { loadMap } from "@/game-core/map/loader"

describe("demoTerrainMap", () => {
  it("loads as a valid TileMap fixture", () => {
    const map = loadMap(demoTerrainMap())

    expect(map.meta.id).toBe("demo_terrain")
    expect(map.width).toBe(16)
    expect(map.height).toBe(12)
    expect(map.layers.map((layer) => layer.name)).toEqual([
      "ground",
      "decoration",
      "object",
      "overlay",
    ])
  })

  it("preserves the terrain preview water and grass layout in the ground layer", () => {
    const ground = loadMap(demoTerrainMap()).layers[0].tiles

    expect(ground[0].every((tile) => tile === "water")).toBe(true)
    expect(ground[1][2]).toBe("grass")
    expect(ground[3][8]).toBe("water")
    expect(ground[7][7]).toBe("grass")
    expect(ground[11].every((tile) => tile === "water")).toBe(true)
  })
})
