const KEY = (npcId: string) => `hometown:npc-character-prompt:${npcId}`

export function loadNpcCharacterPrompt(npcId: string): string | null {
  if (typeof localStorage === "undefined") return null
  return localStorage.getItem(KEY(npcId))
}

export function saveNpcCharacterPrompt(npcId: string, prompt: string): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(KEY(npcId), prompt)
}

export function clearNpcCharacterPrompt(npcId: string): void {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(KEY(npcId))
}
