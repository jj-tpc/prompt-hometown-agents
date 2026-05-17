import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { runValidateChain } from "@/game-core/agent/chains/validate-chain"
import { runPersonalityChain } from "@/game-core/agent/chains/personality-chain"
import { runDecisionChain } from "@/game-core/agent/chains/decision-chain"
import type { PromptOverrides } from "@/game-core/agent/prompt-overrides"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"
import type { GameState, NPCAction } from "@/game-core/types/game"

export type RequestResult = {
  decision: "ok" | "not_ok"
  responseText: string
  action?: NPCAction
}

export function createValidateRequestTool(
  profile: NPCProfile,
  memory: NPCMemory,
  gameState: GameState,
  onResult: (result: RequestResult) => void,
  overrides?: PromptOverrides
) {
  return tool(
    async ({ userRequest }: { userRequest: string }) => {
      const validateResult = await runValidateChain(userRequest, gameState, overrides?.validate)

      if (!validateResult.valid) {
        const decisionResult = await runDecisionChain(
          userRequest,
          profile,
          validateResult,
          { compatible: false, reason: "유효하지 않은 요청" },
          overrides?.decision
        )
        onResult(decisionResult)
        return JSON.stringify(decisionResult)
      }

      const personalityResult = await runPersonalityChain(
        userRequest,
        profile,
        memory,
        overrides?.personality
      )
      const decisionResult = await runDecisionChain(
        userRequest,
        profile,
        validateResult,
        personalityResult,
        overrides?.decision
      )
      onResult(decisionResult)
      return JSON.stringify(decisionResult)
    },
    {
      name: "validate_request",
      description:
        "유저가 NPC에게 구체적인 행동을 요청하거나 부탁할 때 호출한다. 단순 대화, 질문, 감정 표현에는 호출하지 않는다. 예시 트리거: '~해줘', '~해줄 수 있어?', '~부탁해'",
      schema: z.object({
        userRequest: z.string().describe("유저의 요청 내용"),
      }),
    }
  )
}
