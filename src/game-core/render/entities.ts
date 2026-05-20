import { resolveWorldNPCProfile } from "@/game-core/game-loop/world-dialogue"
import {
  atlasIdForCharacterSprite,
  characterSpriteId,
  npcCharacterSpriteId,
  SPRITE_ATLAS,
} from "@/game-core/render/terrain-tiles"
import type { RenderEntity } from "@/game-core/render/types"
import type { SpawnPoint } from "@/game-core/types/map"
import type { TileMap } from "@/game-core/types/map"

function spriteIdForSpawn(spawn: SpawnPoint): string {
  if (spawn.entityType === "player") return characterSpriteId("player", spawn.facing, 0)

  const profile = resolveWorldNPCProfile(spawn.npcId ?? spawn.id)
  const atlasId = profile.spriteId ? atlasIdForCharacterSprite(profile.spriteId) : null
  if (!atlasId) return characterSpriteId("npc", spawn.facing, 0)

  const spriteId = npcCharacterSpriteId(atlasId, spawn.facing, 0)
  return SPRITE_ATLAS[spriteId] ? spriteId : characterSpriteId("npc", spawn.facing, 0)
}

export function entitiesFromSpawns(map: TileMap): RenderEntity[] {
  return map.spawnPoints.map((spawn) => {
    const spriteId = spriteIdForSpawn(spawn)
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
