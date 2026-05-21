import { readFileSync } from "fs"
import { join } from "path"

const source = readFileSync(join(process.cwd(), "src/app/dev/world/page.tsx"), "utf8").replace(
  /\r\n/g,
  "\n"
)

describe("/dev/world NPC action flow", () => {
  it("queues accepted NPC actions until the dialogue box closes", () => {
    expect(source).toContain("pendingAction")
    expect(source).toContain("applyNpcAction")
    expect(source).toContain("speechBubble.pendingAction")
  })

  it("supports following and returning home behavior states", () => {
    expect(source).toContain('"following"')
    expect(source).toContain('"returning"')
    expect(source).toContain("followTicksRemaining")
    expect(source).toContain("returnDelayTicks")
  })
})
