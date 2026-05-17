import { generateRandomTerrain } from "@/game-core/map/random-terrain"
import { loadMap } from "@/game-core/map/loader"

describe("generateRandomTerrain", () => {
  it("generates a valid 200x200 TileMap", () => {
    const map = loadMap(generateRandomTerrain(200, 200))
    expect(map.width).toBe(200)
    expect(map.height).toBe(200)
    expect(map.layers.map((l) => l.name)).toEqual([
      "ground",
      "decoration",
      "object",
      "overlay",
    ])
  })

  it("spawns the player on grass at the map center", () => {
    const map = generateRandomTerrain(200, 200)
    const spawn = map.spawnPoints[0]
    expect(spawn.x).toBe(100)
    expect(spawn.y).toBe(100)
    expect(map.layers[0].tiles[spawn.y][spawn.x]).toBe("grass")
  })

  it("is deterministic for a given seed", () => {
    const a = generateRandomTerrain(60, 60, 42)
    const b = generateRandomTerrain(60, 60, 42)
    expect(a.layers[0].tiles).toEqual(b.layers[0].tiles)
  })

  it("assigns NPCs all four cardinal facings in the demo world", () => {
    const map = generateRandomTerrain(200, 200)
    const npcFacings = map.spawnPoints
      .filter((spawn) => spawn.entityType === "npc")
      .map((spawn) => spawn.facing)

    expect(npcFacings).toEqual(["down", "left", "up", "right"])
  })

  it("surrounds the map with a water border", () => {
    const ground = generateRandomTerrain(60, 60).layers[0].tiles
    expect(ground[0].every((t) => t === "water")).toBe(true)
    expect(ground[59].every((t) => t === "water")).toBe(true)
    expect(ground.every((row) => row[0] === "water" && row[59] === "water")).toBe(true)
  })
})
