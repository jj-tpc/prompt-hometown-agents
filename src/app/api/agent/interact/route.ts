import { NextRequest, NextResponse } from "next/server"
import { interactWithNPC } from "@/game-core/agent/interact"
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
  }

  const gameTimestamp =
    body.gameState.clock.currentMinute + body.gameState.clock.day * 1440

  const result = await interactWithNPC({ ...body, gameTimestamp })
  return NextResponse.json(result)
}
