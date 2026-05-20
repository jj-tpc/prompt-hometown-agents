import { makeBlackPixelsTransparent } from "@/game-core/render/atlas-image-loader"

describe("makeBlackPixelsTransparent", () => {
  it("turns transparent-key black pixels into alpha 0", () => {
    const pixels = new Uint8ClampedArray([
      0, 0, 0, 255,
      3, 2, 1, 255,
      4, 0, 0, 255,
      20, 12, 8, 255,
    ])

    expect(makeBlackPixelsTransparent(pixels)).toBe(2)
    expect(Array.from(pixels)).toEqual([
      0, 0, 0, 0,
      3, 2, 1, 0,
      4, 0, 0, 255,
      20, 12, 8, 255,
    ])
  })
})
