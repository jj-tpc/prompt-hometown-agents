import { generateVillageTerrain } from "@/game-core/map/village-terrain"

describe("generateVillageTerrain", () => {
  const map = generateVillageTerrain()
  const ground = map.layers.find((l) => l.name === "ground")!
  const object = map.layers.find((l) => l.name === "object")!
  const decor = map.layers.find((l) => l.name === "decoration")!

  it("맵 크기가 60×60", () => {
    expect(map.width).toBe(60)
    expect(map.height).toBe(60)
  })

  it("물 테두리: 상단 2행은 water", () => {
    expect(ground.tiles[0][30]).toBe("water")
    expect(ground.tiles[1][30]).toBe("water")
    expect(ground.tiles[2][30]).not.toBe("water")
  })

  it("물 테두리: 좌측 2열은 water", () => {
    expect(ground.tiles[30][0]).toBe("water")
    expect(ground.tiles[30][1]).toBe("water")
    expect(ground.tiles[30][2]).not.toBe("water")
  })

  it("N-S 도로: x=28, y=14은 path", () => {
    expect(ground.tiles[14][28]).toBe("path")
  })

  it("E-W 도로: x=21, y=28은 path", () => {
    expect(ground.tiles[28][21]).toBe("path")
  })

  it("여관 지붕 타일이 object layer에 존재 (x=7, y=6)", () => {
    expect(object.tiles[6][7]).toBe("roof")
  })

  it("여관 벽 타일이 object layer 남쪽 행에 존재 (x=7, y=10)", () => {
    expect(object.tiles[10][7]).toBe("building_wall")
  })

  it("시청 지붕 타일이 object layer에 존재 (x=36, y=6)", () => {
    expect(object.tiles[6][36]).toBe("roof")
  })

  it("귀족 별장 지붕 타일이 object layer에 존재 (x=35, y=35)", () => {
    expect(object.tiles[35][35]).toBe("roof")
  })

  it("decoration layer에 tree 타일 존재", () => {
    const hasTree = decor.tiles.some((row) => row.includes("tree"))
    expect(hasTree).toBe(true)
  })

  it("decoration layer에 bush 타일 존재", () => {
    const hasBush = decor.tiles.some((row) => row.includes("bush"))
    expect(hasBush).toBe(true)
  })

  it("object layer에 fence 타일 존재 (양 우리 상단: x=34, y=44)", () => {
    expect(object.tiles[44][34]).toBe("fence")
  })

  it("object layer에 fence 타일 존재 (농장 울타리 상단: x=10, y=42)", () => {
    expect(object.tiles[42][10]).toBe("fence")
  })

  it("스폰 포인트 14개 (플레이어 1 + NPC 13)", () => {
    expect(map.spawnPoints).toHaveLength(14)
  })

  it("플레이어 스폰 위치 (28, 28) — 교차로", () => {
    const player = map.spawnPoints.find((s) => s.entityType === "player")!
    expect(player.x).toBe(28)
    expect(player.y).toBe(28)
  })

  it("npc_5 스폰 위치 (28, 14) — 경비 카엔 (N-S 도로)", () => {
    const npc5 = map.spawnPoints.find((s) => s.id === "npc_5")!
    expect(npc5.x).toBe(28)
    expect(npc5.y).toBe(14)
  })

  it("npc_12 스폰 위치 (35, 47) — 양 모모 (양 우리)", () => {
    const npc12 = map.spawnPoints.find((s) => s.id === "npc_12")!
    expect(npc12.x).toBe(35)
    expect(npc12.y).toBe(47)
  })

  it("모든 NPC 스폰은 elevation=0", () => {
    const npcSpawns = map.spawnPoints.filter((s) => s.entityType === "npc")
    for (const sp of npcSpawns) {
      expect(map.elevation[sp.y][sp.x]).toBe(0)
    }
  })

  it("스폰 위치가 도로 타일을 덮어쓰지 않음 (npc_5: x=28, y=14 — N-S road)", () => {
    expect(ground.tiles[14][28]).toBe("path")
  })

  it("연못 타일 존재 (x=50, y=50)", () => {
    expect(ground.tiles[50][50]).toBe("water")
  })
})
