import { entitiesFromSpawns } from "@/game-core/render/entities"
import type { TileMap } from "@/game-core/types/map"

// entitiesFromSpawns는 spawnPoints와 elevation만 사용 — 테스트 stub
const stubMap = {
  spawnPoints: [
    { id: "player_start", x: 1, y: 1, facing: "down", entityType: "player" },
    { id: "npc_a", x: 3, y: 2, facing: "down", entityType: "npc", npcId: "npc_a" },
  ],
  elevation: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
} as unknown as TileMap

describe("entitiesFromSpawns", () => {
  it("스폰 포인트마다 RenderEntity를 만든다", () => {
    expect(entitiesFromSpawns(stubMap)).toHaveLength(2)
  })

  it("player 스폰 → entity:player:front", () => {
    const player = entitiesFromSpawns(stubMap).find((e) => e.id === "player_start")
    expect(player?.spriteId).toBe("entity:player:front")
    expect(player).toMatchObject({ gridX: 1, gridY: 1, elevation: 0 })
  })

  it("npc 스폰 → entity:npc:front", () => {
    const npc = entitiesFromSpawns(stubMap).find((e) => e.id === "npc_a")
    expect(npc?.spriteId).toBe("entity:npc:front")
    expect(npc).toMatchObject({ gridX: 3, gridY: 2 })
  })
})
