import type { TileLayer, TileMap, TileType } from "@/game-core/types/map"

const TERRAIN_ROWS = [
  "WWWWWWWWWWWWWWWWWWWW",
  "WWGGGGGGGGGGGGGGGGWW",
  "WGGGGGGGGGGGGGGGGGGW",
  "WGGGGGGGGGGGGGGGGGGW",
  "WGGGGGGGGGGGGGGGGGGW",
  "WGGGGGGGGGGGGGGGGGGW",
  "WGGGGGGGGGGGGGGGGGGW",
  "WGGGGGGGGGGGGGGGGGGW",
  "WGGGGGGGGGGGGGGGGGGW",
  "WGGGGGGGGGGGGGGGGGGW",
  "WGGGGGGGGGGGGGGGGGGW",
  "WGGGGGGGGGGGGGGGGGGW",
  "WWGGGGGGGGGGGGGGGGWW",
  "WWWWWWWWWWWWWWWWWWWW",
] as const

const WIDTH = TERRAIN_ROWS[0].length
const HEIGHT = TERRAIN_ROWS.length

const PLATEAU = { x0: 4, x1: 12, y0: 4, y1: 7 } as const
const CLIFF_ROW = PLATEAU.y1 + 1
const STAIRS_X = 8
const STAIRS_WIDTH = 2

function terrainCharToTile(char: string): TileType {
  return char === "W" ? "water" : "grass"
}

function inPlateau(x: number, y: number): boolean {
  return x >= PLATEAU.x0 && x <= PLATEAU.x1 && y >= PLATEAU.y0 && y <= PLATEAU.y1
}

function makeGroundLayer(): TileLayer {
  return {
    name: "ground",
    tiles: TERRAIN_ROWS.map((row) => [...row].map(terrainCharToTile)),
  }
}

function makeEmptyLayer(name: TileLayer["name"]): TileLayer {
  return {
    name,
    tiles: Array.from({ length: HEIGHT }, () => Array<TileType | null>(WIDTH).fill(null)),
  }
}

function makeObjectLayer(): TileLayer {
  const tiles: (TileType | null)[][] = Array.from({ length: HEIGHT }, () =>
    Array<TileType | null>(WIDTH).fill(null)
  )

  for (let x = PLATEAU.x0; x <= PLATEAU.x1; x++) {
    const isStairColumn = x >= STAIRS_X && x < STAIRS_X + STAIRS_WIDTH
    tiles[CLIFF_ROW][x] = isStairColumn ? "stairs" : "cliff_face"
  }
  for (let x = STAIRS_X; x < STAIRS_X + STAIRS_WIDTH; x++) {
    tiles[CLIFF_ROW + 1][x] = "stairs"
  }

  return { name: "object", tiles }
}

function makeElevation(): number[][] {
  return Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => (inPlateau(x, y) ? 1 : 0))
  )
}

export function demoTerrainMap(): TileMap {
  return {
    meta: { id: "demo_terrain", name: "Terrain Preview Demo", biome: "village" },
    width: WIDTH,
    height: HEIGHT,
    tileSize: 16,
    layers: [
      makeGroundLayer(),
      makeEmptyLayer("decoration"),
      makeObjectLayer(),
      makeEmptyLayer("overlay"),
    ],
    elevation: makeElevation(),
    spawnPoints: [{ id: "player_start", x: 2, y: 2, facing: "down", entityType: "player" }],
    transitions: [],
  }
}
