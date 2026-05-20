import { buildWorldPlaybackUrl } from "@/game-core/map-editor/playback-url"

describe("buildWorldPlaybackUrl", () => {
  it("builds the default embedded world URL", () => {
    expect(buildWorldPlaybackUrl({ embed: true })).toBe("/dev/world?embed=1")
  })

  it("builds an embedded draft map URL", () => {
    expect(buildWorldPlaybackUrl({ embed: true, draftMap: true })).toBe(
      "/dev/world?embed=1&draftMap=1"
    )
  })

  it("builds an embedded saved map URL with an encoded map id", () => {
    expect(buildWorldPlaybackUrl({ embed: true, mapId: "map one" })).toBe(
      "/dev/world?embed=1&mapId=map+one"
    )
  })
})
