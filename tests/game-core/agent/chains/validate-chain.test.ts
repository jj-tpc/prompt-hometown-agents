import { runValidateChain } from "@/game-core/agent/chains/validate-chain"
import type { GameState } from "@/game-core/types/game"

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    withStructuredOutput: jest.fn().mockReturnValue({}),
  })),
}))

jest.mock("@langchain/core/prompts", () => ({
  ChatPromptTemplate: {
    fromMessages: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnValue({
        invoke: jest.fn().mockResolvedValue({ valid: true, reason: "낚시터는 존재하는 장소입니다." }),
      }),
    }),
  },
}))

const gameState: GameState = {
  clock: { currentMinute: 420, day: 1 },
  availableItems: [{ id: "fish_rod", name: "낚싯대", quantity: 1 }],
  availableLocations: ["낚시터", "광장", "마을 입구"],
  npcPositions: { npc_1: { x: 5, y: 5 } },
}

it("유효한 요청에 valid: true 반환", async () => {
  const result = await runValidateChain("낚시터에 가줘", gameState)
  expect(result.valid).toBe(true)
  expect(result.reason).toBeTruthy()
})
