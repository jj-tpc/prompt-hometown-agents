import { readFileSync } from "fs"
import { join } from "path"

const pageSource = readFileSync(join(process.cwd(), "src/app/studio/map/page.tsx"), "utf8").replace(
  /\r\n/g,
  "\n"
)

describe("/studio/map playback links", () => {
  it("saves the current draft before opening the draft playback", () => {
    expect(pageSource).toContain("saveDraftBeforePlay")
    expect(pageSource).toContain("saveMapEditorDraft(map)")
    expect(pageSource).toContain("onClick={saveDraftBeforePlay}")
    expect(pageSource).toContain("Play Draft")
  })

  it("saves the current named map before opening saved-map playback", () => {
    expect(pageSource).toContain("saveCurrentNamedMapBeforePlay")
    expect(pageSource).toContain("saveNamedMap(map)")
    expect(pageSource).toContain("onClick={saveCurrentNamedMapBeforePlay}")
    expect(pageSource).toContain("Play Map")
  })
})
