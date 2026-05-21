import { loadMap } from "@/game-core/map/loader"
import { generateVillageTerrain } from "@/game-core/map/village-terrain"
import type { TileMap } from "@/game-core/types/map"
import mapData from "../../../public/conference_demo_map.json"

function loadDefaultMap(): TileMap {
  try {
    return loadMap(mapData)
  } catch {
    return generateVillageTerrain()
  }
}

export const DEFAULT_MAP: TileMap = loadDefaultMap()
