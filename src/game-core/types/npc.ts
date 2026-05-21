import type { NPCVisionProfile } from "@/game-core/types/map"

export type NPCProfile = {
  id: string
  name: string
  occupation?: string
  spriteId?: string
  characterPromptKey?: string
  personality: string[]
  dislikeds: string[]
  speechStyle: string
  prohibitBehavior?: string
  habitBehavior?: string
  waypoints: { x: number; y: number; label: string }[]
  habits: {
    action: string
    location: string
    gameHour: number
    duration: number
  }[]
  visionProfile?: NPCVisionProfile
}

export type ConversationEntry = {
  timestamp: number
  speaker: "user" | "npc"
  message: string
  type: "chat" | "request"
  decision?: "ok" | "not_ok"
}

export type NPCMemory = {
  npcId: string
  conversationHistory: ConversationEntry[]
  relationshipScore: number
}
