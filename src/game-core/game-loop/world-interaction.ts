import { canTraverse } from "@/game-core/map/traversal"
import type { Direction, TileMap } from "@/game-core/types/map"
import type { NPCMemory, NPCProfile } from "@/game-core/types/npc"

export type GridPosition = { x: number; y: number }

export type NpcPosition = GridPosition & {
  id: string
  npcId?: string
}

export const DIRECTION_DELTAS: Record<Direction, GridPosition> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export function positionInDirection(position: GridPosition, direction: Direction): GridPosition {
  const delta = DIRECTION_DELTAS[direction]
  return { x: position.x + delta.x, y: position.y + delta.y }
}

function samePosition(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y
}

export function attemptPlayerMove(input: {
  map: TileMap
  player: GridPosition
  direction: Direction
  occupiedPositions: GridPosition[]
}): { moved: boolean; position: GridPosition; facing: Direction } {
  const next = positionInDirection(input.player, input.direction)
  const isOccupied = input.occupiedPositions.some((position) => samePosition(position, next))

  if (isOccupied || !canTraverse(input.map, input.player, next)) {
    return { moved: false, position: input.player, facing: input.direction }
  }

  return { moved: true, position: next, facing: input.direction }
}

export function findFacingNpc(
  player: GridPosition,
  facing: Direction,
  npcs: NpcPosition[]
): NpcPosition | null {
  const target = positionInDirection(player, facing)
  return npcs.find((npc) => samePosition(npc, target)) ?? null
}

export function oppositeDirection(direction: Direction): Direction {
  switch (direction) {
    case "up":
      return "down"
    case "down":
      return "up"
    case "left":
      return "right"
    case "right":
      return "left"
  }
}

export function firstMeetingGreeting(profile: Pick<NPCProfile, "name" | "personality" | "speechStyle">): string {
  const traits = profile.personality.join(" ")
  const speechStyle = profile.speechStyle

  if (speechStyle.includes("군대식") || speechStyle.includes("경어")) {
    return "처음 뵙겠습니다. 순찰 중 이상 없습니다."
  }

  if (speechStyle.includes("격식체") || traits.includes("거만함")) {
    return "흠, 처음 보는 분이군요. 무슨 일입니까?"
  }

  if (traits.includes("수다스러움") || speechStyle.includes("밝")) {
    return "안녕! 처음 보네, 무슨 일로 왔어?"
  }

  if (traits.includes("과묵함") || speechStyle.includes("짧")) {
    return "처음 보네. 무슨 일이지?"
  }

  if (speechStyle.includes("반말")) {
    return "안녕, 처음 보네. 무슨 일이야?"
  }

  return `${profile.name}입니다. 처음 뵙네요.`
}

export function memorySpeechText(memory: NPCMemory, initialProfile?: Pick<NPCProfile, "name" | "personality" | "speechStyle">): string {
  const lastNpcMessage = [...memory.conversationHistory]
    .reverse()
    .find((entry) => entry.speaker === "npc")
  return lastNpcMessage?.message ?? (initialProfile ? firstMeetingGreeting(initialProfile) : "안녕하세요. 처음 뵙네요.")
}

export function splitSpeechTextPages(text: string, maxChars = 84): string[] {
  const cleanText = text.trim()
  if (!cleanText) return [""]

  const pages: string[] = []
  let current = ""

  const pushCurrent = () => {
    if (!current) return
    pages.push(current)
    current = ""
  }

  for (const word of cleanText.split(/\s+/)) {
    if (word.length > maxChars) {
      pushCurrent()
      for (let i = 0; i < word.length; i += maxChars) {
        pages.push(word.slice(i, i + maxChars))
      }
      continue
    }

    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > maxChars) {
      pushCurrent()
      current = word
    } else {
      current = candidate
    }
  }

  pushCurrent()
  return pages.length > 0 ? pages : [cleanText]
}

export function advanceSpeechPage(currentPageIndex: number, totalPages: number): number | null {
  const nextPageIndex = currentPageIndex + 1
  return nextPageIndex < totalPages ? nextPageIndex : null
}
