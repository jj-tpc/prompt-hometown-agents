import { cameraForPlayer } from "@/game-core/render/camera"
import type { TileMap } from "@/game-core/types/map"

// cameraForPlayer는 map.width/height만 사용 — 테스트 stub
const bigMap = { width: 200, height: 200 } as unknown as TileMap
const viewport = { width: 320, height: 208 } // 20×13 타일

describe("cameraForPlayer", () => {
  it("좌상단 근처 플레이어 → 카메라 (0,0)", () => {
    expect(cameraForPlayer({ worldX: 40, worldY: 40 }, bigMap, viewport)).toEqual({
      x: 0,
      y: 0,
    })
  })

  it("맵 중앙에서는 플레이어를 뷰포트 중앙에 둔다", () => {
    const cam = cameraForPlayer({ worldX: 1600, worldY: 1600 }, bigMap, viewport)
    expect(cam.x).toBe(1600 - viewport.width / 2)
    expect(cam.y).toBe(1600 - viewport.height / 2)
  })

  it("우하단 → 맵 경계로 clamp", () => {
    const cam = cameraForPlayer({ worldX: 999999, worldY: 999999 }, bigMap, viewport)
    expect(cam.x).toBe(200 * 16 - viewport.width)
    expect(cam.y).toBe(200 * 16 - viewport.height)
  })

  it("맵이 뷰포트보다 작으면 (0,0)", () => {
    const tiny = { width: 5, height: 5 } as unknown as TileMap
    expect(cameraForPlayer({ worldX: 40, worldY: 40 }, tiny, viewport)).toEqual({
      x: 0,
      y: 0,
    })
  })
})
