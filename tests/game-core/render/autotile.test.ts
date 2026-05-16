import { grassAutotile } from "@/game-core/render/autotile"

// 잔디 배치를 문자열 그리드로 표현. G=잔디, 그 외=비잔디. 맵 밖은 잔디로 취급.
function grassGrid(rows: string[]) {
  return (x: number, y: number) => {
    if (y < 0 || y >= rows.length || x < 0 || x >= rows[0].length) return true
    return rows[y][x] === "G"
  }
}

describe("grassAutotile (3×3 simple)", () => {
  it("사방이 잔디면 중앙 타일 (1,1)", () => {
    const g = grassGrid(["GGG", "GGG", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 1, row: 1 })
  })

  it("북쪽이 열리면 상단 가장자리 (1,0)", () => {
    const g = grassGrid(["...", "GGG", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 1, row: 0 })
  })

  it("남쪽이 열리면 하단 가장자리 (1,2)", () => {
    const g = grassGrid(["GGG", "GGG", "..."])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 1, row: 2 })
  })

  it("서쪽이 열리면 좌측 가장자리 (0,1)", () => {
    const g = grassGrid(["GGG", ".GG", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 0, row: 1 })
  })

  it("동쪽이 열리면 우측 가장자리 (2,1)", () => {
    const g = grassGrid(["GGG", "GG.", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 2, row: 1 })
  })

  it("북+서가 열리면 좌상단 외곽 코너 (0,0)", () => {
    const g = grassGrid(["...", ".GG", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 0, row: 0 })
  })

  it("남+동이 열리면 우하단 외곽 코너 (2,2)", () => {
    const g = grassGrid(["GGG", "GG.", "G.."])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 2, row: 2 })
  })

  it("맵 밖은 잔디로 취급 — 모서리 칸도 중앙 타일", () => {
    const g = grassGrid(["G"])
    expect(grassAutotile(g, 0, 0)).toEqual({ col: 1, row: 1 })
  })
})

describe("grassAutotile — inner corner (내부 칸의 오목 코너)", () => {
  it("대각이 모두 잔디면 완전 내부 타일 (1,1)", () => {
    const g = grassGrid(["GGG", "GGG", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 1, row: 1 })
  })

  it("NW 대각만 비면 오목 코너 (6,2)", () => {
    // 직교 4이웃은 모두 잔디, 좌상 대각만 비잔디
    const g = grassGrid([".GG", "GGG", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 6, row: 2 })
  })

  it("SE 대각만 비면 오목 코너 (5,1)", () => {
    const g = grassGrid(["GGG", "GGG", "GG."])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 5, row: 1 })
  })

  it("NE+SW 대각이 비면 (9,1)", () => {
    const g = grassGrid(["GG.", "GGG", ".GG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 9, row: 1 })
  })

  it("네 대각이 모두 비면 (8,4)", () => {
    const g = grassGrid([".G.", "GGG", ".G."])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 8, row: 4 })
  })

  it("직교 이웃이 열려 있으면 대각은 무시하고 3×3 simple 사용", () => {
    // 북쪽(+NW/NE 대각)이 열림 → 대각 무시, 상단 가장자리 타일
    const g = grassGrid(["...", "GGG", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 1, row: 0 })
  })
})
