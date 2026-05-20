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
  // ── 기존 4개 (numeric npc_1~4) ──────────────────────────────────
  {
    name: "라미",
    occupation: "풀밭 관리인",
    personality: ["상냥함", "호기심 많음", "조심스러움"],
    dislikeds: ["무리한 부탁", "거친 말투"],
    speechStyle: "친근한 반말, 짧고 따뜻한 문장",
    waypoints: [
      { x: 46, y: 46, label: "여관 앞 풀밭" },
      { x: 50, y: 50, label: "마을 중심" },
    ],
    habits: [{ action: "풀밭 살피기", location: "여관 앞 풀밭", gameHour: 10, duration: 45 }],
  },
  {
    name: "도윤",
    occupation: "길잡이",
    personality: ["침착함", "현실적", "책임감 있음"],
    dislikeds: ["위험한 지름길", "근거 없는 소문"],
    speechStyle: "차분한 반말, 필요한 말만 또렷하게",
    waypoints: [
      { x: 55, y: 51, label: "동쪽 길목" },
      { x: 50, y: 50, label: "마을 중심" },
    ],
    habits: [{ action: "길목 확인하기", location: "동쪽 길목", gameHour: 10, duration: 30 }],
  },
  {
    name: "하린",
    occupation: "기록가",
    personality: ["관찰력 좋음", "수다스러움", "기억력이 좋음"],
    dislikeds: ["대화를 끊는 행동", "잊어버린 약속"],
    speechStyle: "밝은 반말, 가끔 감탄사를 섞음",
    waypoints: [
      { x: 47, y: 56, label: "남쪽 공터" },
      { x: 50, y: 50, label: "마을 중심" },
    ],
    habits: [{ action: "마을 기록 정리", location: "남쪽 공터", gameHour: 10, duration: 60 }],
  },
  {
    name: "무진",
    occupation: "수리공",
    personality: ["과묵함", "성실함", "손재주 좋음"],
    dislikeds: ["재촉", "허술한 준비"],
    speechStyle: "짧은 반말, 무뚝뚝하지만 악의 없는 말투",
    waypoints: [
      { x: 56, y: 45, label: "북동쪽 작업터" },
      { x: 50, y: 50, label: "마을 중심" },
    ],
    habits: [{ action: "도구 손질", location: "북동쪽 작업터", gameHour: 10, duration: 50 }],
  },
  // ── 신규 9개 (npc_5~13) ─────────────────────────────────────────
  {
    name: "경비대원 카엔",
    occupation: "경비대원",
    spriteId: "guard",
    characterPromptKey: "npc_guard",
    personality: ["충직함", "규율", "과묵함"],
    dislikeds: ["무단출입", "규율 위반", "게으름"],
    speechStyle: "짧고 딱딱한 경어, 군대식 어투",
    waypoints: [
      { x: 42, y: 49, label: "마을 서쪽 입구" },
      { x: 50, y: 50, label: "마을 중심" },
    ],
    habits: [{ action: "순찰", location: "마을 서쪽 입구", gameHour: 8, duration: 120 }],
  },
  {
    name: "여관주인 마리",
    occupation: "여관주인",
    spriteId: "innkeeper",
    characterPromptKey: "npc_innkeeper",
    personality: ["수다스러움", "친절", "사업적"],
    dislikeds: ["무전취식 시도", "여관 규칙 무시"],
    speechStyle: "밝고 친근한 반말, 말이 많음",
    waypoints: [
      { x: 42, y: 38, label: "여관" },
      { x: 50, y: 50, label: "마을 중심" },
    ],
    habits: [{ action: "여관 청소", location: "여관", gameHour: 7, duration: 60 }],
  },
  {
    name: "귀족 시릴",
    occupation: "귀족",
    spriteId: "noble",
    characterPromptKey: "npc_noble",
    personality: ["거만함", "박식함", "까다로움"],
    dislikeds: ["무례함", "평민의 무지", "시골 냄새"],
    speechStyle: "격식체, 약간 경멸적, 긴 문장",
    waypoints: [
      { x: 60, y: 67, label: "귀족 별장" },
      { x: 50, y: 50, label: "마을 중심" },
    ],
    habits: [{ action: "별장 정원 산책", location: "귀족 별장", gameHour: 15, duration: 45 }],
  },
  {
    name: "행상인 탄",
    occupation: "행상인",
    spriteId: "street-vendor",
    characterPromptKey: "npc_street_vendor",
    personality: ["눈치빠름", "구수함", "흥정 좋아함"],
    dislikeds: ["흥정 없는 거래", "무시당하는 것"],
    speechStyle: "구수한 상인 말투, 과장 많음",
    waypoints: [
      { x: 48, y: 55, label: "시장 앞" },
      { x: 50, y: 50, label: "마을 중심" },
    ],
    habits: [{ action: "물건 정리", location: "시장 앞", gameHour: 9, duration: 30 }],
  },
  {
    name: "채소장수 나리",
    occupation: "채소장수",
    spriteId: "vegetable-vendor",
    characterPromptKey: "npc_vegetable_vendor",
    personality: ["부지런함", "솔직함", "텃밭 자랑"],
    dislikeds: ["채소 무시", "게으른 사람"],
    speechStyle: "활기차고 직설적인 반말",
    waypoints: [
      { x: 53, y: 58, label: "채소 가판대" },
      { x: 50, y: 50, label: "마을 중심" },
    ],
    habits: [{ action: "채소 가판대 정리", location: "채소 가판대", gameHour: 6, duration: 90 }],
  },
  {
    name: "마을사람 베아",
    occupation: "마을사람",
    spriteId: "townsfolk",
    characterPromptKey: "npc_townsfolk",
    personality: ["평범함", "소문 좋아함", "의심 많음"],
    dislikeds: ["비밀을 안 알려주는 것", "낯선 사람"],
    speechStyle: "수군거리는 듯한 반말",
    waypoints: [
      { x: 50, y: 45, label: "마을 광장" },
      { x: 50, y: 50, label: "마을 중심" },
    ],
    habits: [{ action: "광장 구경", location: "마을 광장", gameHour: 11, duration: 60 }],
  },
  {
    name: "촌민 루카",
    occupation: "촌민",
    spriteId: "villager",
    characterPromptKey: "npc_villager",
    personality: ["순박함", "느긋함", "농사 이야기만"],
    dislikeds: ["재촉", "농사 무시"],
    speechStyle: "느릿느릿한 사투리 반말",
    waypoints: [
      { x: 67, y: 50, label: "동쪽 농가" },
      { x: 50, y: 50, label: "마을 중심" },
    ],
    habits: [{ action: "밭 돌보기", location: "동쪽 농가", gameHour: 6, duration: 180 }],
  },
  {
    name: "양 모모",
    occupation: "양",
    spriteId: "sheep",
    characterPromptKey: "npc_sheep",
    personality: ["순함", "겁쟁이", "먹는 것만 관심"],
    dislikeds: ["큰 소리", "갑작스러운 움직임"],
    speechStyle: "의성어 섞인 짧은 반응, 거의 말을 안 함",
    waypoints: [
      { x: 34, y: 38, label: "양 우리" },
      { x: 50, y: 50, label: "마을 중심" },
    ],
    habits: [{ action: "풀 뜯기", location: "양 우리", gameHour: 8, duration: 240 }],
  },
  {
    name: "대장장이 브렌",
    occupation: "대장장이",
    spriteId: "blacksmith",
    characterPromptKey: "npc_blacksmith2",
    personality: ["고집스러움", "자부심", "일 중독"],
    dislikeds: ["싸구려 일감", "작업 중 방해"],
    speechStyle: "퉁명스럽고 짧은 반말",
    waypoints: [
      { x: 58, y: 37, label: "대장간" },
      { x: 50, y: 50, label: "마을 중심" },
    ],
    habits: [{ action: "쇠 두드리기", location: "대장간", gameHour: 6, duration: 150 }],
  },
]

