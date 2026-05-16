import { gridToScreen, tileSpriteIdFor } from "@/game-core/render/tilemap-renderer"
import { demoTerrainMap } from "@/game-core/fixtures/demo-terrain-map"

describe("gridToScreen", () => {
  it("elevation 0 — 격자 좌표를 타일 픽셀로 변환", () => {
    expect(gridToScreen(2, 3, 0, { x: 0, y: 0 })).toEqual({ x: 32, y: 48 })
  })

  it("elevation 1 — Y를 한 단계(16px) 위로 올린다", () => {
    expect(gridToScreen(2, 3, 1, { x: 0, y: 0 })).toEqual({ x: 32, y: 32 })
  })

  it("카메라 오프셋을 뺀다", () => {
    expect(gridToScreen(2, 3, 0, { x: 10, y: 20 })).toEqual({ x: 22, y: 28 })
  })
})

describe("tileSpriteIdFor", () => {
  it("ground 레이어 (0,0)은 물 타일 spriteId", () => {
    expect(tileSpriteIdFor(demoTerrainMap(), "ground", 0, 0)).toBe("tiles:water")
  })

  it("비어 있는 decoration 레이어 칸은 null", () => {
    expect(tileSpriteIdFor(demoTerrainMap(), "decoration", 0, 0)).toBeNull()
  })

  it("맵 밖 좌표는 null", () => {
    expect(tileSpriteIdFor(demoTerrainMap(), "ground", -1, 0)).toBeNull()
  })
})
