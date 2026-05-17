import { characterSpriteId, SPRITE_ATLAS } from "@/game-core/render/terrain-tiles"
import type { RenderEntity } from "@/game-core/render/types"
import type { TileMap } from "@/game-core/types/map"

export function entitiesFromSpawns(map: TileMap): RenderEntity[] {
  return map.spawnPoints.map((spawn) => {
    const spriteId = characterSpriteId(spawn.entityType, spawn.facing, 0)
    const sprite = SPRITE_ATLAS[spriteId]
    return {
      id: spawn.id,
      spriteId,
      gridX: spawn.x,
      gridY: spawn.y,
      elevation: map.elevation[spawn.y]?.[spawn.x] ?? 0,
      spriteHeightPx: sprite.sh,
    }
  })
}
