import {
  nextNpcFollowStep,
  nextNpcPathStep,
  nextNpcWanderStep,
  planNpcPathToPosition,
  planNpcDestination,
} from "@/game-core/game-loop/npc-behavior"
import { sampleOpenMap, sampleWalledMap } from "@/game-core/fixtures/sample-maps"

describe("planNpcDestination", () => {
  it("finds a reachable destination tile and returns a path", () => {
    const map = sampleOpenMap()
    map.layers[0].tiles[2][5] = "sand"

    const plan = planNpcDestination({
      map,
      npcId: "npc_1",
      start: { x: 1, y: 2 },
      occupiedPositions: [],
      destinationKind: "sand",
    })

    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.destination).toEqual({ x: 5, y: 2 })
    expect(plan.path).toHaveLength(4)
  })

  it("rejects unreachable destinations", () => {
    const map = sampleWalledMap()
    for (let y = 0; y < map.height; y += 1) {
      map.layers[2].tiles[y][4] = "wall"
    }
    map.layers[0].tiles[3][6] = "sand"

    const plan = planNpcDestination({
      map,
      npcId: "npc_1",
      start: { x: 1, y: 3 },
      occupiedPositions: [],
      destinationKind: "sand",
    })

    expect(plan.ok).toBe(false)
    expect(plan.responseText).toContain("경로를 찾지 못했어")
  })

  it("treats walkable cells beside water as waterfront", () => {
    const map = sampleOpenMap()
    map.layers[0].tiles[2][4] = "water"

    const plan = planNpcDestination({
      map,
      npcId: "npc_1",
      start: { x: 1, y: 2 },
      occupiedPositions: [],
      destinationKind: "waterfront",
    })

    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.destination).toEqual({ x: 3, y: 2 })
  })
})

describe("NPC movement steps", () => {
  it("plans a path back to a specific home position", () => {
    const map = sampleOpenMap()

    const path = planNpcPathToPosition({
      map,
      start: { x: 1, y: 1 },
      destination: { x: 4, y: 1 },
      occupiedPositions: [],
    })

    expect(path).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ])
  })

  it("moves a following NPC toward a walkable cell beside the player", () => {
    const map = sampleOpenMap()

    const step = nextNpcFollowStep({
      map,
      position: { x: 1, y: 1 },
      player: { x: 4, y: 1 },
      occupiedPositions: [],
    })

    expect(step).toMatchObject({
      moved: true,
      position: { x: 2, y: 1 },
      facing: "right",
    })
  })

  it("does not move a following NPC that is already beside the player", () => {
    const map = sampleOpenMap()

    expect(
      nextNpcFollowStep({
        map,
        position: { x: 3, y: 1 },
        player: { x: 4, y: 1 },
        occupiedPositions: [],
      })
    ).toEqual({ moved: false })
  })

  it("moves along a planned path one cell at a time", () => {
    const step = nextNpcPathStep({
      position: { x: 1, y: 1 },
      path: [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ],
    })

    expect(step).toMatchObject({
      moved: true,
      position: { x: 2, y: 1 },
      facing: "right",
      path: [{ x: 3, y: 1 }],
    })
  })

  it("keeps wandering within the anchor radius", () => {
    const map = sampleOpenMap()
    const step = nextNpcWanderStep({
      map,
      position: { x: 3, y: 3 },
      anchor: { x: 3, y: 3 },
      radius: 1,
      occupiedPositions: [],
      tick: 1,
    })

    expect(step.moved).toBe(true)
    if (!step.moved) return
    expect(Math.abs(step.position.x - 3) + Math.abs(step.position.y - 3)).toBeLessThanOrEqual(1)
  })
})
