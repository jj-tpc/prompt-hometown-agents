import {
  DEFAULT_DIALOGUE_CHOICES,
  dialogueChoiceForKey,
  makeWorldDialogueGameState,
  normalizeCustomDialogueMessage,
  resolveWorldNPCProfile,
  WORLD_NPC_CHARACTER_PROMPTS,
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

  it("normalizes custom dialogue input", () => {
    expect(normalizeCustomDialogueMessage("  오늘 뭐 하고 있었어?  ")).toBe(
      "오늘 뭐 하고 있었어?"
    )
    expect(normalizeCustomDialogueMessage("   ")).toBeNull()
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

describe("new named world NPCs", () => {
  it("WORLD_NPC_CHARACTER_PROMPTS lists 9 named NPCs with characterPromptKey", () => {
    expect(WORLD_NPC_CHARACTER_PROMPTS).toHaveLength(9)
    const keys = WORLD_NPC_CHARACTER_PROMPTS.map((n) => n.characterPromptKey)
    expect(keys).toContain("npc_guard")
    expect(keys).toContain("npc_innkeeper")
    expect(keys).toContain("npc_sheep")
  })

  it("resolves npc_5 to guard blueprint with characterPromptKey", () => {
    const profile = resolveWorldNPCProfile("npc_5")
    expect(profile.characterPromptKey).toBe("npc_guard")
    expect(profile.name).toBe("경비대원 카엔")
  })

  it("resolves npc_13 to blacksmith2 blueprint", () => {
    const profile = resolveWorldNPCProfile("npc_13")
    expect(profile.characterPromptKey).toBe("npc_blacksmith2")
  })
})
