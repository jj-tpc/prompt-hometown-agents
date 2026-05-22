import { readFileSync } from "fs"
import { join } from "path"

function readPrompt(filename: string): string {
  return readFileSync(join(process.cwd(), "src/game-core/agent/prompts", filename), "utf8")
}

describe("default agent prompts", () => {
  it("uses the villager persona XML prompt as the default interact prompt", () => {
    const prompt = readPrompt("interact.txt")

    expect(prompt).toContain("<yourPersona>")
    expect(prompt).toContain("<name>{name}</name>")
    expect(prompt).toContain("<dislikeds>{dislikeds}</dislikeds>")
    expect(prompt).toContain(
      "You are {name}, an ordinary villager living in this town. Not an AI, not a guide, not a narrator."
    )
    expect(prompt).toContain("React to what was just said before anything else.")
    expect(prompt).toContain("Never use assistant phrases")
    expect(prompt).toContain("Do not role-play the outcome before the tool runs. React in character first")
    expect(prompt).not.toContain("{habitBehavior}")
    expect(prompt).not.toContain("{prohibitBehavior}")
  })

  it("defines a separate failure response prompt for validation pipeline failures", () => {
    const prompt = readPrompt("failure.txt")

    expect(prompt).toContain("{failureStage}")
    expect(prompt).toContain("{validateResult}")
    expect(prompt).toContain("{personalityResult}")
    expect(prompt).toContain("내가 사는 곳에서는")
    expect(prompt).toContain("stage 1")
    expect(prompt).toContain("stage 2")
  })

  it("tells the personality prompt to judge prohibited behavior by the final requested action", () => {
    const prompt = readPrompt("personality.txt")

    expect(prompt).toContain("normalize the player's message into the final behavior being requested")
    expect(prompt).toContain("judge the behavior the NPC would ultimately need to perform")
    expect(prompt).toContain("Interpret broad context, not exact wording")
    expect(prompt).toContain("Judge the NPC's required action, not the player's phrasing")
    expect(prompt).toContain("물가에 가지 않는다")
    expect(prompt).toContain("물가에 가자")
  })
})
