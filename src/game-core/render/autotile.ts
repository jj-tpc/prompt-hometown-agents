// 지형 autotile — Sprout Lands 타일셋 기반.
//
// 두 가지 autotile 스킴:
//  (1) blob autotile — grass.png 레이아웃(176×112). 3×3 simple(가장자리 + 외곽 코너)
//      + inner-corner 세트(내부 칸의 오목 코너). grass / dirt / sand 가 공유한다
//      — tilled-dirt-v2.png · tilled-dirt-alt.png 도 176×112 동일 레이아웃이므로.
//  (2) 4-way mask autotile — paths.png(64×64) 용. 직교 4이웃 비트마스크.

export type AutotilePos = { col: number; row: number }

// ─── (1) blob autotile (grass / dirt / sand) ───

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

// blob autotile. isGrass(x,y): 같은 지형이면 true. 맵 밖 좌표 처리는 호출자가 정의한다.
//  1. 직교 4이웃(N/E/S/W) 중 하나라도 다르면 → 3×3 simple (가장자리 / 외곽 코너)
//  2. 직교 4이웃 모두 같으면(=내부 칸) → 대각 4이웃을 보고 inner-corner 선택
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

// dirt / sand 타일셋(tilled-dirt-v2 · tilled-dirt-alt)은 grass.png와 동일한
// 176×112 레이아웃이라 같은 blob autotile 로직을 그대로 쓴다.
export function dirtAutotile(
  isDirt: (x: number, y: number) => boolean,
  x: number,
  y: number
): AutotilePos {
  return grassAutotile(isDirt, x, y)
}

export function sandAutotile(
  isSand: (x: number, y: number) => boolean,
  x: number,
  y: number
): AutotilePos {
  return grassAutotile(isSand, x, y)
}

// ─── (2) 4-way mask autotile (path) ───

// 직교 4이웃 비트마스크. 같은 지형이면 비트 set. N=1, E=2, S=4, W=8.
export type FourWayMask =
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
  | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15

export function fourWayMask(
  isSame: (x: number, y: number) => boolean,
  x: number,
  y: number
): FourWayMask {
  let m = 0
  if (isSame(x, y - 1)) m |= 1 // N
  if (isSame(x + 1, y)) m |= 2 // E
  if (isSame(x, y + 1)) m |= 4 // S
  if (isSame(x - 1, y)) m |= 8 // W
  return m as FourWayMask
}

// paths.png(64×64, 4×4)는 징검돌 스타일이라 완전한 16타일 blob이 아니다.
// 세로 strip(col 0: 위끝/몸통/아래끝)과 가로 strip(row 3: 왼끝/몸통/오른끝)만
// 제대로 있고 L자 코너·교차 타일은 없다 → 코너·교차는 몸통 타일로 근사한다.
const PATH_TILES: Record<FourWayMask, AutotilePos> = {
  0: { col: 0, row: 1 }, // 고립
  1: { col: 0, row: 2 }, // N — 세로 아래 끝
  2: { col: 1, row: 3 }, // E — 가로 왼쪽 끝
  3: { col: 2, row: 3 }, // N+E (L) — 근사
  4: { col: 0, row: 0 }, // S — 세로 위 끝
  5: { col: 0, row: 1 }, // N+S — 세로 몸통
  6: { col: 2, row: 3 }, // E+S (L) — 근사
  7: { col: 0, row: 1 }, // N+E+S (T) — 근사
  8: { col: 3, row: 3 }, // W — 가로 오른쪽 끝
  9: { col: 2, row: 3 }, // N+W (L) — 근사
  10: { col: 2, row: 3 }, // E+W — 가로 몸통
  11: { col: 2, row: 3 }, // N+E+W (T) — 근사
  12: { col: 2, row: 3 }, // S+W (L) — 근사
  13: { col: 0, row: 1 }, // N+S+W (T) — 근사
  14: { col: 2, row: 3 }, // E+S+W (T) — 근사
  15: { col: 2, row: 3 }, // 교차 — 근사
}

export function pathAutotile(
  isPath: (x: number, y: number) => boolean,
  x: number,
  y: number
): AutotilePos {
  return PATH_TILES[fourWayMask(isPath, x, y)]
}
