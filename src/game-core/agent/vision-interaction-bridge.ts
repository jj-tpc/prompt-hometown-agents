import { interactWithNPC, type InteractResult } from "@/game-core/agent/interact"
import type { GameState } from "@/game-core/types/game"
import type { NPCMemory, NPCProfile } from "@/game-core/types/npc"
import type { VisionEvent } from "@/game-core/types/map"

export type SightingState = Set<string>

export type SightingDeps = {
  resolveNPC: (npcId: string) => { profile: NPCProfile; memory: NPCMemory } | null
  gameState: GameState
}

export type SightingInteraction = {
  npcId: string
  targetId: string
  result: InteractResult
}

export function createSightingState(): SightingState {
  return new Set<string>()
}

function pairKey(npcId: string, targetId: string): string {
  return `${npcId}::${targetId}`
}

function shouldAutoInteract(profile: NPCProfile): boolean {
  const reaction = profile.visionProfile?.reactionType
  return reaction === "exclamation" || reaction === "alert"
}

export async function processVisionEvents(
  events: VisionEvent[],
  state: SightingState,
  deps: SightingDeps
): Promise<SightingInteraction[]> {
  const interactions: SightingInteraction[] = []

  for (const event of events) {
    const key = pairKey(event.npcId, event.targetId)

    if (event.type === "LOST_SIGHT") {
      state.delete(key)
      continue
    }

    if (state.has(key)) continue

    const resolved = deps.resolveNPC(event.npcId)
    if (!resolved || !shouldAutoInteract(resolved.profile)) continue

    state.add(key)
    const result = await interactWithNPC({
      npcProfile: resolved.profile,
      npcMemory: resolved.memory,
      userMessage: "(NPC detected the target)",
      gameState: deps.gameState,
      gameTimestamp: event.timestamp,
    })

    interactions.push({
      npcId: event.npcId,
      targetId: event.targetId,
      result,
    })
  }

  return interactions
}
