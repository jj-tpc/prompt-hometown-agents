export function resetGameData(): void {
  if (typeof localStorage === "undefined") return
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith("game:")) keysToRemove.push(k)
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k))
}
