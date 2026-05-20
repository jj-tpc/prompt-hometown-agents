import type { LayerName, TileLayer, TileMap, TileType } from "@/game-core/types/map"

const LAYER_NAMES: LayerName[] = ["ground", "decoration", "object", "overlay"]

function createLayer(
  name: LayerName,
  width: number,
  height: number,
  fill: TileType | null
): TileLayer {
  return {
    name,
    tiles: Array.from({ length: height }, () => Array<TileType | null>(width).fill(fill)),
  }
}

export function createBlankTileMap(options: {
  id: string
  name: string
  width: number
  height: number
  biome?: TileMap["meta"]["biome"]
  fill?: TileType
}): TileMap {
  const fill = options.fill ?? "grass"
  const centerX = Math.floor(options.width / 2)
  const centerY = Math.floor(options.height / 2)

  return {
    meta: {
      id: options.id,
      name: options.name,
      biome: options.biome ?? "village",
    },
    width: options.width,
    height: options.height,
    tileSize: 16,
    layers: LAYER_NAMES.map((name) =>
      createLayer(name, options.width, options.height, name === "ground" ? fill : null)
    ),
    elevation: Array.from({ length: options.height }, () => Array<number>(options.width).fill(0)),
    spawnPoints: [
      {
        id: "player_start",
        x: centerX,
        y: centerY,
        facing: "down",
        entityType: "player",
      },
    ],
    transitions: [],
  }
}

export function createWaterBaseGrassTileMap(options: {
  id: string
  name: string
  size: number
  biome?: TileMap["meta"]["biome"]
  waterBorder?: number
}): TileMap {
  const waterBorder = Math.max(1, Math.floor(options.waterBorder ?? 2))
  const map = createBlankTileMap({
    id: options.id,
    name: options.name,
    width: options.size,
    height: options.size,
    biome: options.biome ?? "village",
    fill: "water",
  })
  const grassStart = Math.min(waterBorder, Math.floor((options.size - 1) / 2))
  const grassEnd = Math.max(grassStart, options.size - waterBorder - 1)

  return {
    ...map,
    layers: map.layers.map((layer) => {
      if (layer.name !== "ground") return layer
      return {
        ...layer,
        tiles: layer.tiles.map((row, y) =>
          row.map((tile, x) =>
            x >= grassStart && x <= grassEnd && y >= grassStart && y <= grassEnd
              ? "grass"
              : tile
          )
        ),
      }
    }),
  }
}
