import { sampleOpenMap } from "@/game-core/fixtures/sample-maps"
import { loadMap } from "@/game-core/map/loader"

function cloneSample() {
  return JSON.parse(JSON.stringify(sampleOpenMap()))
}

describe("loadMap", () => {
  it("loads valid TileMap JSON", () => {
    const result = loadMap(cloneSample())

    expect(result.meta.id).toBe("open_test")
    expect(result.width).toBe(8)
    expect(result.height).toBe(8)
    expect(result.tileSize).toBe(16)
    expect(result.layers.map((layer) => layer.name)).toEqual([
      "ground",
      "decoration",
      "object",
      "overlay",
    ])
    expect(result.spawnPoints).toHaveLength(2)
    expect(result.transitions).toEqual([])
  })

  it("rejects non-object input", () => {
    expect(() => loadMap(null)).toThrow("Invalid TileMap: not an object")
    expect(() => loadMap("bad")).toThrow("Invalid TileMap: not an object")
  })

  it("rejects missing top-level fields", () => {
    expect(() => loadMap({ meta: { id: "missing" } })).toThrow(
      "Invalid TileMap: missing required fields"
    )
  })

  it("rejects invalid dimensions and tile size", () => {
    const badWidth = cloneSample()
    badWidth.width = 0
    expect(() => loadMap(badWidth)).toThrow("Invalid TileMap: width must be a positive integer")

    const badTileSize = cloneSample()
    badTileSize.tileSize = 32
    expect(() => loadMap(badTileSize)).toThrow("Invalid TileMap: tileSize must be 16")
  })

  it("rejects invalid biome values", () => {
    const bad = cloneSample()
    bad.meta.biome = "space_station"

    expect(() => loadMap(bad)).toThrow("Invalid TileMap: meta.biome")
  })

  it("requires exactly four ordered layers", () => {
    const missingLayer = cloneSample()
    missingLayer.layers.pop()
    expect(() => loadMap(missingLayer)).toThrow(
      "Invalid TileMap: layers must contain exactly 4 layers"
    )

    const wrongOrder = cloneSample()
    wrongOrder.layers[0].name = "object"
    expect(() => loadMap(wrongOrder)).toThrow('Invalid TileMap: layer[0].name must be "ground"')
  })

  it("rejects layer rows with the wrong size", () => {
    const bad = cloneSample()
    bad.layers[0].tiles[0] = bad.layers[0].tiles[0].slice(0, 5)

    expect(() => loadMap(bad)).toThrow("Invalid TileMap: layer[0].tiles[0] must have 8 columns")
  })

  it("rejects unknown tile types", () => {
    const bad = cloneSample()
    bad.layers[0].tiles[2][2] = "lava"

    expect(() => loadMap(bad)).toThrow("Invalid TileMap: layer[0].tiles[2][2] is not a valid TileType")
  })

  it("rejects malformed elevation grids", () => {
    const badRows = cloneSample()
    badRows.elevation.pop()
    expect(() => loadMap(badRows)).toThrow("Invalid TileMap: elevation must have 8 rows")

    const badValue = cloneSample()
    badValue.elevation[1][1] = 1.5
    expect(() => loadMap(badValue)).toThrow("Invalid TileMap: elevation[1][1] must be an integer")
  })

  it("rejects out-of-bounds spawn and transition coordinates", () => {
    const badSpawn = cloneSample()
    badSpawn.spawnPoints[0].x = 99
    expect(() => loadMap(badSpawn)).toThrow("Invalid TileMap: spawnPoints[0] is out of bounds")

    const badTransition = cloneSample()
    badTransition.transitions.push({
      x: 1,
      y: 1,
      targetMapId: "next",
      targetX: -1,
      targetY: 2,
      facing: "down",
    })
    expect(() => loadMap(badTransition)).toThrow(
      "Invalid TileMap: transitions[0].target is out of bounds"
    )
  })
})
