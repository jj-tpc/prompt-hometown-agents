import type { NpcPosition } from "@/game-core/game-loop/world-interaction"
import type { GameState } from "@/game-core/types/game"
import type { NPCProfile } from "@/game-core/types/npc"

export type DialogueChoiceId = "1" | "2" | "3"

export type DialogueChoice = {
  id: DialogueChoiceId
  label: string
  userMessage: string
}

export const DEFAULT_DIALOGUE_CHOICES: DialogueChoice[] = [
  {
    id: "1",
    label: "안녕, 요즘 어떻게 지내?",
    userMessage: "안녕, 요즘 어떻게 지내?",
  },
  {
    id: "2",
    label: "혹시 나 좀 도와줄 수 있어?",
    userMessage: "혹시 나 좀 도와줄 수 있어?",
  },
  {
    id: "3",
    label: "이 마을에 대해 알려줘.",
    userMessage: "이 마을에 대해 알려줘.",
  },
]

type NPCBlueprint = Omit<NPCProfile, "id">

const NPC_BLUEPRINTS: NPCBlueprint[] = [
  {
    name: "라미",
    personality: ["상냥함", "호기심 많음", "조심스러움"],
    dislikeds: ["무리한 부탁", "거친 말투"],
    speechStyle: "친근한 반말, 짧고 따뜻한 문장",
    waypoints: [
      { x: 95, y: 97, label: "작은 풀밭" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "풀밭 살피기", location: "작은 풀밭", gameHour: 10, duration: 45 }],
  },
  {
    name: "도윤",
    personality: ["침착함", "현실적", "책임감 있음"],
    dislikeds: ["위험한 지름길", "근거 없는 소문"],
    speechStyle: "차분한 반말, 필요한 말만 또렷하게",
    waypoints: [
      { x: 105, y: 102, label: "동쪽 길목" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "길목 확인하기", location: "동쪽 길목", gameHour: 10, duration: 30 }],
  },
  {
    name: "하린",
    personality: ["관찰력 좋음", "수다스러움", "기억력이 좋음"],
    dislikeds: ["대화를 끊는 행동", "잊어버린 약속"],
    speechStyle: "밝은 반말, 가끔 감탄사를 섞음",
    waypoints: [
      { x: 97, y: 105, label: "남쪽 공터" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "마을 기록 정리", location: "남쪽 공터", gameHour: 10, duration: 60 }],
  },
  {
    name: "무진",
    personality: ["과묵함", "성실함", "손재주 좋음"],
    dislikeds: ["재촉", "허술한 준비"],
    speechStyle: "짧은 반말, 무뚝뚝하지만 악의 없는 말투",
    waypoints: [
      { x: 106, y: 96, label: "북동쪽 작업터" },
      { x: 100, y: 100, label: "마을 중심" },
    ],
    habits: [{ action: "도구 손질", location: "북동쪽 작업터", gameHour: 10, duration: 50 }],
  },
]

export function dialogueChoiceForKey(key: string): DialogueChoice | null {
  return DEFAULT_DIALOGUE_CHOICES.find((choice) => choice.id === key) ?? null
}

export function resolveWorldNPCProfile(npcId: string): NPCProfile {
  const match = npcId.match(/\d+$/)
  const npcNumber = match ? Number(match[0]) : 1
  const blueprint = NPC_BLUEPRINTS[(Math.max(1, npcNumber) - 1) % NPC_BLUEPRINTS.length]
  return { id: npcId, ...blueprint }
}

export function makeWorldDialogueGameState(npcs: NpcPosition[]): GameState {
  return {
    clock: { day: 1, currentMinute: 600 },
    availableItems: [
      { id: "apple", name: "사과", quantity: 3 },
      { id: "map_note", name: "마을 지도 조각", quantity: 1 },
      { id: "wood", name: "나무 조각", quantity: 2 },
    ],
    availableLocations: ["마을 중심", "작은 풀밭", "동쪽 길목", "남쪽 공터", "북동쪽 작업터"],
    npcPositions: Object.fromEntries(
      npcs.map((npc) => [npc.npcId ?? npc.id, { x: npc.x, y: npc.y }])
    ),
  }
}
