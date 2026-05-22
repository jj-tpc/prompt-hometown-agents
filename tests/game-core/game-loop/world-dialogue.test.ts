import {
  DEFAULT_DIALOGUE_CHOICES,
  dialogueChoiceForKey,
  makeWorldDialogueGameState,
  normalizeCustomDialogueMessage,
  resolveWorldNPCProfile,
  worldNpcDisplayInfo,
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

  it("builds dialogue display info with NPC name and occupation", () => {
    expect(worldNpcDisplayInfo("npc_8")).toEqual({
      npcId: "npc_8",
      name: "행상인 탄",
      occupation: "행상인",
    })
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
    expect(profile.prohibitBehavior).toBe(
      "보초를 서야하므로 움직여서는 안된다. 자리를 비우거나 어딘가로 함부로 이동하지 않는다."
    )
  })

  it("resolves npc_7 to Cyril with required class-based prohibition", () => {
    const profile = resolveWorldNPCProfile("npc_7")
    expect(profile.name).toBe("귀족 시릴")
    expect(profile.prohibitBehavior).toBe(
      "계급이 천한 다른 이의 이동 명령을 듣지 않는다. 다른 이에게 높임말을 쓰지 않는다."
    )
  })

  it("renames npc_11 to farmer Luca with dialect habit and water prohibition", () => {
    const profile = resolveWorldNPCProfile("npc_11")
    expect(profile.name).toBe("농부 루카")
    expect(profile.occupation).toBe("농부")
    expect(profile.habitBehavior).toBe("사투리를 써야함. 경상도 방언을 쓰도록.")
    expect(profile.prohibitBehavior).toBe(
      "물가를 가는 걸 싫어한다. 물, 또는 그 근처로 이동하는 걸 무서워한다."
    )
  })

  it("resolves npc_13 to blacksmith2 blueprint", () => {
    const profile = resolveWorldNPCProfile("npc_13")
    expect(profile.characterPromptKey).toBe("npc_blacksmith2")
  })
})
