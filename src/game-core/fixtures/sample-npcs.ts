import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"
import type { GameState } from "@/game-core/types/game"

export const RABBIT: NPCProfile = {
  id: "npc_rabbit",
  name: "토끼",
  personality: ["겁쟁이", "친절함", "호기심 많음"],
  dislikeds: ["위험한 장소", "폭력적인 요청", "낯선 사람의 갑작스러운 부탁"],
  speechStyle: "반말, 수줍음, 짧고 귀여운 문장, 말끝에 '~' 사용",
  waypoints: [
    { x: 5, y: 5, label: "낚시터" },
    { x: 12, y: 3, label: "광장" },
    { x: 2, y: 10, label: "집" },
  ],
  habits: [
    { action: "낚시하기", location: "낚시터", gameHour: 7, duration: 60 },
    { action: "광장에서 쉬기", location: "광장", gameHour: 14, duration: 30 },
  ],
}

export const BLACKSMITH: NPCProfile = {
  id: "npc_blacksmith",
  name: "대장장이 고르",
  personality: ["고집스러움", "자부심 강함", "일 중독"],
  dislikeds: ["게으른 요청", "싼 값에 일 시키려는 것", "작업 중 방해"],
  speechStyle: "반말, 퉁명스러움, 짧고 직설적인 문장",
  waypoints: [
    { x: 8, y: 8, label: "대장간" },
    { x: 12, y: 3, label: "광장" },
  ],
  habits: [
    { action: "철 두드리기", location: "대장간", gameHour: 6, duration: 120 },
    { action: "철 두드리기", location: "대장간", gameHour: 15, duration: 90 },
  ],
}

export function emptyMemory(npcId: string): NPCMemory {
  return { npcId, conversationHistory: [], relationshipScore: 0 }
}

export function sampleGameState(hour = 10): GameState {
  return {
    clock: { currentMinute: hour * 60, day: 1 },
    availableItems: [
      { id: "fish_rod", name: "낚싯대", quantity: 1 },
      { id: "apple", name: "사과", quantity: 3 },
      { id: "iron_sword", name: "철제 검", quantity: 1 },
    ],
    availableLocations: ["낚시터", "광장", "집", "대장간", "마을 입구"],
    npcPositions: {
      npc_rabbit: { x: 5, y: 5 },
      npc_blacksmith: { x: 8, y: 8 },
    },
  }
}
