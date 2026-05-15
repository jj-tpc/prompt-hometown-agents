import type { GameClock } from "@/game-core/types/game"

const CLOCK_KEY = "game:clock"

function defaultClock(): GameClock {
  return { currentMinute: 0, day: 1 }
}

export function loadGameClock(): GameClock {
  if (typeof localStorage === "undefined") return defaultClock()
  const raw = localStorage.getItem(CLOCK_KEY)
  if (!raw) return defaultClock()
  return JSON.parse(raw) as GameClock
}

export function saveGameClock(clock: GameClock): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(CLOCK_KEY, JSON.stringify(clock))
}
