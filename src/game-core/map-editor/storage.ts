import { loadMap } from "@/game-core/map/loader"
import type { TileMap } from "@/game-core/types/map"

const STORAGE_KEY = "hometown:map-editor:draft"

export type SavedMapSummary = {
  id: string
  name: string
  width: number
  height: number
  updatedAt: number
}

export function serializeTileMap(map: TileMap): string {
  return JSON.stringify(map, null, 2)
}

export function parseTileMapJson(json: string): TileMap {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error("Invalid TileMap JSON")
  }

  try {
    return loadMap(parsed)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid TileMap"
    throw new Error(message)
  }
}

export function loadMapEditorDraft(): TileMap | null {
  if (typeof window === "undefined") return null
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (!saved) return null
  try {
    return parseTileMapJson(saved)
  } catch {
    return null
  }
}

export function saveMapEditorDraft(map: TileMap): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, serializeTileMap(map))
}

export function clearMapEditorDraft(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
}

export async function listSavedMaps(): Promise<SavedMapSummary[]> {
  try {
    const res = await fetch("/api/maps")
    if (!res.ok) return []
    return (await res.json()) as SavedMapSummary[]
  } catch {
    return []
  }
}

export async function loadSavedMap(mapId: string): Promise<TileMap | null> {
  try {
    const res = await fetch(`/api/maps/${encodeURIComponent(mapId)}`)
    if (!res.ok) return null
    const data = await res.json()
    return loadMap(data)
  } catch {
    return null
  }
}

export async function saveNamedMap(map: TileMap): Promise<SavedMapSummary> {
  const res = await fetch("/api/maps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ map }),
  })
  if (!res.ok) throw new Error("Failed to save map")
  return (await res.json()) as SavedMapSummary
}

export async function deleteSavedMap(mapId: string): Promise<void> {
  await fetch(`/api/maps/${encodeURIComponent(mapId)}`, { method: "DELETE" })
}
