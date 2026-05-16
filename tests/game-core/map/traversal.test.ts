import { canTraverse, isCellWalkable } from "@/game-core/map/traversal"
import {
  sampleElevatedMap,
  sampleOpenMap,
  sampleWalledMap,
} from "@/game-core/fixtures/sample-maps"

describe("isCellWalkable", () => {
  it("treats grass as walkable", () => {
    expect(isCellWalkable(sampleOpenMap(), 3, 3)).toBe(true)
  })

  it("treats walls and cliff faces as blocked", () => {
    expect(isCellWalkable(sampleWalledMap(), 4, 3)).toBe(false)
    expect(isCellWalkable(sampleElevatedMap(), 4, 1)).toBe(false)
  })

  it("treats stairs as walkable", () => {
    expect(isCellWalkable(sampleElevatedMap(), 4, 4)).toBe(true)
  })

  it("rejects out-of-bounds cells", () => {
    expect(isCellWalkable(sampleOpenMap(), -1, 0)).toBe(false)
  })
})

describe("canTraverse", () => {
  it("allows adjacent movement on the same elevation", () => {
    expect(canTraverse(sampleOpenMap(), { x: 1, y: 3 }, { x: 2, y: 3 })).toBe(true)
  })

  it("rejects movement into blocked tiles", () => {
    expect(canTraverse(sampleWalledMap(), { x: 3, y: 3 }, { x: 4, y: 3 })).toBe(false)
  })

  it("allows one-step elevation changes through stairs in either direction", () => {
    expect(canTraverse(sampleElevatedMap(), { x: 3, y: 4 }, { x: 4, y: 4 })).toBe(true)
    expect(canTraverse(sampleElevatedMap(), { x: 4, y: 4 }, { x: 3, y: 4 })).toBe(true)
  })

  it("rejects cliff elevation changes without stairs", () => {
    expect(canTraverse(sampleElevatedMap(), { x: 3, y: 1 }, { x: 4, y: 1 })).toBe(false)
  })

  it("rejects jumps of two or more elevation levels", () => {
    const map = sampleElevatedMap()
    map.elevation[1][2] = 2

    expect(canTraverse(map, { x: 1, y: 1 }, { x: 2, y: 1 })).toBe(false)
  })

  it("rejects non-adjacent, diagonal, and out-of-bounds movement", () => {
    const map = sampleOpenMap()

    expect(canTraverse(map, { x: 1, y: 3 }, { x: 3, y: 3 })).toBe(false)
    expect(canTraverse(map, { x: 1, y: 3 }, { x: 2, y: 4 })).toBe(false)
    expect(canTraverse(map, { x: 0, y: 0 }, { x: -1, y: 0 })).toBe(false)
  })
})
