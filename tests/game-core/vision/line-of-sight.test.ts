import { sampleOpenMap, sampleWalledMap } from "@/game-core/fixtures/sample-maps"
import { hasLineOfSight, isTileTransparent } from "@/game-core/vision/line-of-sight"

describe("isTileTransparent", () => {
  it("treats clear grass as transparent", () => {
    expect(isTileTransparent(sampleOpenMap(), 3, 3)).toBe(true)
  })

  it("treats wall cells and out-of-bounds cells as opaque", () => {
    expect(isTileTransparent(sampleWalledMap(), 4, 3)).toBe(false)
    expect(isTileTransparent(sampleOpenMap(), -1, 0)).toBe(false)
  })
})

describe("hasLineOfSight", () => {
  it("returns true when source and target are the same cell", () => {
    expect(hasLineOfSight(sampleOpenMap(), { x: 3, y: 3 }, { x: 3, y: 3 })).toBe(true)
  })

  it("passes horizontal, vertical, diagonal, and steep open paths", () => {
    const map = sampleOpenMap()

    expect(hasLineOfSight(map, { x: 6, y: 3 }, { x: 1, y: 3 })).toBe(true)
    expect(hasLineOfSight(map, { x: 3, y: 0 }, { x: 3, y: 7 })).toBe(true)
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 7, y: 7 })).toBe(true)
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 2, y: 5 })).toBe(true)
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 7, y: 2 })).toBe(true)
  })

  it("does not treat the target tile itself as a blocker", () => {
    expect(hasLineOfSight(sampleWalledMap(), { x: 6, y: 3 }, { x: 4, y: 3 })).toBe(true)
  })

  it("blocks paths with opaque intermediate tiles", () => {
    const map = sampleWalledMap()

    expect(hasLineOfSight(map, { x: 6, y: 3 }, { x: 1, y: 3 })).toBe(false)
    expect(hasLineOfSight(map, { x: 2, y: 0 }, { x: 2, y: 7 })).toBe(true)
    expect(hasLineOfSight(map, { x: 6, y: 0 }, { x: 1, y: 0 })).toBe(true)
  })

  it("terminates for every pair of in-bounds endpoints", () => {
    const map = sampleOpenMap()

    for (let x0 = 0; x0 < map.width; x0++) {
      for (let y0 = 0; y0 < map.height; y0++) {
        for (let x1 = 0; x1 < map.width; x1++) {
          for (let y1 = 0; y1 < map.height; y1++) {
            expect(typeof hasLineOfSight(map, { x: x0, y: y0 }, { x: x1, y: y1 })).toBe(
              "boolean"
            )
          }
        }
      }
    }
  })
})
