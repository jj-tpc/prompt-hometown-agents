import { readFileSync } from "fs"
import { join } from "path"

const pageSource = readFileSync(join(process.cwd(), "src/app/studio/page.tsx"), "utf8").replace(
  /\r\n/g,
  "\n"
)

function sliceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex)
  if (startIndex === -1 || endIndex === -1) return ""
  return source.slice(startIndex, endIndex)
}

describe("/studio layout", () => {
  it("keeps map preview controls inside the settings tab instead of the page header", () => {
    const headerMarkup = sliceBetween(
      pageSource,
      "<header style={styles.header}>",
      "</header>"
    )
    const settingsMarkup = sliceBetween(
      pageSource,
      '{defaults && tab === "settings" && (',
      "</div>\n          )}"
    )

    expect(headerMarkup).not.toContain("styles.previewControls")
    expect(settingsMarkup).toContain("styles.previewControls")
    expect(settingsMarkup).toContain('href="/studio/map"')
    expect(settingsMarkup).toContain("World Preview")
    expect(settingsMarkup).toContain("Refresh Maps")
  })

  it("lets the left studio column collapse into a narrow rail", () => {
    expect(pageSource).toContain("isLeftPaneCollapsed")
    expect(pageSource).toContain("setIsLeftPaneCollapsed")
    expect(pageSource).toContain("좌측 컬럼 접기")
    expect(pageSource).toContain("좌측 컬럼 펼치기")
    expect(pageSource).toContain("styles.leftPaneCollapsed")
    expect(pageSource).toContain("styles.rightPaneExpanded")
    expect(pageSource).toContain('width: "5%"')
    expect(pageSource).toContain('width: "95%"')
  })

  it("adds an LLM model selector to the settings tab", () => {
    expect(pageSource).toContain("LLM_MODEL_OPTIONS")
    expect(pageSource).toContain("llmModelSelection")
    expect(pageSource).toContain("handleLlmModelChange")
    expect(pageSource).toContain("saveLLMSettings")
    expect(pageSource).toContain("Dialogue Model")
  })

  it("reloads the embedded world preview when maps are refreshed", () => {
    expect(pageSource).toContain("worldPreviewRefreshKey")
    expect(pageSource).toContain("setWorldPreviewRefreshKey")
    expect(pageSource).toContain("previewRefresh=")
    expect(pageSource).toContain("src={worldPreviewSrc}")
  })
})
