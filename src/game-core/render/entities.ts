// 스폰 포인트 → 렌더 엔티티 변환.

import { SPRITE_ATLAS } from "@/game-core/render/terrain-tiles"
import type { RenderEntity } from "@/game-core/render/types"
import type { TileMap } from "@/game-core/types/map"

// 맵의 spawnPoints를 RenderEntity 목록으로 변환한다.
// player → entity:player:front, npc → entity:npc:front.
export function entitiesFromSpawns(map: TileMap): RenderEntity[] {
  return map.spawnPoints.map((spawn) => {
    const spriteId =
      spawn.entityType === "player" ? "entity:player:front" : "entity:npc:front"
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
