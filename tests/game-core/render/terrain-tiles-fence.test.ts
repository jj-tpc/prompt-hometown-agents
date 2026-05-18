import { ATLAS_IMAGES, SPRITE_ATLAS } from "@/game-core/render/terrain-tiles"

describe("fence sprite", () => {
  it("ATLAS_IMAGES에 fence 항목이 있어야 함", () => {
    expect((ATLAS_IMAGES as Record<string, string>)["fence"]).toBeDefined()
  })

  it("SPRITE_ATLAS에 tiles:fence 항목이 있어야 함", () => {
    expect(SPRITE_ATLAS["tiles:fence"]).toBeDefined()
  })

  it("tiles:fence가 fence atlas를 가리켜야 함", () => {
    expect(SPRITE_ATLAS["tiles:fence"]?.atlasId).toBe("fence")
  })
})

