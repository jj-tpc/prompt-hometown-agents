import { loadMap } from "@/game-core/map/loader"
import type { TileMap } from "@/game-core/types/map"

const STORAGE_KEY = "hometown:map-editor:draft"
const SAVED_MAPS_KEY = "hometown:map-editor:maps"

export type SavedMapSummary = {
  id: string
  name: string
  width: number
  height: number
  updatedAt: number
}

type SavedMapRecord = SavedMapSummary & {
  map: TileMap
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

function readSavedMapRecords(): SavedMapRecord[] {
  if (typeof window === "undefined") return []
  const saved = window.localStorage.getItem(SAVED_MAPS_KEY)
  if (!saved) return []

  try {
    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((record): SavedMapRecord | null => {
        if (typeof record !== "object" || record == null || !("map" in record)) return null
        const map = loadMap((record as { map: unknown }).map)
        return {
          id: map.meta.id,
          name: map.meta.name,
          width: map.width,
          height: map.height,
          updatedAt:
            typeof (record as { updatedAt?: unknown }).updatedAt === "number"
              ? (record as { updatedAt: number }).updatedAt
              : 0,
          map,
        }
      })
      .filter((record): record is SavedMapRecord => record != null)
  } catch {
    return []
  }
}

function writeSavedMapRecords(records: SavedMapRecord[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(SAVED_MAPS_KEY, JSON.stringify(records))
}

export function listSavedMaps(): SavedMapSummary[] {
  return readSavedMapRecords()
    .map(({ id, name, width, height, updatedAt }) => ({ id, name, width, height, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function loadSavedMap(mapId: string): TileMap | null {
  return readSavedMapRecords().find((record) => record.id === mapId)?.map ?? null
}

export function saveNamedMap(map: TileMap, now = Date.now()): SavedMapSummary {
  if (typeof window === "undefined") {
    return {
      id: map.meta.id,
      name: map.meta.name,
      width: map.width,
      height: map.height,
      updatedAt: now,
    }
  }

  const records = readSavedMapRecords()
  const nextRecord: SavedMapRecord = {
    id: map.meta.id,
    name: map.meta.name,
    width: map.width,
    height: map.height,
    updatedAt: now,
    map,
  }
  const nextRecords = [
    nextRecord,
    ...records.filter((record) => record.id !== map.meta.id),
  ]
  writeSavedMapRecords(nextRecords)
  return {
    id: nextRecord.id,
    name: nextRecord.name,
    width: nextRecord.width,
    height: nextRecord.height,
    updatedAt: nextRecord.updatedAt,
  }
}

export function deleteSavedMap(mapId: string): void {
  if (typeof window === "undefined") return
  writeSavedMapRecords(readSavedMapRecords().filter((record) => record.id !== mapId))
}
