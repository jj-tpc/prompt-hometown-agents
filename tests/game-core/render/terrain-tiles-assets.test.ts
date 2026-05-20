import {
  ATLAS_IMAGE_GROUPS,
  ATLAS_IMAGES,
  atlasIdForCharacterSprite,
  atlasCategoryFor,
} from "@/game-core/render/terrain-tiles"

describe("atlas image groups", () => {
  it("classifies atlases into editor categories", () => {
    expect(Object.keys(ATLAS_IMAGE_GROUPS)).toEqual([
      "ground",
      "building",
      "object",
      "character",
    ])
    expect(atlasCategoryFor("grass")).toBe("ground")
    expect(atlasCategoryFor("woodenHouse")).toBe("building")
    expect(atlasCategoryFor("fence")).toBe("object")
    expect(atlasCategoryFor("villager")).toBe("character")
  })

  it("keeps ATLAS_IMAGES as the flattened compatibility export", () => {
    const groupedIds = Object.values(ATLAS_IMAGE_GROUPS).flatMap((group) => Object.keys(group))

    expect(Object.keys(ATLAS_IMAGES).sort()).toEqual(groupedIds.sort())
    expect(ATLAS_IMAGES.grass).toBe("/assets/sprout-lands/tilesets/grass.png")
    expect(ATLAS_IMAGES.character).toBe("/assets/sprout-lands/characters/basic-character.png")
  })

  it("normalizes NPC sprite ids to character atlas ids", () => {
    expect(atlasIdForCharacterSprite("blacksmith")).toBe("blacksmith")
    expect(atlasIdForCharacterSprite("street-vendor")).toBe("streetVendor")
    expect(atlasIdForCharacterSprite("vegetable-vendor")).toBe("vegetableVendor")
  })
})
