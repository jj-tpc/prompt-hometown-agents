import { loadMap } from "@/game-core/map/loader"
import { createBlankTileMap, createWaterBaseGrassTileMap } from "@/game-core/map-editor/create-map"

describe("createBlankTileMap", () => {
  const map = createBlankTileMap({
    id: "blank_test",
    name: "Blank Test",
    width: 8,
    height: 6,
  })

  it("creates a valid TileMap", () => {
    expect(loadMap(map).meta.id).toBe("blank_test")
  })

  it("uses 16px tiles and requested dimensions", () => {
    expect(map.tileSize).toBe(16)
    expect(map.width).toBe(8)
    expect(map.height).toBe(6)
  })

  it("creates all four layers in renderer order", () => {
    expect(map.layers.map((layer) => layer.name)).toEqual([
      "ground",
      "decoration",
      "object",
      "overlay",
    ])
  })

  it("fills ground with grass and nullable layers with null", () => {
    expect(map.layers[0].tiles[0][0]).toBe("grass")
    expect(map.layers[1].tiles[0][0]).toBeNull()
    expect(map.layers[2].tiles[0][0]).toBeNull()
    expect(map.layers[3].tiles[0][0]).toBeNull()
  })

  it("creates elevation rows matching the map dimensions", () => {
    expect(map.elevation).toHaveLength(6)
    expect(map.elevation[0]).toHaveLength(8)
    expect(map.elevation.flat().every((value) => value === 0)).toBe(true)
  })

  it("places one player spawn in the center", () => {
    expect(map.spawnPoints).toEqual([
      {
        id: "player_start",
        x: 4,
        y: 3,
        facing: "down",
        entityType: "player",
      },
    ])
  })
})

describe("createWaterBaseGrassTileMap", () => {
  const map = createWaterBaseGrassTileMap({
    id: "water_base",
    name: "Water Base",
    size: 20,
  })

  it("creates a square preset map", () => {
    expect(loadMap(map).meta.id).toBe("water_base")
    expect(map.width).toBe(20)
    expect(map.height).toBe(20)
  })

  it("keeps water around the field and places grass in the center", () => {
    expect(map.layers[0].tiles[0][0]).toBe("water")
    expect(map.layers[0].tiles[1][10]).toBe("water")
    expect(map.layers[0].tiles[2][2]).toBe("grass")
    expect(map.layers[0].tiles[10][10]).toBe("grass")
  })

  it("places the player spawn on the grass field", () => {
    const spawn = map.spawnPoints[0]
    expect(map.layers[0].tiles[spawn.y][spawn.x]).toBe("grass")
  })
})
