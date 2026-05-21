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
})
