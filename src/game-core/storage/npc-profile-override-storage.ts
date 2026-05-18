const KEY = (npcId: string) => `hometown:npc-profile-override:${npcId}`

export type NpcProfileOverride = {
  personality?: string  // comma-separated
  dislikeds?: string    // comma-separated
  speechStyle?: string
}

export function loadNpcProfileOverride(npcId: string): NpcProfileOverride | null {
  if (typeof localStorage === "undefined") return null
  const raw = localStorage.getItem(KEY(npcId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as NpcProfileOverride
  } catch {
    return null
  }
}

export function saveNpcProfileOverride(npcId: string, override: NpcProfileOverride): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(KEY(npcId), JSON.stringify(override))
}

export function clearNpcProfileOverride(npcId: string): void {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(KEY(npcId))
}
