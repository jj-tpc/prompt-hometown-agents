import { readFileSync } from "fs"
import { join } from "path"

const worldPageSource = readFileSync(
  join(process.cwd(), "src/app/dev/world/page.tsx"),
  "utf8"
).replace(/\r\n/g, "\n")

describe("/dev/world dialogue layout", () => {
  it("shows NPC name and occupation in the dialogue box header", () => {
    expect(worldPageSource).toContain("worldNpcDisplayInfo")
    expect(worldPageSource).toContain("직업:")
    expect(worldPageSource).not.toContain("{speechBubble.npcId}\n")
  })

  it("uses larger text for the dialogue box controls", () => {
    expect(worldPageSource).toContain("fontSize: 24")
    expect(worldPageSource).toContain("fontSize: 15")
  })

  it("sends the selected LLM model with dialogue requests", () => {
    expect(worldPageSource).toContain("loadLLMSettings")
    expect(worldPageSource).toContain("modelSelection: loadLLMSettings().modelSelection")
  })
})
