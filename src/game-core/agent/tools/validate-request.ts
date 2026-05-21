import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { runValidateChain } from "@/game-core/agent/chains/validate-chain"
import { runPersonalityChain } from "@/game-core/agent/chains/personality-chain"
import { runDecisionChain } from "@/game-core/agent/chains/decision-chain"
import { withAcceptedRequestAction } from "@/game-core/agent/request-action"
import type { LLMModelSelection } from "@/game-core/agent/llm-models"
import type { PromptOverrides } from "@/game-core/agent/prompt-overrides"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"
import type { GameState, NPCAction } from "@/game-core/types/game"

export type ValidationPipelineStage = "validate" | "personality" | "decision"

export const VALIDATION_PIPELINE_STAGE_LABELS: Record<ValidationPipelineStage, string> = {
  validate: "검증(validate)",
  personality: "성격(personality)",
  decision: "결정(decision)",
}

export class ValidationPipelineError extends Error {
  pipelineStage: ValidationPipelineStage

  constructor(pipelineStage: ValidationPipelineStage, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = "ValidationPipelineError"
    this.pipelineStage = pipelineStage
    this.cause = cause
  }
}

export type RequestResult = {
  decision: "ok" | "not_ok"
  responseText: string
  action?: NPCAction
}

export function isValidationPipelineError(error: unknown): error is ValidationPipelineError {
  if (typeof error !== "object" || error === null) return false
  const pipelineStage = (error as { pipelineStage?: unknown }).pipelineStage
  return (
    typeof pipelineStage === "string" &&
    Object.prototype.hasOwnProperty.call(VALIDATION_PIPELINE_STAGE_LABELS, pipelineStage)
  )
}

async function runPipelineStage<T>(
  pipelineStage: ValidationPipelineStage,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw new ValidationPipelineError(pipelineStage, error)
  }
}

export function createValidateRequestTool(
  profile: NPCProfile,
  memory: NPCMemory,
  gameState: GameState,
  onResult: (result: RequestResult) => void,
  overrides?: PromptOverrides,
  modelSelection?: LLMModelSelection
) {
  return tool(
    async ({ userRequest }: { userRequest: string }) => {
      const validateResult = await runPipelineStage("validate", () =>
        runValidateChain(userRequest, gameState, overrides?.validate, modelSelection)
      )

      if (!validateResult.valid) {
        const decisionResult = await runPipelineStage("decision", () =>
          runDecisionChain(
            userRequest,
            profile,
            validateResult,
            {
              compatible: false,
              failureStage: "validate",
              reason: validateResult.reason,
            },
            overrides?.decision,
            modelSelection
          )
        )
        const requestResult = withAcceptedRequestAction(userRequest, decisionResult)
        onResult(requestResult)
        return JSON.stringify(requestResult)
      }

      const personalityResult = await runPipelineStage("personality", () =>
        runPersonalityChain(
          userRequest,
          profile,
          memory,
          overrides?.personality,
          modelSelection
        )
      )
      const decisionResult = await runPipelineStage("decision", () =>
        runDecisionChain(
          userRequest,
          profile,
          validateResult,
          personalityResult,
          overrides?.decision,
          modelSelection
        )
      )
      const requestResult = withAcceptedRequestAction(userRequest, decisionResult)
      onResult(requestResult)
      return JSON.stringify(requestResult)
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
