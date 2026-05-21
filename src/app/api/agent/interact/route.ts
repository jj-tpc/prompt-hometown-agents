import { NextRequest, NextResponse } from "next/server"
import { AgentPipelineError, interactWithNPC } from "@/game-core/agent/interact"
import { normalizeLLMModelSelection, type LLMModelSelection } from "@/game-core/agent/llm-models"
import { loadNpcCharacterPromptDefault } from "@/game-core/agent/prompts/load-prompt"
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
    const failedStage = error instanceof AgentPipelineError ? error.stage : "unknown"
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("Dialogue interaction failed", error)
    return NextResponse.json({
      responseText: "대화 처리 중 문제가 생겼어. 잠시 후 다시 말해줘.",
      decision: "not_ok",
      failedStage,
      errorMessage,
      memoryUpdate: {
        timestamp: gameTimestamp,
        speaker: "npc",
        message: "대화 처리 중 문제가 생겼어. 잠시 후 다시 말해줘.",
        type: "chat",
        decision: "not_ok",
      },
    })
  }
}
