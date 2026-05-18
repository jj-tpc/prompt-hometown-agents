import { generateVillageTerrain } from "@/game-core/map/village-terrain"

describe("generateVillageTerrain", () => {
  const map = generateVillageTerrain()

  it("맵 크기가 100×100", () => {
    expect(map.width).toBe(100)
    expect(map.height).toBe(100)
  })

  it("물 테두리: 상단 2행은 water", () => {
    expect(map.layers[0].tiles[0][50]).toBe("water")
    expect(map.layers[0].tiles[1][50]).toBe("water")
    expect(map.layers[0].tiles[2][50]).not.toBe("water")
  })

  it("물 테두리: 좌측 2열은 water", () => {
    expect(map.layers[0].tiles[50][0]).toBe("water")
    expect(map.layers[0].tiles[50][1]).toBe("water")
    expect(map.layers[0].tiles[50][2]).not.toBe("water")
  })

  it("N-S 도로: x=49, y=50은 path", () => {
    expect(map.layers[0].tiles[50][49]).toBe("path")
  })

  it("E-W 도로: x=50, y=49은 path", () => {
    expect(map.layers[0].tiles[49][50]).toBe("path")
  })

  it("여관 위치 elevation=1 (x=42, y=37)", () => {
    expect(map.elevation[37][42]).toBe(1)
  })

  it("도로 위치 elevation=0 (교차점)", () => {
    expect(map.elevation[49][49]).toBe(0)
  })

  it("object layer에 fence 타일 존재 (양 우리 상단: y=34, x=34)", () => {
    const objectLayer = map.layers.find((l) => l.name === "object")!
    expect(objectLayer.tiles[34][34]).toBe("fence")
  })

  it("스폰 포인트 14개 (플레이어 1 + NPC 13)", () => {
    expect(map.spawnPoints).toHaveLength(14)
  })

  it("플레이어 스폰 위치 (50, 52)", () => {
    const player = map.spawnPoints.find((s) => s.entityType === "player")!
    expect(player.x).toBe(50)
    expect(player.y).toBe(52)
  })

  it("npc_5 스폰 위치 (42, 49) 경비 카엔", () => {
    const npc5 = map.spawnPoints.find((s) => s.id === "npc_5")!
    expect(npc5.x).toBe(42)
    expect(npc5.y).toBe(49)
  })

  it("npc_12 스폰 위치 (34, 38) 양 모모", () => {
    const npc12 = map.spawnPoints.find((s) => s.id === "npc_12")!
    expect(npc12.x).toBe(34)
    expect(npc12.y).toBe(38)
  })

  it("모든 NPC 스폰은 elevation=0", () => {
    const npcSpawns = map.spawnPoints.filter((s) => s.entityType === "npc")
    for (const sp of npcSpawns) {
      expect(map.elevation[sp.y][sp.x]).toBe(0)
    }
  })

  it("스폰 위치가 도로 타일을 덮어쓰지 않음 (npc_10: x=50, y=45)", () => {
    // npc_10 is on the N-S road (x=48..50), road tiles must remain "path"
    expect(map.layers[0].tiles[45][50]).toBe("path")
  })
})
