export type GameClock = {
  currentMinute: number
  day: number
}

export type GameState = {
  clock: GameClock
  availableItems: { id: string; name: string; quantity: number }[]
  availableLocations: string[]
  npcPositions: Record<string, { x: number; y: number }>
}

export type NPCAction =
  | { type: "give_item"; itemId: string; quantity: number }
  | { type: "move_to"; targetNpcId: string }

export type QueuedAction =
  | { source: "request"; action: NPCAction }
  | { source: "habit"; habitAction: string }
