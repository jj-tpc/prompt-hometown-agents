import type { LayerName, TileMap, TileType } from "@/game-core/types/map"

export type MapEditorTool = "paint" | "erase" | "elevation" | "spawn" | "select" | "pan"
export type ElevationMode = "raise" | "lower" | "set"

export type MapEditorDraft = {
  map: TileMap
  selectedLayer: LayerName
  selectedTile: TileType
  selectedTool: MapEditorTool
  elevationMode: ElevationMode
  elevationValue: number
  selectedSpawnId?: string
  selectedCell?: { x: number; y: number }
}

