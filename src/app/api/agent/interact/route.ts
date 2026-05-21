import { NextRequest, NextResponse } from "next/server"
import { interactWithNPC } from "@/game-core/agent/interact"
import { loadNpcCharacterPromptDefault } from "@/game-core/agent/prompts/load-prompt"
import {
  VALIDATION_PIPELINE_STAGE_LABELS,
  isValidationPipelineError,
} from "@/game-core/agent/tools/validate-request"
import type { PromptOverrides } from "@/game-core/agent/prompt-overrides"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"
import type { GameState } from "@/game-core/types/game"

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    npcProfile: NPCProfile
    npcMemory: NPCMemory
    userMessage: string
    gameState: GameState
    promptOverrides?: PromptOverrides
    characterPromptOverride?: string
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
    })
    return NextResponse.json(result)
  } catch (error) {
    if (isValidationPipelineError(error)) {
      return NextResponse.json(
        {
          error: {
            code: "validation_pipeline_failed",
            pipelineStage: error.pipelineStage,
            pipelineStageLabel: VALIDATION_PIPELINE_STAGE_LABELS[error.pipelineStage],
            message: error.message,
          },
        },
        { status: 502 }
      )
    }

    throw error
  }
}
