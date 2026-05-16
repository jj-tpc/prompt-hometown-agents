import type { TileLayer, TileMap, TileType } from "@/game-core/types/map"

const TERRAIN_ROWS = [
  "WWWWWWWWWWWWWWWW",
  "WWGGGGGGGGGGGGWW",
  "WGGGGGGGGGGGGGGW",
  "WGGGGGGGWWWGGGGW",
  "WGGGGGGGWWWGGGGW",
  "WWWGGGGGWWWGGGGW",
  "WWGGGGGGGGGGGGGW",
  "WGGGGGGGGGGGGGGW",
  "WGGGGGGGGGGGGGGW",
  "WWGGGGGGGGGGGGWW",
  "WWWGGGGGGGGGGWWW",
  "WWWWWWWWWWWWWWWW",
] as const

const WIDTH = TERRAIN_ROWS[0].length
const HEIGHT = TERRAIN_ROWS.length

function terrainCharToTile(char: string): TileType {
  switch (char) {
    case "G":
      return "grass"
    case "W":
      return "water"
    default:
      return "void"
  }
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

function makeFlatElevation(): number[][] {
  return Array.from({ length: HEIGHT }, () => Array<number>(WIDTH).fill(0))
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
      makeEmptyLayer("object"),
      makeEmptyLayer("overlay"),
    ],
    elevation: makeFlatElevation(),
    spawnPoints: [{ id: "player_start", x: 2, y: 2, facing: "down", entityType: "player" }],
    transitions: [],
  }
}
