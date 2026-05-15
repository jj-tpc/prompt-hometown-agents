import type { NPCMemory, ConversationEntry } from "@/game-core/types/npc"

const NAMESPACE = "game:"

function storageKey(npcId: string) {
  return `${NAMESPACE}npc:${npcId}:memory`
}

function defaultMemory(npcId: string): NPCMemory {
  return { npcId, conversationHistory: [], relationshipScore: 0 }
}

export function loadNPCMemory(npcId: string): NPCMemory {
  if (typeof localStorage === "undefined") return defaultMemory(npcId)
  const raw = localStorage.getItem(storageKey(npcId))
  if (!raw) return defaultMemory(npcId)
  return JSON.parse(raw) as NPCMemory
}

export function saveNPCMemory(memory: NPCMemory): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(storageKey(memory.npcId), JSON.stringify(memory))
}

export function appendConversationEntry(npcId: string, entry: ConversationEntry): void {
  const memory = loadNPCMemory(npcId)
  memory.conversationHistory.push(entry)
  saveNPCMemory(memory)
}
