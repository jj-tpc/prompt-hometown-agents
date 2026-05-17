// 카메라/이동 테스트용 대형 랜덤 지형 생성기.
// 결정적(seeded) — 같은 seed면 같은 맵. 절차적 생성 본편(PRD Phase 4-7)과는 별개의
// 가벼운 데모용 생성기다.

import type { TileLayer, TileMap, TileType } from "@/game-core/types/map"

// mulberry32 — 결정적 PRNG
function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function fillBlob(
  ground: TileType[][],
  cx: number,
  cy: number,
  r: number,
  tile: TileType,
  width: number,
  height: number
): void {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue
      const x = cx + dx
      const y = cy + dy
      if (x < 0 || x >= width || y < 0 || y >= height) continue
      ground[y][x] = tile
    }
  }
}

function emptyLayer(name: TileLayer["name"], width: number, height: number): TileLayer {
  return {
    name,
    tiles: Array.from({ length: height }, () => Array<TileType | null>(width).fill(null)),
  }
}

export function generateRandomTerrain(
  width = 200,
  height = 200,
  seed = 20260518
): TileMap {
  const rng = makeRng(seed)
  const randInt = (n: number) => Math.floor(rng() * n)

  // 전부 잔디로 시작
  const ground: TileType[][] = Array.from({ length: height }, () =>
    Array<TileType>(width).fill("grass")
  )

  // 물 웅덩이 랜덤 배치
  const pondCount = Math.floor((width * height) / 700)
  for (let i = 0; i < pondCount; i++) {
    fillBlob(ground, randInt(width), randInt(height), 2 + randInt(5), "water", width, height)
  }

  // 가장자리 한 줄은 바다
  for (let x = 0; x < width; x++) {
    ground[0][x] = "water"
    ground[height - 1][x] = "water"
  }
  for (let y = 0; y < height; y++) {
    ground[y][0] = "water"
    ground[y][width - 1] = "water"
  }

  // 중앙 스폰 주변은 잔디 보장
  const sx = Math.floor(width / 2)
  const sy = Math.floor(height / 2)
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = sx + dx
      const y = sy + dy
      if (x >= 0 && x < width && y >= 0 && y < height) ground[y][x] = "grass"
    }
  }

  return {
    meta: { id: "random_world", name: "Random World", biome: "village" },
    width,
    height,
    tileSize: 16,
    layers: [
      { name: "ground", tiles: ground },
      emptyLayer("decoration", width, height),
      emptyLayer("object", width, height),
      emptyLayer("overlay", width, height),
    ],
    elevation: Array.from({ length: height }, () => Array<number>(width).fill(0)),
    spawnPoints: [
      { id: "player_start", x: sx, y: sy, facing: "down", entityType: "player" },
    ],
    transitions: [],
  }
}
