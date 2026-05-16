export type Direction = "up" | "down" | "left" | "right"

export type TileType =
  | "void"
  | "grass"
  | "dirt"
  | "path"
  | "sand"
  | "water"
  | "shallow_water"
  | "mountain"
  | "tree"
  | "bush"
  | "tall_grass"
  | "wall"
  | "fence"
  | "building_floor"
  | "building_wall"
  | "roof"
  | "cliff_face"
  | "stairs"
  | "door"
  | "chest"
  | "sign"
  | "npc_spawn"
  | "player_spawn"

export type LayerName = "ground" | "decoration" | "object" | "overlay"

export type TileDefinition = {
  type: TileType
  walkable: boolean
  transparent: boolean
  spriteId: string
  autoTileGroup?: string
}

export type TileLayer = {
  name: LayerName
  tiles: (TileType | null)[][]
}

export type SpawnPoint = {
  id: string
  x: number
  y: number
  facing: Direction
  entityType: "player" | "npc"
  npcId?: string
}

export type MapTransition = {
  x: number
  y: number
  targetMapId: string
  targetX: number
  targetY: number
  facing: Direction
}

export type MapMetadata = {
  id: string
  name: string
  biome: "village" | "forest" | "beach" | "mountain" | "cave" | "indoor"
  weather?: "clear" | "rain" | "snow"
  musicId?: string
}

export type TileMap = {
  meta: MapMetadata
  width: number
  height: number
  tileSize: 16
  layers: TileLayer[]
  elevation: number[][]
  spawnPoints: SpawnPoint[]
  transitions: MapTransition[]
}

export type LinearVision = {
  type: "linear"
  range: number
  facing: Direction
}

export type ConeVision = {
  type: "cone"
  range: number
  halfAngle: number
  facing: Direction
}

export type RadiusVision = {
  type: "radius"
  range: number
}

export type VisionConfig = LinearVision | ConeVision | RadiusVision

export type NPCVisionProfile = {
  visionConfig: VisionConfig
  proximityRange?: number
  reactionType: "exclamation" | "alert" | "approach" | "ignore"
}

export type VisionEventType = "DETECTED" | "LOST_SIGHT"

export type VisionEvent = {
  type: VisionEventType
  npcId: string
  targetId: string
  targetPosition: { x: number; y: number }
  distance: number
  timestamp: number
}

export type VisionResult = {
  detectedEntities: Array<{
    entityId: string
    entityType: "player" | "npc" | "item"
    position: { x: number; y: number }
    distance: number
    hasLOS: boolean
  }>
  visibleTilePositions: Array<{ x: number; y: number }>
}
