import {
  cliffTileSourceFor,
  elevationGapBackfillSourceFor,
  gridToScreen,
  groundTileSourceFor,
  hillObjectTileFor,
  stairsTileSourceFor,
  tileSpriteIdFor,
} from "@/game-core/render/tilemap-renderer"
import { demoTerrainMap } from "@/game-core/fixtures/demo-terrain-map"

describe("gridToScreen", () => {
  it("converts elevation 0 grid coordinates to tile pixels", () => {
    expect(gridToScreen(2, 3, 0, { x: 0, y: 0 })).toEqual({ x: 32, y: 48 })
  })

  it("lifts elevation 1 by one tile", () => {
    expect(gridToScreen(2, 3, 1, { x: 0, y: 0 })).toEqual({ x: 32, y: 32 })
  })

  it("applies the camera offset", () => {
    expect(gridToScreen(2, 3, 0, { x: 10, y: 20 })).toEqual({ x: 22, y: 28 })
  })
})

describe("tileSpriteIdFor", () => {
  it("returns the sprite id for a ground tile", () => {
    expect(tileSpriteIdFor(demoTerrainMap(), "ground", 0, 0)).toBe("tiles:water")
  })

  it("returns null for empty layer cells and out-of-bounds coordinates", () => {
    expect(tileSpriteIdFor(demoTerrainMap(), "decoration", 0, 0)).toBeNull()
    expect(tileSpriteIdFor(demoTerrainMap(), "ground", -1, 0)).toBeNull()
  })
})

describe("groundTileSourceFor", () => {
  it("keeps flat grass on the grass atlas", () => {
    expect(groundTileSourceFor(demoTerrainMap(), 2, 2)).toMatchObject({
      atlasId: "grass",
      elevation: 0,
    })
  })

  it("uses the natural hills atlas top-left tile for the plateau corner", () => {
    expect(groundTileSourceFor(demoTerrainMap(), 4, 4)).toMatchObject({
      atlasId: "hills",
      sx: 0,
      sy: 0,
      elevation: 0,
    })
  })

  it("uses the natural hills atlas middle top tile for the plateau top edge", () => {
    expect(groundTileSourceFor(demoTerrainMap(), 8, 4)).toMatchObject({
      atlasId: "hills",
      sx: 16,
      sy: 0,
      elevation: 0,
    })
  })

  it("uses a top-surface tile, not a cliff tile, for the south plateau edge", () => {
    expect(groundTileSourceFor(demoTerrainMap(), 8, 7)).toMatchObject({
      atlasId: "hills",
      sx: 16,
      sy: 16,
      elevation: 0,
    })
  })
})

describe("elevationGapBackfillSourceFor", () => {
  it("fills lower grass beside a raised hill with a solid grass center tile", () => {
    const source = groundTileSourceFor(demoTerrainMap(), 13, 4)

    expect(elevationGapBackfillSourceFor(demoTerrainMap(), 13, 4, source)).toMatchObject({
      atlasId: "grass",
      sx: 16,
      sy: 16,
      elevation: 0,
    })
  })

  it("does not fill ordinary flat grass", () => {
    const source = groundTileSourceFor(demoTerrainMap(), 2, 2)

    expect(elevationGapBackfillSourceFor(demoTerrainMap(), 2, 2, source)).toBeNull()
  })
})

describe("hillObjectTileFor", () => {
  it("preserves explicit stairs on the hill face", () => {
    expect(hillObjectTileFor(demoTerrainMap(), 8, 8)).toBe("stairs")
    expect(hillObjectTileFor(demoTerrainMap(), 9, 8)).toBe("stairs")
    expect(hillObjectTileFor(demoTerrainMap(), 8, 9)).toBe("stairs")
    expect(hillObjectTileFor(demoTerrainMap(), 9, 9)).toBe("stairs")
  })

  it("derives a cliff face from an elevation drop when the object layer is empty", () => {
    const map = demoTerrainMap()
    const objectLayer = map.layers.find((layer) => layer.name === "object")
    if (!objectLayer) throw new Error("object layer missing")
    objectLayer.tiles[8][4] = null

    expect(hillObjectTileFor(map, 4, 8)).toBe("cliff_face")
  })
})

describe("cliffTileSourceFor", () => {
  it("treats stairs as cliff connectors so adjacent walls stay straight", () => {
    expect(cliffTileSourceFor(demoTerrainMap(), 7, 8)).toMatchObject({
      atlasId: "hills",
      sx: 16,
      sy: 32,
    })
    expect(cliffTileSourceFor(demoTerrainMap(), 10, 8)).toMatchObject({
      atlasId: "hills",
      sx: 16,
      sy: 32,
    })
  })
})

describe("stairsTileSourceFor", () => {
  it("uses the connected 2x2 stair block from hills.png", () => {
    expect(stairsTileSourceFor(demoTerrainMap(), 8, 8)).toMatchObject({
      atlasId: "hills",
      sx: 9 * 16,
      sy: 5 * 16,
    })
    expect(stairsTileSourceFor(demoTerrainMap(), 9, 8)).toMatchObject({
      atlasId: "hills",
      sx: 10 * 16,
      sy: 5 * 16,
    })
    expect(stairsTileSourceFor(demoTerrainMap(), 8, 9)).toMatchObject({
      atlasId: "hills",
      sx: 9 * 16,
      sy: 6 * 16,
    })
    expect(stairsTileSourceFor(demoTerrainMap(), 9, 9)).toMatchObject({
      atlasId: "hills",
      sx: 10 * 16,
      sy: 6 * 16,
    })
  })
})
