import { NextRequest, NextResponse } from "next/server"
import {
  AgentPipelineError,
  interactWithNPC,
  type AgentPipelineStage,
} from "@/game-core/agent/interact"
import { normalizeLLMModelSelection, type LLMModelSelection } from "@/game-core/agent/llm-models"
import { loadNpcCharacterPromptDefault } from "@/game-core/agent/prompts/load-prompt"
import {
  VALIDATION_PIPELINE_STAGE_LABELS,
  isValidationPipelineError,
  type ValidationPipelineStage,
} from "@/game-core/agent/tools/validate-request"
import type { PromptOverrides } from "@/game-core/agent/prompt-overrides"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"
import type { GameState } from "@/game-core/types/game"

const UNKNOWN_DIALOGUE_FAILURE_RESPONSE = "잘 못 들었는데... 다시 한 번 말해봐."
const CACHED_DIALOGUE_FAILURE_RESPONSE =
  "바람소리가 너무 크게 불어 아무것도 들리지 않는다. 다시 이야기해보자"

type DialogueFailureStage = ValidationPipelineStage | AgentPipelineStage | "unknown"

function isValidationPipelineStage(stage: unknown): stage is ValidationPipelineStage {
  return (
    typeof stage === "string" &&
    Object.prototype.hasOwnProperty.call(VALIDATION_PIPELINE_STAGE_LABELS, stage)
  )
}

function prefersPoliteSpeech(profile: NPCProfile): boolean {
  return /존댓|공손|丁寧|polite/i.test(profile.speechStyle)
}

function createPersonalityFailureResponse(profile: NPCProfile): string {
  const prohibitBehavior = profile.prohibitBehavior?.trim()
  const disliked = profile.dislikeds[0]?.trim()

  if (prefersPoliteSpeech(profile)) {
    if (prohibitBehavior) {
      return `${prohibitBehavior}는 제 방식과 맞지 않아요. 그 부탁은 들어드릴 수 없어요.`
    }
    if (disliked) {
      return `${disliked}와 관련된 부탁은 어렵겠어요. 제 성격상 받아들이기 힘들어요.`
    }
    return "그 부탁은 제 방식과 맞지 않아요. 다른 부탁을 해 주세요."
  }

  if (prohibitBehavior) {
    return `${prohibitBehavior}는 내 방식과 맞지 않아. 그 부탁은 들어줄 수 없어.`
  }
  if (disliked) {
    return `${disliked}랑 관련된 부탁은 좀 어려워. 내 성격상 받아들이기 힘들어.`
  }
  return "그 부탁은 내 방식과 맞지 않아. 다른 부탁을 해줘."
}

function createFailureResponseText(stage: DialogueFailureStage, profile: NPCProfile): string {
  try {
    if (stage === "personality") return createPersonalityFailureResponse(profile)
    if (stage === "validate") {
      return prefersPoliteSpeech(profile)
        ? "그 부탁은 지금 상황에서는 어려워요. 다른 식으로 말씀해 주세요."
        : "그 부탁은 지금은 어려워. 다른 식으로 말해줘."
    }
    if (stage === "decision") {
      return prefersPoliteSpeech(profile)
        ? "잠깐, 판단이 잘 서지 않아요. 다시 한 번 부탁해 주시겠어요?"
        : "잠깐, 판단이 잘 안 서. 다시 한 번 부탁해줘."
    }
    if (stage === "failure") {
      return UNKNOWN_DIALOGUE_FAILURE_RESPONSE
    }
    return UNKNOWN_DIALOGUE_FAILURE_RESPONSE
  } catch {
    return CACHED_DIALOGUE_FAILURE_RESPONSE
  }
}

function createFailureResult(params: {
  stage: DialogueFailureStage
  errorMessage: string
  gameTimestamp: number
  npcProfile: NPCProfile
  error?: {
    code: "validation_pipeline_failed"
    pipelineStage: ValidationPipelineStage
    pipelineStageLabel: string
    message: string
  }
}) {
  const responseText =
    createFailureResponseText(params.stage, params.npcProfile).trim() ||
    CACHED_DIALOGUE_FAILURE_RESPONSE

  return {
    responseText,
    decision: "not_ok",
    failedStage: params.stage,
    errorMessage: params.errorMessage,
    error: params.error,
    memoryUpdate: {
      timestamp: params.gameTimestamp,
      speaker: "npc",
      message: responseText,
      type: "chat",
      decision: "not_ok",
    },
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    npcProfile: NPCProfile
    npcMemory: NPCMemory
    userMessage: string
    gameState: GameState
    promptOverrides?: PromptOverrides
    characterPromptOverride?: string
    modelSelection?: LLMModelSelection
  }

  const gameTimestamp =
    body.gameState.clock.currentMinute + body.gameState.clock.day * 1440

  const defaultCharacterPrompt = body.npcProfile.characterPromptKey
    ? loadNpcCharacterPromptDefault(body.npcProfile.characterPromptKey)
    : ""

  const characterPrompt = body.characterPromptOverride ?? defaultCharacterPrompt

  try {
    const result = await interactWithNPC({
      npcProfile: body.npcProfile,
      npcMemory: body.npcMemory,
      userMessage: body.userMessage,
      gameState: body.gameState,
      promptOverrides: body.promptOverrides,
      gameTimestamp,
      characterPrompt: characterPrompt || undefined,
      modelSelection: normalizeLLMModelSelection(body.modelSelection),
    })
    return NextResponse.json(result)
  } catch (error) {
    if (isValidationPipelineError(error)) {
      const message = error.message
      return NextResponse.json(
        createFailureResult({
          stage: error.pipelineStage,
          errorMessage: message,
          gameTimestamp,
          npcProfile: body.npcProfile,
          error: {
            code: "validation_pipeline_failed",
            pipelineStage: error.pipelineStage,
            pipelineStageLabel: VALIDATION_PIPELINE_STAGE_LABELS[error.pipelineStage],
            message,
          },
        })
      )
    }

    if (error instanceof AgentPipelineError && isValidationPipelineStage(error.stage)) {
      const message = error.cause instanceof Error ? error.cause.message : error.message
      return NextResponse.json(
        createFailureResult({
          stage: error.stage,
          errorMessage: message,
          gameTimestamp,
          npcProfile: body.npcProfile,
          error: {
            code: "validation_pipeline_failed",
            pipelineStage: error.stage,
            pipelineStageLabel: VALIDATION_PIPELINE_STAGE_LABELS[error.stage],
            message,
          },
        })
      )
    }

    const failedStage = error instanceof AgentPipelineError ? error.stage : "unknown"
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("Dialogue interaction failed", error)
    return NextResponse.json(
      createFailureResult({
        stage: failedStage,
        errorMessage,
        gameTimestamp,
        npcProfile: body.npcProfile,
      })
    )
  }
}
