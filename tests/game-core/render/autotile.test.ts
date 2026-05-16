import {
  grassAutotile,
  dirtAutotile,
  sandAutotile,
  pathAutotile,
  fourWayMask,
} from "@/game-core/render/autotile"

// 지형 배치를 문자열 그리드로 표현. G=해당 지형, 그 외=비지형. 맵 밖은 지형으로 취급.
function grid(rows: string[]) {
  return (x: number, y: number) => {
    if (y < 0 || y >= rows.length || x < 0 || x >= rows[0].length) return true
    return rows[y][x] === "G"
  }
}

describe("grassAutotile (3×3 simple)", () => {
  it("사방이 잔디면 중앙 타일 (1,1)", () => {
    const g = grid(["GGG", "GGG", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 1, row: 1 })
  })

  it("북쪽이 열리면 상단 가장자리 (1,0)", () => {
    const g = grid(["...", "GGG", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 1, row: 0 })
  })

  it("남쪽이 열리면 하단 가장자리 (1,2)", () => {
    const g = grid(["GGG", "GGG", "..."])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 1, row: 2 })
  })

  it("서쪽이 열리면 좌측 가장자리 (0,1)", () => {
    const g = grid(["GGG", ".GG", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 0, row: 1 })
  })

  it("동쪽이 열리면 우측 가장자리 (2,1)", () => {
    const g = grid(["GGG", "GG.", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 2, row: 1 })
  })

  it("북+서가 열리면 좌상단 외곽 코너 (0,0)", () => {
    const g = grid(["...", ".GG", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 0, row: 0 })
  })

  it("남+동이 열리면 우하단 외곽 코너 (2,2)", () => {
    const g = grid(["GGG", "GG.", "G.."])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 2, row: 2 })
  })

  it("맵 밖은 잔디로 취급 — 모서리 칸도 중앙 타일", () => {
    const g = grid(["G"])
    expect(grassAutotile(g, 0, 0)).toEqual({ col: 1, row: 1 })
  })
})

describe("grassAutotile — inner corner (내부 칸의 오목 코너)", () => {
  it("대각이 모두 잔디면 완전 내부 타일 (1,1)", () => {
    const g = grid(["GGG", "GGG", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 1, row: 1 })
  })

  it("NW 대각만 비면 오목 코너 (6,2)", () => {
    const g = grid([".GG", "GGG", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 6, row: 2 })
  })

  it("SE 대각만 비면 오목 코너 (5,1)", () => {
    const g = grid(["GGG", "GGG", "GG."])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 5, row: 1 })
  })

  it("NE+SW 대각이 비면 (9,1)", () => {
    const g = grid(["GG.", "GGG", ".GG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 9, row: 1 })
  })

  it("네 대각이 모두 비면 (8,4)", () => {
    const g = grid([".G.", "GGG", ".G."])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 8, row: 4 })
  })

  it("직교 이웃이 열려 있으면 대각은 무시하고 3×3 simple 사용", () => {
    const g = grid(["...", "GGG", "GGG"])
    expect(grassAutotile(g, 1, 1)).toEqual({ col: 1, row: 0 })
  })
})

describe("fourWayMask", () => {
  it("사방이 같으면 15", () => {
    expect(fourWayMask(grid([".G.", "GGG", ".G."]), 1, 1)).toBe(15)
  })

  it("사방이 다르면 0", () => {
    expect(fourWayMask(grid(["...", ".G.", "..."]), 1, 1)).toBe(0)
  })

  it("북쪽만 같으면 1", () => {
    expect(fourWayMask(grid([".G.", ".G.", "..."]), 1, 1)).toBe(1)
  })

  it("동쪽만 같으면 2", () => {
    expect(fourWayMask(grid(["...", ".GG", "..."]), 1, 1)).toBe(2)
  })

  it("남쪽만 같으면 4", () => {
    expect(fourWayMask(grid(["...", ".G.", ".G."]), 1, 1)).toBe(4)
  })

  it("서쪽만 같으면 8", () => {
    expect(fourWayMask(grid(["...", "GG.", "..."]), 1, 1)).toBe(8)
  })
})

describe("terrain autotile wrappers", () => {
  it("dirtAutotile 은 blob autotile 과 동일하게 동작한다", () => {
    expect(dirtAutotile(grid(["GGG", "GGG", "GGG"]), 1, 1)).toEqual({ col: 1, row: 1 })
    expect(dirtAutotile(grid(["...", "GGG", "GGG"]), 1, 1)).toEqual({ col: 1, row: 0 })
  })

  it("sandAutotile 은 blob autotile 과 동일하게 동작한다", () => {
    expect(sandAutotile(grid(["GGG", "GGG", "GGG"]), 1, 1)).toEqual({ col: 1, row: 1 })
    expect(sandAutotile(grid(["GGG", "GG.", "GGG"]), 1, 1)).toEqual({ col: 2, row: 1 })
  })

  it("pathAutotile 은 모든 4-way 이웃 조합에 정의된 좌표를 반환한다", () => {
    // mask 0, 1, 2, 4, 8, 15 를 만드는 그리드들
    const cases = [
      ["...", ".G.", "..."], // 0 — 고립
      [".G.", ".G.", "..."], // 1 — N
      ["...", ".GG", "..."], // 2 — E
      ["...", ".G.", ".G."], // 4 — S
      ["...", "GG.", "..."], // 8 — W
      [".G.", "GGG", ".G."], // 15 — 사방
    ]
    for (const rows of cases) {
      const pos = pathAutotile(grid(rows), 1, 1)
      expect(Number.isInteger(pos.col)).toBe(true)
      expect(Number.isInteger(pos.row)).toBe(true)
      expect(pos.col).toBeGreaterThanOrEqual(0)
      expect(pos.row).toBeGreaterThanOrEqual(0)
    }
  })
})
