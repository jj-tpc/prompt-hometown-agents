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

  it("shows an animated validation pipeline panel during dialogue requests", () => {
    expect(worldPageSource).toContain("PipelinePanelState")
    expect(worldPageSource).toContain("startPipelinePanel")
    expect(worldPageSource).toContain("finishPipelinePanel")
    expect(worldPageSource).toContain("검증 파이프라인 상태")
    expect(worldPageSource).toContain("pipeline-panel--visible")
    expect(worldPageSource).toContain("pipeline-panel--hidden")
    expect(worldPageSource).toContain("prefers-reduced-motion")
    expect(worldPageSource).toContain("failedStage")
    expect(worldPageSource).toContain("errorMessage")
  })

  it("moves validation failure details into the slide-up pipeline panel", () => {
    expect(worldPageSource).toContain("type ValidationPipelineErrorPayload")
    expect(worldPageSource).toContain("pipelinePanel.error")
    expect(worldPageSource).toContain("검증 파이프라인 실패")
    expect(worldPageSource).toContain("원인:")
    expect(worldPageSource).toContain("E를 눌러 닫기")
    expect(worldPageSource).toContain("errorPulse")
    expect(worldPageSource).not.toContain('aria-label="Validation pipeline error"')
    expect(worldPageSource).not.toContain("formatInteractionErrorMessage")
  })

  it("keeps failed pipeline panels open longer and lets E dismiss them", () => {
    expect(worldPageSource).toContain("PIPELINE_FAILURE_PANEL_HIDE_MS")
    expect(worldPageSource).toContain("dismissPipelinePanel")
    expect(worldPageSource).toContain('pipelinePanel?.status === "failed"')
  })
})
