import {
  DEFAULT_DIALOGUE_CHOICES,
  dialogueChoiceForKey,
  makeWorldDialogueGameState,
  resolveWorldNPCProfile,
} from "@/game-core/game-loop/world-dialogue"

describe("world dialogue helpers", () => {
  it("offers three numbered dialogue choices", () => {
    expect(DEFAULT_DIALOGUE_CHOICES.map((choice) => choice.id)).toEqual(["1", "2", "3"])
    expect(DEFAULT_DIALOGUE_CHOICES.every((choice) => choice.userMessage.length > 0)).toBe(true)
  })

  it("selects dialogue choices by keyboard number", () => {
    expect(dialogueChoiceForKey("1")?.id).toBe("1")
    expect(dialogueChoiceForKey("2")?.id).toBe("2")
    expect(dialogueChoiceForKey("3")?.id).toBe("3")
    expect(dialogueChoiceForKey("4")).toBeNull()
  })

  it("resolves a demo NPC profile while preserving the world npc id", () => {
    const profile = resolveWorldNPCProfile("npc_3")

    expect(profile.id).toBe("npc_3")
    expect(profile.name).toBeTruthy()
    expect(profile.personality.length).toBeGreaterThan(0)
  })

  it("builds the game state expected by the agent pipeline", () => {
    const state = makeWorldDialogueGameState([
      { id: "npc_1", npcId: "npc_1", x: 10, y: 11 },
      { id: "npc_2", npcId: "npc_2", x: 12, y: 13 },
    ])

    expect(state.clock).toEqual({ day: 1, currentMinute: 600 })
    expect(state.npcPositions).toEqual({
      npc_1: { x: 10, y: 11 },
      npc_2: { x: 12, y: 13 },
    })
  })
})
