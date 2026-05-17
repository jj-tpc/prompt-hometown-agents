import { sampleOpenMap, sampleWalledMap } from "@/game-core/fixtures/sample-maps"
import {
  attemptPlayerMove,
  findFacingNpc,
  memorySpeechText,
} from "@/game-core/game-loop/world-interaction"
import type { NPCMemory } from "@/game-core/types/npc"

describe("attemptPlayerMove", () => {
  it("rejects movement into a position occupied by an NPC", () => {
    const result = attemptPlayerMove({
      map: sampleOpenMap(),
      player: { x: 1, y: 1 },
      direction: "right",
      occupiedPositions: [{ x: 2, y: 1 }],
    })

    expect(result).toEqual({
      moved: false,
      position: { x: 1, y: 1 },
      facing: "right",
    })
  })

  it("allows walkable movement when the destination is unoccupied", () => {
    const result = attemptPlayerMove({
      map: sampleOpenMap(),
      player: { x: 1, y: 1 },
      direction: "right",
      occupiedPositions: [],
    })

    expect(result).toEqual({
      moved: true,
      position: { x: 2, y: 1 },
      facing: "right",
    })
  })

  it("still rejects blocked map tiles", () => {
    const result = attemptPlayerMove({
      map: sampleWalledMap(),
      player: { x: 3, y: 3 },
      direction: "right",
      occupiedPositions: [],
    })

    expect(result.moved).toBe(false)
    expect(result.position).toEqual({ x: 3, y: 3 })
  })
})

describe("findFacingNpc", () => {
  it("returns the NPC directly in the remembered facing direction", () => {
    const npc = findFacingNpc(
      { x: 5, y: 5 },
      "up",
      [
        { id: "npc_west", x: 4, y: 5 },
        { id: "npc_up", npcId: "blacksmith", x: 5, y: 4 },
      ]
    )

    expect(npc).toMatchObject({ id: "npc_up", npcId: "blacksmith" })
  })

  it("returns null when no NPC is in the facing cell", () => {
    expect(findFacingNpc({ x: 5, y: 5 }, "down", [{ id: "npc_up", x: 5, y: 4 }])).toBeNull()
  })
})

describe("memorySpeechText", () => {
  it("uses the latest cached NPC message when available", () => {
    const memory: NPCMemory = {
      npcId: "npc_1",
      relationshipScore: 1,
      conversationHistory: [
        { timestamp: 1, speaker: "npc", message: "처음 본 얼굴이네요.", type: "chat" },
        { timestamp: 2, speaker: "user", message: "안녕", type: "chat" },
        { timestamp: 3, speaker: "npc", message: "오늘은 물가가 조용해요.", type: "chat" },
      ],
    }

    expect(memorySpeechText(memory)).toBe("오늘은 물가가 조용해요.")
  })

  it("falls back when the NPC has no cached message yet", () => {
    expect(
      memorySpeechText({ npcId: "npc_1", relationshipScore: 0, conversationHistory: [] })
    ).toBe("아직 나눈 이야기는 없어요.")
  })
})
