import { NextRequest, NextResponse } from "next/server"
import { interactWithNPC } from "@/game-core/agent/interact"
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
}
