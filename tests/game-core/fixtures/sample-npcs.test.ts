import { BLACKSMITH, RABBIT } from "@/game-core/fixtures/sample-npcs"

describe("sample NPC vision profiles", () => {
  it("gives the rabbit a short linear exclamation vision profile", () => {
    expect(RABBIT.visionProfile).toEqual({
      visionConfig: { type: "linear", range: 4, facing: "down" },
      proximityRange: 1,
      reactionType: "exclamation",
    })
  })

  it("gives the blacksmith a small radius profile that does not auto-chat", () => {
    expect(BLACKSMITH.visionProfile).toEqual({
      visionConfig: { type: "radius", range: 2 },
      proximityRange: 1,
      reactionType: "ignore",
    })
  })
})
