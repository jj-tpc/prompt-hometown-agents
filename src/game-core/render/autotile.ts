// 잔디 autotile — grass.png 기반.
//
// grass.png 픽셀 분석으로 두 세트를 확인:
//  (A) cols 0-2 / rows 0-2 = 3×3 simple — 가장자리 + 외곽(볼록) 코너
//  (B) cols 5-10 / rows 0-4 = inner-corner 세트 — 내부 칸의 오목 코너 처리.
//      각 타일은 "어느 대각 코너가 잔디가 아닌가"(=오목하게 패임)를 인코딩한다.
//
// 알고리즘:
//  1. 직교 4이웃(N/E/S/W) 중 하나라도 비잔디면 → (A) 3×3 simple
//  2. 직교 4이웃 모두 잔디(=내부 칸)면 → 대각 4이웃을 보고 (B) inner-corner 선택

export type AutotilePos = { col: number; row: number }

// 대각 코너 오픈 비트: NW=1, NE=2, SW=4, SE=8.
// 값 = 비잔디인 대각 코너들의 비트합. grass.png 좌표는 모서리 픽셀 분석으로 검증함.
const INNER_CORNER_TILES: Record<number, AutotilePos> = {
  0: { col: 1, row: 1 }, // 대각 모두 잔디 = 완전 내부
  1: { col: 6, row: 2 }, // NW
  2: { col: 5, row: 2 }, // NE
  4: { col: 6, row: 1 }, // SW
  8: { col: 5, row: 1 }, // SE
  3: { col: 8, row: 2 }, // NW+NE
  12: { col: 8, row: 1 }, // SW+SE
  6: { col: 9, row: 1 }, // NE+SW
  9: { col: 9, row: 0 }, // NW+SE
  10: { col: 5, row: 4 }, // NE+SE
  5: { col: 6, row: 4 }, // NW+SW
  7: { col: 9, row: 2 }, // NW+NE+SW
  11: { col: 10, row: 2 }, // NW+NE+SE
  13: { col: 9, row: 3 }, // NW+SW+SE
  14: { col: 10, row: 3 }, // NE+SW+SE
  15: { col: 8, row: 4 }, // 네 코너 모두
}

// isGrass(x, y): 해당 칸이 잔디면 true. 맵 밖 좌표 처리는 호출자가 정의한다.
export function grassAutotile(
  isGrass: (x: number, y: number) => boolean,
  x: number,
  y: number
): AutotilePos {
  const openN = !isGrass(x, y - 1)
  const openS = !isGrass(x, y + 1)
  const openW = !isGrass(x - 1, y)
  const openE = !isGrass(x + 1, y)

  // 직교 이웃이 하나라도 비면 → 3×3 simple (가장자리 / 외곽 코너)
  if (openN || openS || openE || openW) {
    return {
      col: openW ? 0 : openE ? 2 : 1,
      row: openN ? 0 : openS ? 2 : 1,
    }
  }

  // 내부 칸 → 대각 이웃을 보고 오목 코너 선택
  const key =
    (isGrass(x - 1, y - 1) ? 0 : 1) | // NW
    (isGrass(x + 1, y - 1) ? 0 : 2) | // NE
    (isGrass(x - 1, y + 1) ? 0 : 4) | // SW
    (isGrass(x + 1, y + 1) ? 0 : 8) // SE
  return INNER_CORNER_TILES[key]
}
