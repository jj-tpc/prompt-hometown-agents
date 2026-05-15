import { createValidateRequestTool } from "@/game-core/agent/tools/validate-request"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"
import type { GameState } from "@/game-core/types/game"

jest.mock("@/game-core/agent/chains/validate-chain", () => ({
  runValidateChain: jest.fn().mockResolvedValue({ valid: false, reason: "장소가 없음" }),
}))
jest.mock("@/game-core/agent/chains/personality-chain", () => ({
  runPersonalityChain: jest.fn(),
}))
jest.mock("@/game-core/agent/chains/decision-chain", () => ({
  runDecisionChain: jest.fn().mockResolvedValue({
    decision: "not_ok",
    responseText: "그런 곳은 없는걸...",
    action: undefined,
  }),
}))

const profile: NPCProfile = {
  id: "npc_1", name: "토끼", personality: ["친절함"], dislikeds: [],
  speechStyle: "반말", waypoints: [], habits: [],
}
const memory: NPCMemory = { npcId: "npc_1", conversationHistory: [], relationshipScore: 0 }
const gameState: GameState = {
  clock: { currentMinute: 0, day: 1 },
  availableItems: [], availableLocations: ["광장"], npcPositions: {},
}

it("Step 1 실패 시 Step 2를 건너뛰고 결과 반환", async () => {
  const { runPersonalityChain } = jest.requireMock("@/game-core/agent/chains/personality-chain")
  let capturedResult: unknown
  const tool = createValidateRequestTool(profile, memory, gameState, (r) => { capturedResult = r })

  await tool.invoke({ userRequest: "없는 곳에 가줘" })

  expect(runPersonalityChain).not.toHaveBeenCalled()
  expect(capturedResult).toMatchObject({ decision: "not_ok" })
})
