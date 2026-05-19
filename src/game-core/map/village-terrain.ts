import type { Direction, TileLayer, TileMap, TileType } from "@/game-core/types/map"

function emptyLayer(name: TileLayer["name"], width: number, height: number): TileLayer {
  return {
    name,
    tiles: Array.from({ length: height }, () => Array<TileType | null>(width).fill(null)),
  }
}

export function generateVillageTerrain(): TileMap {
  const width = 60
  const height = 60

  // ground: 전부 grass로 초기화
  const ground: TileType[][] = Array.from({ length: height }, () =>
    Array<TileType>(width).fill("grass")
  )
  const elevation: number[][] = Array.from({ length: height }, () =>
    Array<number>(width).fill(0)
  )
  const objectTiles: (TileType | null)[][] = Array.from({ length: height }, () =>
    Array<TileType | null>(width).fill(null)
  )
  const decorTiles: (TileType | null)[][] = Array.from({ length: height }, () =>
    Array<TileType | null>(width).fill(null)
  )

  const fg = (tile: TileType, x1: number, y1: number, x2: number, y2: number) => {
    for (let y = y1; y <= y2; y++)
      for (let x = x1; x <= x2; x++)
        if (x >= 0 && x < width && y >= 0 && y < height) ground[y][x] = tile
  }

  const fo = (tile: TileType | null, x1: number, y1: number, x2: number, y2: number) => {
    for (let y = y1; y <= y2; y++)
      for (let x = x1; x <= x2; x++)
        if (x >= 0 && x < width && y >= 0 && y < height) objectTiles[y][x] = tile
  }

  const setObj = (tile: TileType | null, x: number, y: number) => {
    if (x >= 0 && x < width && y >= 0 && y < height) objectTiles[y][x] = tile
  }

  const setDecor = (tile: TileType | null, x: number, y: number) => {
    if (x >= 0 && x < width && y >= 0 && y < height) decorTiles[y][x] = tile
  }

  // ── 1. 물 테두리 (2타일) ────────────────────────────────────────────
  fg("water", 0, 0, width - 1, 1)
  fg("water", 0, height - 2, width - 1, height - 1)
  fg("water", 0, 0, 1, height - 1)
  fg("water", width - 2, 0, width - 1, height - 1)

  // ── 2. 주요 도로 ────────────────────────────────────────────────────
  // N-S 도로: x=27..29
  fg("path", 27, 2, 29, 57)
  // E-W 도로: y=27..29
  fg("path", 2, 27, 57, 29)

  // ── 3. 건물 마당 (dirt) — 건물보다 먼저 깔아서 지붕이 덮음 ─────────
  fg("dirt", 3, 11, 11, 13)   // 여관 앞마당
  fg("dirt", 3, 20, 9, 22)    // 작은 집 앞마당
  fg("path", 31, 12, 41, 15)  // 시청 광장 (stone plaza)
  fg("dirt", 45, 10, 53, 12)  // 대장간 마당
  fg("dirt", 3, 38, 10, 40)   // 농가 마당
  fg("dirt", 30, 41, 41, 43)  // 귀족 별장 앞마당

  // ── 4. 연못 (water) ─────────────────────────────────────────────────
  fg("water", 44, 44, 55, 55)

  // ── 5. 농장 밭 (dirt) ───────────────────────────────────────────────
  fg("dirt", 4, 42, 22, 53)

  // ── 6. 건물 지붕 (object layer: roof + building_wall) ───────────────

  // 여관 (Inn): x=4..10, y=4..9 지붕 / y=10 벽
  fo("roof", 4, 4, 10, 9)
  fo("building_wall", 4, 10, 10, 10)

  // 작은 집 (Small House): x=4..8, y=15..18 지붕 / y=19 벽
  fo("roof", 4, 15, 8, 18)
  fo("building_wall", 4, 19, 8, 19)

  // 시청 (Town Hall): x=32..40, y=3..10 지붕 / y=11 벽
  fo("roof", 32, 3, 40, 10)
  fo("building_wall", 32, 11, 40, 11)

  // 대장간 (Blacksmith): x=46..52, y=3..8 지붕 / y=9 벽
  fo("roof", 46, 3, 52, 8)
  fo("building_wall", 46, 9, 52, 9)

  // 농가 (Farmhouse): x=4..9, y=31..36 지붕 / y=37 벽
  fo("roof", 4, 31, 9, 36)
  fo("building_wall", 4, 37, 9, 37)

  // 귀족 별장 (Noble Villa): x=31..40, y=31..39 지붕 / y=40 벽
  fo("roof", 31, 31, 40, 39)
  fo("building_wall", 31, 40, 40, 40)

  // ── 7. 울타리 ────────────────────────────────────────────────────────

  // 양 우리 (Sheep Pen): x=32..39, y=44..49
  for (let x = 32; x <= 39; x++) {
    setObj("fence", x, 44)
    setObj("fence", x, 49)
  }
  for (let y = 45; y <= 48; y++) {
    setObj("fence", 32, y)
    setObj("fence", 39, y)
  }

  // 농장 울타리
  for (let x = 4; x <= 22; x++) {
    setObj("fence", x, 42)
    setObj("fence", x, 53)
  }
  for (let y = 43; y <= 52; y++) {
    setObj("fence", 4, y)
    setObj("fence", 22, y)
  }

  // ── 8. 나무 & 덤불 (decoration layer) ──────────────────────────────

  // NW 사분면
  const trees: [number, number][] = [
    [2, 2], [2, 14], [12, 2], [20, 2],
    [14, 14], [22, 14], [2, 20], [11, 23], [22, 23],
    // NE
    [55, 2], [42, 2], [44, 15], [54, 15], [56, 22], [43, 22],
    // SW
    [2, 30], [2, 54], [24, 30], [24, 54], [14, 30],
    // SE
    [30, 30], [56, 30], [43, 43], [56, 43], [43, 55], [56, 55], [30, 55],
  ]
  for (const [x, y] of trees) setDecor("tree", x, y)

  const bushes: [number, number][] = [
    [12, 12], [23, 7], [12, 24], [45, 14],
    [54, 24], [23, 22], [13, 41],
  ]
  for (const [x, y] of bushes) setDecor("bush", x, y)

  // ── 9. 스폰 포인트 ──────────────────────────────────────────────────
  const spawnPoints = [
    { id: "player_start", x: 28, y: 28, facing: "down" as Direction, entityType: "player" as const },
    { id: "npc_1",  x: 7,  y: 12, facing: "down"  as Direction, entityType: "npc" as const, npcId: "npc_1"  },
    { id: "npc_2",  x: 37, y: 16, facing: "down"  as Direction, entityType: "npc" as const, npcId: "npc_2"  },
    { id: "npc_3",  x: 13, y: 28, facing: "right" as Direction, entityType: "npc" as const, npcId: "npc_3"  },
    { id: "npc_4",  x: 48, y: 11, facing: "down"  as Direction, entityType: "npc" as const, npcId: "npc_4"  },
    { id: "npc_5",  x: 28, y: 14, facing: "down"  as Direction, entityType: "npc" as const, npcId: "npc_5"  },
    { id: "npc_6",  x: 7,  y: 21, facing: "up"    as Direction, entityType: "npc" as const, npcId: "npc_6"  },
    { id: "npc_7",  x: 36, y: 42, facing: "up"    as Direction, entityType: "npc" as const, npcId: "npc_7"  },
    { id: "npc_8",  x: 21, y: 28, facing: "right" as Direction, entityType: "npc" as const, npcId: "npc_8"  },
    { id: "npc_9",  x: 28, y: 42, facing: "down"  as Direction, entityType: "npc" as const, npcId: "npc_9"  },
    { id: "npc_10", x: 20, y: 22, facing: "down"  as Direction, entityType: "npc" as const, npcId: "npc_10" },
    { id: "npc_11", x: 13, y: 48, facing: "right" as Direction, entityType: "npc" as const, npcId: "npc_11" },
    { id: "npc_12", x: 35, y: 47, facing: "down"  as Direction, entityType: "npc" as const, npcId: "npc_12" },
    { id: "npc_13", x: 50, y: 11, facing: "left"  as Direction, entityType: "npc" as const, npcId: "npc_13" },
  ]

  // 스폰 위치가 도로 타일을 덮지 않도록 보정
  for (const sp of spawnPoints) {
    if (ground[sp.y]?.[sp.x] === "water") continue
    if (ground[sp.y][sp.x] !== "path") {
      ground[sp.y][sp.x] = "grass"
    }
    elevation[sp.y][sp.x] = 0
  }

  return {
    meta: { id: "village_world", name: "마을", biome: "village" },
    width,
    height,
    tileSize: 16,
    layers: [
      { name: "ground", tiles: ground },
      { name: "decoration", tiles: decorTiles },
      { name: "object", tiles: objectTiles },
      emptyLayer("overlay", width, height),
    ],
    elevation,
    spawnPoints,
    transitions: [],
  }
}
