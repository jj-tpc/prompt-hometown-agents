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

// 모든 NPC의 대화 히스토리만 비운다. relationshipScore 등 나머지 기억은 유지한다.
// 비운 NPC 수를 반환한다.
export function clearAllNPCHistory(): number {
  if (typeof localStorage === "undefined") return 0
  const memoryKeys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(`${NAMESPACE}npc:`) && key.endsWith(":memory")) {
      memoryKeys.push(key)
    }
  }
  for (const key of memoryKeys) {
    const raw = localStorage.getItem(key)
    if (!raw) continue
    const memory = JSON.parse(raw) as NPCMemory
    memory.conversationHistory = []
    localStorage.setItem(key, JSON.stringify(memory))
  }
  return memoryKeys.length
}
