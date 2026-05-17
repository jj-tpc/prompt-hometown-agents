import { canTraverse } from "@/game-core/map/traversal"
import type { Direction, TileMap } from "@/game-core/types/map"
import type { NPCMemory } from "@/game-core/types/npc"

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

export function memorySpeechText(memory: NPCMemory): string {
  const lastNpcMessage = [...memory.conversationHistory]
    .reverse()
    .find((entry) => entry.speaker === "npc")
  return lastNpcMessage?.message ?? "아직 나눈 이야기는 없어요."
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
