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

  it("keeps validation pipeline failures visible with stage details and E dismiss copy", () => {
    expect(worldPageSource).toContain("type ValidationPipelineErrorPayload")
    expect(worldPageSource).toContain("formatInteractionErrorMessage")
    expect(worldPageSource).toContain('aria-label="Validation pipeline error"')
    expect(worldPageSource).toContain("검증 파이프라인 실패")
    expect(worldPageSource).toContain("E를 눌러 닫기")
    expect(worldPageSource).toContain("errorPulse")
  })
})
