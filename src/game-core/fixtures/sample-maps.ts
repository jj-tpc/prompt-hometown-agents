import type { TileLayer, TileMap, TileType } from "@/game-core/types/map"

function makeGroundLayer(width: number, height: number, fill: TileType = "grass"): TileLayer {
  return {
    name: "ground",
    tiles: Array.from({ length: height }, () => Array<TileType>(width).fill(fill)),
  }
}

function makeEmptyLayer(width: number, height: number, name: TileLayer["name"]): TileLayer {
  return {
    name,
    tiles: Array.from({ length: height }, () => Array<TileType | null>(width).fill(null)),
  }
}

function makeFlatElevation(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => Array<number>(width).fill(0))
}

export function sampleOpenMap(): TileMap {
  return {
    meta: { id: "open_test", name: "Open Test Map", biome: "village" },
    width: 8,
    height: 8,
    tileSize: 16,
    layers: [
      makeGroundLayer(8, 8),
      makeEmptyLayer(8, 8, "decoration"),
      makeEmptyLayer(8, 8, "object"),
      makeEmptyLayer(8, 8, "overlay"),
    ],
    elevation: makeFlatElevation(8, 8),
    spawnPoints: [
      { id: "player_start", x: 1, y: 3, facing: "right", entityType: "player" },
      { id: "npc_spawn", x: 6, y: 3, facing: "left", entityType: "npc", npcId: "npc_rabbit" },
    ],
    transitions: [],
  }
}

export function sampleWalledMap(): TileMap {
  const objectTiles: (TileType | null)[][] = Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => (x === 4 && y >= 1 && y <= 6 ? "wall" : null))
  )

  return {
    meta: { id: "walled_test", name: "Walled Test Map", biome: "village" },
    width: 8,
    height: 8,
    tileSize: 16,
    layers: [
      makeGroundLayer(8, 8),
      makeEmptyLayer(8, 8, "decoration"),
      { name: "object", tiles: objectTiles },
      makeEmptyLayer(8, 8, "overlay"),
    ],
    elevation: makeFlatElevation(8, 8),
    spawnPoints: [
      { id: "player_start", x: 1, y: 3, facing: "right", entityType: "player" },
      { id: "npc_spawn", x: 6, y: 3, facing: "left", entityType: "npc", npcId: "npc_rabbit" },
    ],
    transitions: [],
  }
}

export function sampleElevatedMap(): TileMap {
  const elevation: number[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (_, x) => (x <= 3 ? 0 : 1))
  )
  const objectTiles: (TileType | null)[][] = Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => {
      if (x !== 4) return null
      return y === 4 ? "stairs" : "cliff_face"
    })
  )

  return {
    meta: { id: "elevated_test", name: "Elevated Test Map", biome: "mountain" },
    width: 8,
    height: 8,
    tileSize: 16,
    layers: [
      makeGroundLayer(8, 8),
      makeEmptyLayer(8, 8, "decoration"),
      { name: "object", tiles: objectTiles },
      makeEmptyLayer(8, 8, "overlay"),
    ],
    elevation,
    spawnPoints: [{ id: "player_start", x: 1, y: 1, facing: "right", entityType: "player" }],
    transitions: [],
  }
}
