import { sampleOpenMap, sampleWalledMap } from "@/game-core/fixtures/sample-maps"
import type { NPCVisionProfile } from "@/game-core/types/map"
import { computeVision } from "@/game-core/vision/compute-vision"

const player = (id: string, x: number, y: number) => ({
  id,
  type: "player" as const,
  position: { x, y },
})

describe("computeVision linear", () => {
  const npcPosition = { x: 6, y: 3 }
  const visionLeft: NPCVisionProfile = {
    visionConfig: { type: "linear", range: 5, facing: "left" },
    proximityRange: 0,
    reactionType: "exclamation",
  }
  const visionRight: NPCVisionProfile = {
    visionConfig: { type: "linear", range: 5, facing: "right" },
    proximityRange: 0,
    reactionType: "exclamation",
  }

  it("detects an entity exactly on the facing beam at inclusive range", () => {
    const result = computeVision(npcPosition, visionLeft, sampleOpenMap(), [player("player", 1, 3)])

    expect(result.detectedEntities).toEqual([
      expect.objectContaining({
        entityId: "player",
        distance: 5,
        hasLOS: true,
      }),
    ])
  })

  it("ignores entities beyond range or off the facing beam", () => {
    expect(
      computeVision(npcPosition, visionLeft, sampleOpenMap(), [player("far", 0, 3)])
        .detectedEntities
    ).toHaveLength(0)
    expect(
      computeVision(npcPosition, visionLeft, sampleOpenMap(), [player("above", 6, 0)])
        .detectedEntities
    ).toHaveLength(0)
    expect(
      computeVision(npcPosition, visionRight, sampleOpenMap(), [player("behind", 1, 3)])
        .detectedEntities
    ).toHaveLength(0)
  })

  it("stops at opaque tiles and does not include blocked tiles as visible", () => {
    const result = computeVision(npcPosition, visionLeft, sampleWalledMap(), [
      player("blocked", 1, 3),
      player("near", 5, 3),
    ])

    expect(result.detectedEntities.map((entity) => entity.entityId)).toEqual(["near"])
    expect(result.visibleTilePositions).toContainEqual({ x: 5, y: 3 })
    expect(result.visibleTilePositions).not.toContainEqual({ x: 4, y: 3 })
    expect(result.visibleTilePositions).not.toContainEqual({ x: 3, y: 3 })
  })
})

describe("computeVision proximity", () => {
  const npcPosition = { x: 6, y: 3 }
  const visionLeft = (proximityRange?: number): NPCVisionProfile => ({
    visionConfig: { type: "linear", range: 5, facing: "left" },
    proximityRange,
    reactionType: "exclamation",
  })

  it("detects nearby entities outside the facing direction by Chebyshev distance", () => {
    const result = computeVision(npcPosition, visionLeft(1), sampleOpenMap(), [
      player("behind", 7, 3),
      player("diagonal", 7, 2),
      player("far", 6, 5),
    ])

    expect(result.detectedEntities.map((entity) => entity.entityId).sort()).toEqual([
      "behind",
      "diagonal",
    ])
  })

  it("defaults proximityRange to 1 and does not duplicate beam detections", () => {
    const result = computeVision(npcPosition, visionLeft(), sampleOpenMap(), [
      player("behind", 7, 3),
      player("both", 5, 3),
    ])

    expect(result.detectedEntities.map((entity) => entity.entityId).sort()).toEqual([
      "behind",
      "both",
    ])
    expect(result.detectedEntities.filter((entity) => entity.entityId === "both")).toHaveLength(1)
  })
})

describe("computeVision cone", () => {
  const npcPosition = { x: 4, y: 4 }
  const coneUp: NPCVisionProfile = {
    visionConfig: { type: "cone", range: 4, halfAngle: 45, facing: "up" },
    proximityRange: 0,
    reactionType: "exclamation",
  }

  it("detects entities inside the cone and at inclusive range", () => {
    const result = computeVision(npcPosition, coneUp, sampleOpenMap(), [
      player("front", 4, 2),
      player("edge", 5, 3),
      player("range-edge", 4, 0),
    ])

    expect(result.detectedEntities.map((entity) => entity.entityId).sort()).toEqual([
      "edge",
      "front",
      "range-edge",
    ])
  })

  it("ignores entities outside the cone angle or blocked by LOS", () => {
    expect(
      computeVision(npcPosition, coneUp, sampleOpenMap(), [player("right", 7, 4)])
        .detectedEntities
    ).toHaveLength(0)
    expect(
      computeVision(npcPosition, coneUp, sampleWalledMap(), [player("blocked", 4, 2)])
        .detectedEntities
    ).toHaveLength(0)
  })
})

describe("computeVision radius", () => {
  const npcPosition = { x: 4, y: 4 }
  const radius3: NPCVisionProfile = {
    visionConfig: { type: "radius", range: 3 },
    proximityRange: 0,
    reactionType: "exclamation",
  }

  it("detects entities in every direction inside the radius", () => {
    const result = computeVision(npcPosition, radius3, sampleOpenMap(), [
      player("above", 4, 2),
      player("right", 6, 4),
      player("below", 4, 6),
    ])

    expect(result.detectedEntities.map((entity) => entity.entityId).sort()).toEqual([
      "above",
      "below",
      "right",
    ])
  })

  it("rejects entities outside radius or blocked by LOS", () => {
    expect(
      computeVision(npcPosition, radius3, sampleOpenMap(), [player("far", 0, 0)])
        .detectedEntities
    ).toHaveLength(0)
    expect(
      computeVision(npcPosition, radius3, sampleWalledMap(), [player("blocked", 4, 1)])
        .detectedEntities
    ).toHaveLength(0)
  })
})
