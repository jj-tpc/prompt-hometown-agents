import { depthSortKey, sortRenderables } from "@/game-core/render/depth-sort"

describe("depthSortKey", () => {
  it("base의 월드 Y를 키로 쓴다", () => {
    expect(depthSortKey(5, 0)).toBe(80)
  })

  it("elevation은 키를 한 단계 위로 올린다", () => {
    expect(depthSortKey(3, 1)).toBe(32)
  })
})

describe("sortRenderables", () => {
  it("depthSortKey 오름차순 — 화면 위쪽이 먼저", () => {
    const sorted = sortRenderables([
      { gridY: 5, elevation: 0 },
      { gridY: 3, elevation: 1 },
    ])
    expect(sorted[0]).toEqual({ gridY: 3, elevation: 1 })
    expect(sorted[1]).toEqual({ gridY: 5, elevation: 0 })
  })

  it("키가 같으면 elevation 높은 쪽을 먼저(뒤에)", () => {
    const sorted = sortRenderables([
      { gridY: 2, elevation: 0, id: "low" },
      { gridY: 3, elevation: 1, id: "high" },
    ])
    // 둘 다 키 32 → elevation 높은 high가 먼저
    expect(sorted[0].id).toBe("high")
  })

  it("원본 배열을 변경하지 않는다", () => {
    const input = [
      { gridY: 5, elevation: 0 },
      { gridY: 1, elevation: 0 },
    ]
    sortRenderables(input)
    expect(input[0].gridY).toBe(5)
  })
})
