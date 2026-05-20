import { createBlankTileMap } from "@/game-core/map-editor/create-map"
import { paintTile } from "@/game-core/map-editor/editor-reducer"
import { validateMapForEditing } from "@/game-core/map-editor/validation"

describe("validateMapForEditing", () => {
  it("accepts a valid blank map", () => {
    expect(
      validateMapForEditing(
        createBlankTileMap({ id: "valid", name: "Valid", width: 5, height: 5 })
      )
    ).toEqual([])
  })

  it("reports a missing player spawn", () => {
    const map = createBlankTileMap({ id: "missing_player", name: "Missing", width: 5, height: 5 })
    map.spawnPoints = []

    expect(validateMapForEditing(map)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: "error", message: "Missing player spawn" }),
      ])
    )
  })

  it("warns when more than one player spawn exists", () => {
    const map = createBlankTileMap({ id: "many_players", name: "Many", width: 5, height: 5 })
    map.spawnPoints.push({
      id: "player_second",
      x: 1,
      y: 1,
      facing: "down",
      entityType: "player",
    })

    expect(validateMapForEditing(map)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: "warning", message: "More than one player spawn" }),
      ])
    )
  })

  it("reports out-of-bounds spawns", () => {
    const map = createBlankTileMap({ id: "bad_spawn", name: "Bad Spawn", width: 5, height: 5 })
    map.spawnPoints[0] = { ...map.spawnPoints[0], x: 99 }

    expect(validateMapForEditing(map)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: "error", message: "Invalid TileMap: spawnPoints[0] is out of bounds" }),
        expect.objectContaining({ level: "error", message: "Spawn player_start is out of bounds" }),
      ])
    )
  })

  it("reports bad layer dimensions", () => {
    const map = createBlankTileMap({ id: "bad_dims", name: "Bad Dims", width: 5, height: 5 })
    map.layers[0].tiles[0] = map.layers[0].tiles[0].slice(0, 3)

    expect(validateMapForEditing(map)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: "error", message: "ground row 0 must have 5 columns" }),
      ])
    )
  })

  it("reports unknown tile types", () => {
    const map = createBlankTileMap({ id: "bad_tile", name: "Bad Tile", width: 5, height: 5 })
    ;(map.layers[0].tiles[0] as unknown[])[0] = "lava"

    expect(validateMapForEditing(map)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: "error", message: "Unknown tile type: lava" }),
      ])
    )
  })

  it("warns when a spawn is on a non-walkable cell", () => {
    const map = paintTile(
      createBlankTileMap({ id: "blocked_spawn", name: "Blocked", width: 5, height: 5 }),
      "ground",
      2,
      2,
      "water"
    )

    expect(validateMapForEditing(map)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "warning",
          message: "Spawn player_start is on a non-walkable cell",
        }),
      ])
    )
  })

  it("warns for known tiles whose sprite is not mapped yet", () => {
    const map = paintTile(
      createBlankTileMap({ id: "missing_sprite", name: "Missing Sprite", width: 5, height: 5 }),
      "object",
      1,
      1,
      "tree"
    )

    expect(validateMapForEditing(map)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: "warning", message: "Missing sprite: tiles:tree" }),
      ])
    )
  })
})