export type WorldNpcCharacterPromptEntry = {
  npcId: string
  name: string
  spriteId?: string
  characterPromptKey: string
}

export const WORLD_NPC_CHARACTER_PROMPTS: WorldNpcCharacterPromptEntry[] = NPC_BLUEPRINTS
  .map((bp, i) => ({ bp, npcId: `npc_${i + 1}` }))
  .filter(({ bp }) => bp.characterPromptKey != null)
  .map(({ bp, npcId }) => ({
    npcId,
    name: bp.name,
    spriteId: bp.spriteId,
    characterPromptKey: bp.characterPromptKey!,
  }))

export function dialogueChoiceForKey(key: string): DialogueChoice | null {
  return DEFAULT_DIALOGUE_CHOICES.find((choice) => choice.id === key) ?? null
}

export function normalizeCustomDialogueMessage(input: string): string | null {
  const message = input.trim()
  return message.length > 0 ? message : null
}

export function resolveWorldNPCProfile(npcId: string): NPCProfile {
  const match = npcId.match(/\d+$/)
  const npcNumber = match ? Number(match[0]) : 1
  const blueprint = NPC_BLUEPRINTS[(Math.max(1, npcNumber) - 1) % NPC_BLUEPRINTS.length]
  return { id: npcId, ...blueprint }
}

export type WorldNpcDisplayInfo = {
  npcId: string
  name: string
  occupation: string
}

function inferOccupationFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length > 1 ? parts.slice(0, -1).join(" ") : "마을 주민"
}

export function worldNpcDisplayInfo(npcId: string): WorldNpcDisplayInfo {
  const profile = resolveWorldNPCProfile(npcId)
  return {
    npcId,
    name: profile.name,
    occupation: profile.occupation ?? inferOccupationFromName(profile.name),
  }
}

export function makeWorldDialogueGameState(npcs: NpcPosition[]): GameState {
  return {
    clock: { day: 1, currentMinute: 600 },
    availableItems: [
      { id: "apple", name: "사과", quantity: 3 },
      { id: "map_note", name: "마을 지도 조각", quantity: 1 },
      { id: "wood", name: "나무 조각", quantity: 2 },
    ],
    availableLocations: [
      "마을 중심", "마을 광장", "여관", "대장간", "시장 앞",
      "채소 가판대", "귀족 별장", "동쪽 농가", "양 우리",
      "마을 서쪽 입구", "동쪽 길목", "남쪽 공터",
      "잔디밭", "모래 지형", "물가", "숲 근처", "집 주변",
    ],
    npcPositions: Object.fromEntries(
      npcs.map((npc) => [npc.npcId ?? npc.id, { x: npc.x, y: npc.y }])
    ),
  }
}
