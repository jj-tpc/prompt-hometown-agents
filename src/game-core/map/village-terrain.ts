import type { Direction, TileLayer, TileMap, TileType } from "@/game-core/types/map"

function emptyLayer(name: TileLayer["name"], width: number, height: number): TileLayer {
  return {
    name,
    tiles: Array.from({ length: height }, () => Array<TileType | null>(width).fill(null)),
  }
}

export function generateVillageTerrain(): TileMap {
  const width = 100
  const height = 100

  const ground: TileType[][] = Array.from({ length: height }, () =>
    Array<TileType>(width).fill("grass")
  )
  const elevation: number[][] = Array.from({ length: height }, () => Array<number>(width).fill(0))
  const objectTiles: (TileType | null)[][] = Array.from({ length: height }, () =>
    Array<TileType | null>(width).fill(null)
  )

  const fillGround = (tile: TileType, x1: number, y1: number, x2: number, y2: number) => {
    for (let y = y1; y <= y2; y++)
      for (let x = x1; x <= x2; x++)
        if (x >= 0 && x < width && y >= 0 && y < height) ground[y][x] = tile
  }

  const fillElev = (val: number, x1: number, y1: number, x2: number, y2: number) => {
    for (let y = y1; y <= y2; y++)
      for (let x = x1; x <= x2; x++)
        if (x >= 0 && x < width && y >= 0 && y < height) elevation[y][x] = val
  }

  const setObj = (tile: TileType | null, x: number, y: number) => {
    if (x >= 0 && x < width && y >= 0 && y < height) objectTiles[y][x] = tile
  }

  // 1. Water border (2 tiles)
  fillGround("water", 0, 0, width - 1, 1)
  fillGround("water", 0, height - 2, width - 1, height - 1)
  fillGround("water", 0, 0, 1, height - 1)
  fillGround("water", width - 2, 0, width - 1, height - 1)

  // 2. Dirt yards (applied before buildings so buildings overwrite with grass)
  fillGround("dirt", 36, 31, 48, 43) // Inn yard
  fillGround("dirt", 57, 30, 67, 42) // Blacksmith yard
  fillGround("dirt", 37, 51, 49, 62) // Market yard

  // 3. Building platforms (grass + elevation=1 → hills autotile)
  fillGround("grass", 38, 33, 46, 41); fillElev(1, 38, 33, 46, 41) // Inn
  fillGround("grass", 52, 38, 59, 45); fillElev(1, 52, 38, 59, 45) // Town Hall
  fillGround("grass", 59, 32, 65, 40); fillElev(1, 59, 32, 65, 40) // Blacksmith
  fillGround("grass", 39, 53, 47, 60); fillElev(1, 39, 53, 47, 60) // Market
  fillGround("grass", 61, 62, 72, 73); fillElev(1, 61, 62, 72, 73) // Noble Villa
  fillGround("grass", 66, 47, 73, 53); fillElev(1, 66, 47, 73, 53) // Farmhouse

  // 4. Roads (path, elevation=0 — overwrites everything including buildings)
  fillGround("path", 48, 2, 50, 97); fillElev(0, 48, 2, 50, 97) // N-S
  fillGround("path", 2, 48, 97, 50); fillElev(0, 2, 48, 97, 50) // E-W

  // 5. Sheep pen fences (object layer, boundary: x=31..37, y=34..41)
  for (let x = 31; x <= 37; x++) {
    setObj("fence", x, 34)
    setObj("fence", x, 41)
  }
  for (let y = 35; y <= 40; y++) {
    setObj("fence", 31, y)
    setObj("fence", 37, y)
  }

  // 6. Spawn points
  const spawnPoints = [
    { id: "player_start", x: 50, y: 52, facing: "down" as Direction, entityType: "player" as const },
    { id: "npc_1",  x: 46, y: 47, facing: "right" as Direction, entityType: "npc" as const, npcId: "npc_1"  },
    { id: "npc_2",  x: 54, y: 51, facing: "left"  as Direction, entityType: "npc" as const, npcId: "npc_2"  },
    { id: "npc_3",  x: 48, y: 56, facing: "up"    as Direction, entityType: "npc" as const, npcId: "npc_3"  },
    { id: "npc_4",  x: 56, y: 46, facing: "down"  as Direction, entityType: "npc" as const, npcId: "npc_4"  },
    { id: "npc_5",  x: 42, y: 49, facing: "right" as Direction, entityType: "npc" as const, npcId: "npc_5"  },
    { id: "npc_6",  x: 47, y: 43, facing: "down"  as Direction, entityType: "npc" as const, npcId: "npc_6"  },
    { id: "npc_7",  x: 60, y: 66, facing: "right" as Direction, entityType: "npc" as const, npcId: "npc_7"  },
    { id: "npc_8",  x: 48, y: 55, facing: "up"    as Direction, entityType: "npc" as const, npcId: "npc_8"  },
    { id: "npc_9",  x: 53, y: 58, facing: "up"    as Direction, entityType: "npc" as const, npcId: "npc_9"  },
    { id: "npc_10", x: 50, y: 45, facing: "down"  as Direction, entityType: "npc" as const, npcId: "npc_10" },
    { id: "npc_11", x: 65, y: 50, facing: "left"  as Direction, entityType: "npc" as const, npcId: "npc_11" },
    { id: "npc_12", x: 34, y: 38, facing: "down"  as Direction, entityType: "npc" as const, npcId: "npc_12" },
    { id: "npc_13", x: 58, y: 37, facing: "right" as Direction, entityType: "npc" as const, npcId: "npc_13" },
  ]

  // Guarantee spawn tiles are grass + elevation=0 (skip water border tiles)
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
      emptyLayer("decoration", width, height),
      { name: "object", tiles: objectTiles },
      emptyLayer("overlay", width, height),
    ],
    elevation,
    spawnPoints,
    transitions: [],
  }
}
