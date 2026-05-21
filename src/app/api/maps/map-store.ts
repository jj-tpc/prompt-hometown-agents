import fs from "fs"
import path from "path"
import { loadMap } from "@/game-core/map/loader"
import type { TileMap } from "@/game-core/types/map"
import type { SavedMapSummary } from "@/game-core/map-editor/storage"

const MAPS_DIR = path.join(process.cwd(), "data", "maps")

type MapRecord = SavedMapSummary & { map: TileMap }

function ensureDir(): void {
  if (!fs.existsSync(MAPS_DIR)) {
    fs.mkdirSync(MAPS_DIR, { recursive: true })
  }
}

function safeMapId(mapId: string): string {
  return mapId.replace(/[^a-zA-Z0-9_-]/g, "_")
}

function mapFilePath(mapId: string): string {
  return path.join(MAPS_DIR, `${safeMapId(mapId)}.json`)
}

export function serverListMaps(): SavedMapSummary[] {
  ensureDir()
  try {
    return fs
      .readdirSync(MAPS_DIR)
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => {
        try {
          const content = fs.readFileSync(path.join(MAPS_DIR, f), "utf-8")
          const record = JSON.parse(content) as MapRecord
          return [
            {
              id: record.id,
              name: record.name,
              width: record.width,
              height: record.height,
              updatedAt: record.updatedAt,
            },
          ]
        } catch {
          return []
        }
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

export function serverLoadMap(mapId: string): TileMap | null {
  try {
    const content = fs.readFileSync(mapFilePath(mapId), "utf-8")
    const record = JSON.parse(content) as MapRecord
    return loadMap(record.map)
  } catch {
    return null
  }
}

export function serverSaveMap(map: TileMap, now = Date.now()): SavedMapSummary {
  ensureDir()
  const record: MapRecord = {
    id: map.meta.id,
    name: map.meta.name,
    width: map.width,
    height: map.height,
    updatedAt: now,
    map,
  }
  fs.writeFileSync(mapFilePath(map.meta.id), JSON.stringify(record, null, 2), "utf-8")
  return { id: record.id, name: record.name, width: record.width, height: record.height, updatedAt: record.updatedAt }
}

export function serverDeleteMap(mapId: string): void {
  try {
    const filePath = mapFilePath(mapId)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
    // ignore missing files
  }
}
