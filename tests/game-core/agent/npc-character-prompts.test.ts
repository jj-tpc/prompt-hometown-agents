import { readFileSync } from "fs"
import { join } from "path"

const NPC_PROMPT_FILES = [
  "npc_blacksmith2.txt",
  "npc_guard.txt",
  "npc_innkeeper.txt",
  "npc_noble.txt",
  "npc_sheep.txt",
  "npc_street_vendor.txt",
  "npc_townsfolk.txt",
  "npc_vegetable_vendor.txt",
  "npc_villager.txt",
]

function readNpcPrompt(filename: string): string {
  return readFileSync(
    join(process.cwd(), "src/game-core/agent/prompts/npcs", filename),
    "utf8"
  )
}

describe("NPC character prompts", () => {
  it("defines habit and prohibited behavior tags for every named NPC prompt", () => {
    for (const filename of NPC_PROMPT_FILES) {
      const prompt = readNpcPrompt(filename)
      expect(prompt).toContain("<habit_behavior>")
      expect(prompt).toContain("</habit_behavior>")
      expect(prompt).toContain("<prohibit_behavior>")
      expect(prompt).toContain("</prohibit_behavior>")
    }
  })

  it("includes required behavior rules for Kaen, Luca, and Cyril", () => {
    expect(readNpcPrompt("npc_guard.txt")).toContain(
      "<prohibit_behavior>보초를 서야하므로 움직여서는 안된다</prohibit_behavior>"
    )
    expect(readNpcPrompt("npc_villager.txt")).toContain(
      "<habit_behavior>사투리를 써야함. 경상도 방언을 쓰도록.</habit_behavior>"
    )
    expect(readNpcPrompt("npc_villager.txt")).toContain(
      "<prohibit_behavior>물가를 가는 걸 싫어한다. 물, 또는 그 근처로 이동하는 걸 무서워한다.</prohibit_behavior>"
    )
    expect(readNpcPrompt("npc_noble.txt")).toContain(
      "<prohibit_behavior>계급이 천한 다른 이의 이동 명령을 듣지 않는다</prohibit_behavior>"
    )
  })
})
