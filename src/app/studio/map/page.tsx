"use client"

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { TILE_DEFINITIONS } from "@/game-core/map/tile-definitions"
import { WORLD_NPC_CHARACTER_PROMPTS } from "@/game-core/game-loop/world-dialogue"
import { isCellWalkable } from "@/game-core/map/traversal"
import { createBlankTileMap, createWaterBaseGrassTileMap } from "@/game-core/map-editor/create-map"
import {
  eraseTile,
  moveSpawn,
  paintTile,
  removeSpawn,
  setElevation,
  setSpriteOverride,
  upsertNpcSpawn,
} from "@/game-core/map-editor/editor-reducer"
import {
  loadMapEditorDraft,
  deleteSavedMap,
  listSavedMaps,
  loadSavedMap,
  parseTileMapJson,
  saveMapEditorDraft,
  saveNamedMap,
  serializeTileMap,
  type SavedMapSummary,
} from "@/game-core/map-editor/storage"
import { validateMapForEditing, type MapEditorIssue } from "@/game-core/map-editor/validation"
import { generateVillageTerrain } from "@/game-core/map/village-terrain"
import { entitiesFromSpawns } from "@/game-core/render/entities"
import { loadAtlasImage, type LoadedAtlasImage } from "@/game-core/render/atlas-image-loader"
import {
  ATLAS_IMAGES,
  ATLAS_IMAGE_GROUPS,
  atlasCategoryFor,
  atlasIdForCharacterSprite,
} from "@/game-core/render/terrain-tiles"
import { gridToScreen, renderTileMap } from "@/game-core/render/tilemap-renderer"
import { RENDER_SCALE, TILE_PX } from "@/game-core/render/types"
import type { Camera } from "@/game-core/render/types"
import type { LayerName, SpawnPoint, TileMap, TileType } from "@/game-core/types/map"
import type { CSSProperties, PointerEvent } from "react"

type Tool = "paint" | "erase" | "elevation" | "spawn" | "select" | "pan"
type OverlayKey = "grid" | "walkability" | "spawns" | "validation"
type EditorLayer = "ground" | "building" | "object" | "character"
type SpriteStamp = {
  atlasId: string
  sx: number
  sy: number
  sw: number
  sh: number
}
type TilesetOption = { id: string; label: string }

const EDITOR_LAYERS: EditorLayer[] = ["ground", "building", "object", "character"]
const BASE_MAP_PRESET_SIZES = [20, 40, 60, 100] as const
const TILE_TYPES = Object.keys(TILE_DEFINITIONS) as TileType[]
const EDITOR_TILESETS: Record<EditorLayer, string[]> = {
  ground: Object.keys(ATLAS_IMAGE_GROUPS.ground),
  building: Object.keys(ATLAS_IMAGE_GROUPS.building),
  object: Object.keys(ATLAS_IMAGE_GROUPS.object),
  character: Object.keys(ATLAS_IMAGE_GROUPS.character),
}
const CHARACTER_NPC_OPTIONS: TilesetOption[] = WORLD_NPC_CHARACTER_PROMPTS.flatMap((entry) => {
  if (!entry.spriteId) return []
  const atlasId = atlasIdForCharacterSprite(entry.spriteId)
  if (!atlasId) return []
  return [{ id: atlasId, label: `${entry.npcId} / ${entry.name}` }]
})

const TILESET_TILE_TYPE: Record<string, TileType> = {
  grass: "grass",
  water: "water",
  path: "path",
  dirt: "dirt",
  sand: "sand",
  hills: "grass",
  tilledDirt: "dirt",
  tilledDirtWide: "dirt",
  tilledDirtWideV2: "dirt",
  gravel: "path",
  townSand: "sand",
  sandPath: "path",
  snow: "grass",
  stone: "path",
  stoneFloor: "building_floor",
  stonePath: "path",
  woodFloor: "building_floor",
  buildingWall: "building_wall",
  doors: "door",
  woodenHouse: "building_wall",
  woodenHouseRoof: "roof",
  woodenHouseWalls: "building_wall",
  forge: "building_wall",
  marketStall: "building_wall",
  buildingProps: "sign",
  well: "sign",
  fence: "fence",
  chest: "chest",
  chickenHouse: "sign",
  eggItem: "chest",
  furniture: "sign",
  cottageSet: "sign",
  grassBiomeThings: "bush",
  toolsAndLoot: "chest",
  milkAndGrassItem: "chest",
  plants: "bush",
  toolsAndMaterials: "chest",
  woodBridge: "path",
  character: "player_spawn",
  characterActions: "player_spawn",
  blacksmith: "npc_spawn",
  chicken: "npc_spawn",
  cow: "npc_spawn",
  eggAndNest: "npc_spawn",
  guard: "npc_spawn",
  innkeeper: "npc_spawn",
  noble: "npc_spawn",
  sheep: "npc_spawn",
  streetVendor: "npc_spawn",
  characterTools: "npc_spawn",
  townsfolk: "npc_spawn",
  vegetableVendor: "npc_spawn",
  villager: "npc_spawn",
}

function defaultStampFor(atlasId: string): SpriteStamp {
  return {
    atlasId,
    sx: atlasId === "grass" ? TILE_PX : 0,
    sy: atlasId === "grass" ? TILE_PX : 0,
    sw: TILE_PX,
    sh: TILE_PX,
  }
}

function mapLayerForEditorLayer(layer: EditorLayer): LayerName {
  return layer === "ground" ? "ground" : "object"
}

function tilesetOptionsForEditorLayer(layer: EditorLayer): TilesetOption[] {
  if (layer === "character") return CHARACTER_NPC_OPTIONS
  return EDITOR_TILESETS[layer].map((id) => ({ id, label: id }))
}

function npcIdForCharacterAtlas(atlasId: string): string {
  return (
    WORLD_NPC_CHARACTER_PROMPTS.find(
      (entry) => entry.spriteId && atlasIdForCharacterSprite(entry.spriteId) === atlasId
    )?.npcId ?? "npc_1"
  )
}

function placeNpcSpawn(map: TileMap, npcId: string, x: number, y: number): TileMap {
  const spawnId = `spawn_${npcId}`
  const existingAtCell = map.spawnPoints.find(
    (spawn) => spawn.entityType === "npc" && spawn.x === x && spawn.y === y && spawn.id !== spawnId
  )
  const cleared = existingAtCell ? removeSpawn(map, existingAtCell.id) : map
  return upsertNpcSpawn(cleared, {
    id: spawnId,
    x,
    y,
    facing: "down",
    entityType: "npc",
    npcId,
  })
}

function removeNpcSpawnAt(map: TileMap, x: number, y: number): TileMap {
  const spawn = map.spawnPoints.find(
    (entry) => entry.entityType === "npc" && entry.x === x && entry.y === y
  )
  return spawn ? removeSpawn(map, spawn.id) : map
}

const VIEWPORT = { width: 22 * TILE_PX, height: 14 * TILE_PX }
const CANVAS_W = VIEWPORT.width * RENDER_SCALE
const CANVAS_H = VIEWPORT.height * RENDER_SCALE

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function clampCamera(camera: Camera, map: TileMap): Camera {
  return {
    x: clamp(camera.x, 0, Math.max(0, map.width * TILE_PX - VIEWPORT.width)),
    y: clamp(camera.y, 0, Math.max(0, map.height * TILE_PX - VIEWPORT.height)),
  }
}

function layerTileAt(map: TileMap, layerName: LayerName, x: number, y: number): TileType | null {
  return map.layers.find((layer) => layer.name === layerName)?.tiles[y]?.[x] ?? null
}

function spriteOverrideBaseAt(
  map: TileMap,
  layerName: LayerName,
  x: number,
  y: number
): TileType | null | undefined {
  return map.spriteOverrides?.find(
    (override) => override.layer === layerName && override.x === x && override.y === y
  )?.baseTile
}

function baseTileForGroundStamp(map: TileMap, x: number, y: number): TileType {
  const previousBase = spriteOverrideBaseAt(map, "ground", x, y)
  const currentTile = layerTileAt(map, "ground", x, y)
  const base = previousBase ?? currentTile
  return base === "water" || base === "shallow_water" ? base : "grass"
}

function tileTypeForGroundStamp(selectedTile: TileType, baseTile: TileType): TileType {
  if (selectedTile === "water" || selectedTile === "shallow_water" || selectedTile === "grass") {
    return selectedTile
  }
  return baseTile
}

function inBounds(map: TileMap, x: number, y: number): boolean {
  return x >= 0 && x < map.width && y >= 0 && y < map.height
}

function issueKey(issue: MapEditorIssue, index: number): string {
  return `${issue.level}:${issue.x ?? "-"}:${issue.y ?? "-"}:${issue.layer ?? "-"}:${index}`
}

function issueCells(issues: MapEditorIssue[]): Array<{ x: number; y: number; level: "error" | "warning" }> {
  return issues
    .filter((issue): issue is MapEditorIssue & { x: number; y: number } =>
      Number.isInteger(issue.x) && Number.isInteger(issue.y)
    )
    .map((issue) => ({ x: issue.x, y: issue.y, level: issue.level }))
}

function firstPlayerSpawn(map: TileMap): SpawnPoint | undefined {
  return map.spawnPoints.find((spawn) => spawn.entityType === "player")
}

export default function MapEditorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<Record<string, LoadedAtlasImage> | null>(null)
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null)
  const lastEditKeyRef = useRef<string | null>(null)
  const isPanningRef = useRef(false)

  const seedMap = useMemo(() => generateVillageTerrain(), [])
  const [map, setMap] = useState<TileMap>(seedMap)
  const [savedMap, setSavedMap] = useState<TileMap>(seedMap)
  const [dirty, setDirty] = useState(false)
  const [atlasImages, setAtlasImages] = useState<Record<string, LoadedAtlasImage> | null>(null)
  const [assetsReady, setAssetsReady] = useState(false)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [savedMaps, setSavedMaps] = useState<SavedMapSummary[]>([])
  const [selectedSavedMapId, setSelectedSavedMapId] = useState("")
  const [selectedEditorLayer, setSelectedEditorLayer] = useState<EditorLayer>("ground")
  const [selectedTile, setSelectedTile] = useState<TileType>("grass")
  const [selectedAtlasId, setSelectedAtlasId] = useState("grass")
  const [selectedStamp, setSelectedStamp] = useState<SpriteStamp>(() => defaultStampFor("grass"))
  const [tool, setTool] = useState<Tool>("paint")
  const [elevationValue, setElevationValue] = useState(0)
  const [selectedSpawnId, setSelectedSpawnId] = useState("player_start")
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>(null)
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(2)
  const [isDragging, setIsDragging] = useState(false)
  const [importText, setImportText] = useState("")
  const [importError, setImportError] = useState<string | null>(null)
  const [exportText, setExportText] = useState("")
  const [overlays, setOverlays] = useState<Record<OverlayKey, boolean>>({
    grid: true,
    walkability: false,
    spawns: false,
    validation: true,
  })

  const refreshSavedMaps = useCallback(() => {
    const maps = listSavedMaps()
    setSavedMaps(maps)
    setSelectedSavedMapId((current) =>
      current && maps.some((entry) => entry.id === current) ? current : maps[0]?.id ?? ""
    )
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      refreshSavedMaps()
    })
    const saved = loadMapEditorDraft()
    if (!saved) return
    queueMicrotask(() => {
      setMap(saved)
      setSavedMap(saved)
      setDirty(false)
      setCamera((current) => clampCamera(current, saved))
      const player = firstPlayerSpawn(saved)
      if (player) setSelectedSpawnId(player.id)
    })
  }, [refreshSavedMaps])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const images: Record<string, LoadedAtlasImage> = {}
      const failures: string[] = []
      let loadedCount = 0

      await Promise.all(
        Object.entries(ATLAS_IMAGES).map(async ([id, src]) => {
          try {
            const image = await loadAtlasImage(src, {
              transparentBlack: atlasCategoryFor(id) !== "character",
            })
            if (cancelled) return
            images[id] = image
            loadedCount += 1
            imagesRef.current = { ...images }
            setAtlasImages({ ...images })
            setAssetsReady(true)
          } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error))
          }
        })
      )

      if (!cancelled) {
        if (loadedCount === 0) {
          imagesRef.current = {}
          setAtlasImages({})
        }
        setAssetError(failures.length > 0 ? failures.join(", ") : null)
        setAssetsReady(loadedCount > 0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const deferredMap = useDeferredValue(map)
  const issues = useMemo(() => validateMapForEditing(deferredMap), [deferredMap])
  const visibleEntities = useMemo(
    () =>
      entitiesFromSpawns({
        ...map,
        spawnPoints: map.spawnPoints.filter((spawn) => inBounds(map, spawn.x, spawn.y)),
      }),
    [map]
  )

  const cellFromPointer = useCallback(
    (event: PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
      const rect = event.currentTarget.getBoundingClientRect()
      const viewportX = (event.clientX - rect.left) / zoom
      const viewportY = (event.clientY - rect.top) / zoom
      const x = Math.floor((camera.x + viewportX) / TILE_PX)
      const y = Math.floor((camera.y + viewportY) / TILE_PX)
      if (!inBounds(map, x, y)) return null
      return { x, y }
    },
    [camera, map, zoom]
  )

  const applyEdit = useCallback(
    (cell: { x: number; y: number }, erase = false) => {
      const editKey = `${tool}:${selectedEditorLayer}:${cell.x}:${cell.y}:${erase ? "erase" : selectedTile}:${selectedStamp.atlasId}:${selectedStamp.sx}:${selectedStamp.sy}:${elevationValue}:${selectedSpawnId}`
      if (lastEditKeyRef.current === editKey) return
      lastEditKeyRef.current = editKey

      setSelectedCell(cell)
      setMap((current) => {
        const targetLayer = mapLayerForEditorLayer(selectedEditorLayer)
        if (!inBounds(current, cell.x, cell.y)) return current
        if (selectedEditorLayer === "character") {
          if (erase || tool === "erase") return removeNpcSpawnAt(current, cell.x, cell.y)
          if (tool === "paint") {
            const npcId = npcIdForCharacterAtlas(selectedAtlasId)
            return placeNpcSpawn(current, npcId, cell.x, cell.y)
          }
          if (tool === "spawn") {
            const spawn = current.spawnPoints.find((entry) => entry.id === selectedSpawnId)
            if (spawn) return moveSpawn(current, spawn.id, cell.x, cell.y)
          }
          return current
        }
        if (erase || tool === "erase") return eraseTile(current, targetLayer, cell.x, cell.y)
        if (tool === "paint") {
          const baseTile =
            targetLayer === "ground"
              ? baseTileForGroundStamp(current, cell.x, cell.y)
              : layerTileAt(current, targetLayer, cell.x, cell.y)
          const paintTileType =
            targetLayer === "ground" && baseTile
              ? tileTypeForGroundStamp(selectedTile, baseTile)
              : selectedTile
          const painted = paintTile(current, targetLayer, cell.x, cell.y, paintTileType)
          return setSpriteOverride(painted, {
            layer: targetLayer,
            x: cell.x,
            y: cell.y,
            baseTile,
            ...selectedStamp,
          })
        }
        if (tool === "elevation") return setElevation(current, cell.x, cell.y, elevationValue)
        if (tool === "spawn") {
          const spawn = current.spawnPoints.find((entry) => entry.id === selectedSpawnId)
          if (spawn) return moveSpawn(current, spawn.id, cell.x, cell.y)
          return current
        }
        return current
      })
      setDirty(true)
      if (selectedEditorLayer === "character" && tool === "paint") {
        setSelectedSpawnId(`spawn_${npcIdForCharacterAtlas(selectedAtlasId)}`)
      }
    },
    [
      elevationValue,
      selectedAtlasId,
      selectedEditorLayer,
      selectedSpawnId,
      selectedStamp,
      selectedTile,
      tool,
    ]
  )

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const images = imagesRef.current
    if (!canvas || !images) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    renderTileMap(ctx, { map, camera, entities: visibleEntities }, { images })

    ctx.save()
    ctx.lineWidth = 1

    if (overlays.walkability) {
      for (let y = Math.floor(camera.y / TILE_PX); y <= Math.ceil((camera.y + VIEWPORT.height) / TILE_PX); y += 1) {
        for (let x = Math.floor(camera.x / TILE_PX); x <= Math.ceil((camera.x + VIEWPORT.width) / TILE_PX); x += 1) {
          if (!inBounds(map, x, y) || isCellWalkable(map, x, y)) continue
          const screen = gridToScreen(x, y, map.elevation[y]?.[x] ?? 0, camera)
          ctx.fillStyle = "rgba(196, 55, 55, 0.32)"
          ctx.fillRect(
            screen.x * RENDER_SCALE,
            screen.y * RENDER_SCALE,
            TILE_PX * RENDER_SCALE,
            TILE_PX * RENDER_SCALE
          )
        }
      }
    }

    if (overlays.validation) {
      for (const issue of issueCells(issues)) {
        if (!inBounds(map, issue.x, issue.y)) continue
        const screen = gridToScreen(issue.x, issue.y, map.elevation[issue.y]?.[issue.x] ?? 0, camera)
        ctx.strokeStyle = issue.level === "error" ? "#ff5a5a" : "#f5c84b"
        ctx.lineWidth = 2
        ctx.strokeRect(
          screen.x * RENDER_SCALE + 2,
          screen.y * RENDER_SCALE + 2,
          TILE_PX * RENDER_SCALE - 4,
          TILE_PX * RENDER_SCALE - 4
        )
      }
    }

    if (overlays.grid) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)"
      ctx.lineWidth = 1
      for (let x = -((camera.x % TILE_PX) * RENDER_SCALE); x < CANVAS_W; x += TILE_PX * RENDER_SCALE) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, CANVAS_H)
        ctx.stroke()
      }
      for (let y = -((camera.y % TILE_PX) * RENDER_SCALE); y < CANVAS_H; y += TILE_PX * RENDER_SCALE) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(CANVAS_W, y)
        ctx.stroke()
      }
    }

    if (overlays.spawns) {
      for (const spawn of map.spawnPoints) {
        if (!inBounds(map, spawn.x, spawn.y)) continue
        const screen = gridToScreen(spawn.x, spawn.y, map.elevation[spawn.y]?.[spawn.x] ?? 0, camera)
        const cx = screen.x * RENDER_SCALE + (TILE_PX * RENDER_SCALE) / 2
        const cy = screen.y * RENDER_SCALE + (TILE_PX * RENDER_SCALE) / 2
        ctx.fillStyle = spawn.entityType === "player" ? "#79f2a5" : "#7cb7ff"
        ctx.strokeStyle = "#11131a"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(cx, cy, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }

    const outlined = hoveredCell ?? selectedCell
    if (outlined) {
      const screen = gridToScreen(outlined.x, outlined.y, map.elevation[outlined.y]?.[outlined.x] ?? 0, camera)
      ctx.strokeStyle = "#fff2a8"
      ctx.lineWidth = 3
      ctx.strokeRect(
        screen.x * RENDER_SCALE + 2,
        screen.y * RENDER_SCALE + 2,
        TILE_PX * RENDER_SCALE - 4,
        TILE_PX * RENDER_SCALE - 4
      )
    }

    ctx.restore()
  }, [camera, hoveredCell, issues, map, overlays, selectedCell, visibleEntities])

  useEffect(() => {
    if (assetsReady) render()
  }, [assetsReady, render])

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    lastEditKeyRef.current = null
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
    lastPointerRef.current = { x: event.clientX, y: event.clientY }
    isPanningRef.current = event.button === 2 || tool === "pan"
    const cell = cellFromPointer(event)
    if (cell) setHoveredCell(cell)
    if (isPanningRef.current) return
    if (cell && tool !== "select") applyEdit(cell)
    if (cell && tool === "select") setSelectedCell(cell)
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const cell = cellFromPointer(event)
    setHoveredCell((current) =>
      current?.x === cell?.x && current?.y === cell?.y ? current : cell
    )

    if (!isDragging) return
    const secondaryButtonDown = (event.buttons & 2) === 2
    if (isPanningRef.current || secondaryButtonDown || tool === "pan") {
      const last = lastPointerRef.current
      if (last) {
        setCamera((current) =>
          clampCamera(
            {
              x: current.x - (event.clientX - last.x) / zoom,
              y: current.y - (event.clientY - last.y) / zoom,
            },
            map
          )
        )
      }
      isPanningRef.current = true
      lastPointerRef.current = { x: event.clientX, y: event.clientY }
      return
    }
    if (cell && tool !== "select") applyEdit(cell)
  }

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(false)
    isPanningRef.current = false
    lastEditKeyRef.current = null
    lastPointerRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const saveDraft = () => {
    saveMapEditorDraft(map)
    setSavedMap(map)
    setDirty(false)
  }

  const saveCurrentNamedMap = () => {
    const saved = saveNamedMap(map)
    refreshSavedMaps()
    setSelectedSavedMapId(saved.id)
    setDirty(false)
  }

  const loadSelectedNamedMap = () => {
    if (!selectedSavedMapId) return
    const loaded = loadSavedMap(selectedSavedMapId)
    if (!loaded) {
      refreshSavedMaps()
      return
    }
    setMap(loaded)
    setSavedMap(loaded)
    setDirty(false)
    setImportError(null)
    const player = firstPlayerSpawn(loaded)
    if (player) setSelectedSpawnId(player.id)
  }

  const duplicateSelectedNamedMap = () => {
    const source = selectedSavedMapId ? loadSavedMap(selectedSavedMapId) : map
    if (!source) return
    const copy: TileMap = {
      ...source,
      meta: {
        ...source.meta,
        id: `${source.meta.id}_copy_${Date.now().toString(36)}`,
        name: `${source.meta.name} Copy`,
      },
    }
    setMap(copy)
    setSavedMap(copy)
    setDirty(false)
    const saved = saveNamedMap(copy)
    refreshSavedMaps()
    setSelectedSavedMapId(saved.id)
  }

  const deleteSelectedNamedMap = () => {
    if (!selectedSavedMapId) return
    deleteSavedMap(selectedSavedMapId)
    refreshSavedMaps()
  }

  const resetToVillage = () => {
    const next = generateVillageTerrain()
    setMap(next)
    setDirty(true)
    setCamera({ x: 0, y: 0 })
    const player = firstPlayerSpawn(next)
    if (player) setSelectedSpawnId(player.id)
  }

  const createBlank = () => {
    const next = createBlankTileMap({ id: "map_draft", name: "Map Draft", width: 40, height: 28 })
    setMap(next)
    setDirty(true)
    setCamera({ x: 0, y: 0 })
    setSelectedSpawnId("player_start")
  }

  const createBasePreset = (size: number) => {
    const next = createWaterBaseGrassTileMap({
      id: `map_${size}x${size}_water_grass`,
      name: `Water + Grass ${size}x${size}`,
      size,
    })
    setMap(next)
    setDirty(true)
    setCamera({ x: 0, y: 0 })
    setSelectedCell(null)
    setHoveredCell(null)
    setSelectedSpawnId("player_start")
    selectEditorLayer("ground")
  }

  const importMap = () => {
    try {
      const next = parseTileMapJson(importText)
      setMap(next)
      setDirty(true)
      setImportError(null)
      const player = firstPlayerSpawn(next)
      if (player) setSelectedSpawnId(player.id)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Invalid TileMap JSON")
    }
  }

  const addNpcSpawn = () => {
    const npcId =
      selectedEditorLayer === "character" ? npcIdForCharacterAtlas(selectedAtlasId) : "npc_1"
    const x = selectedCell?.x ?? Math.floor(map.width / 2)
    const y = selectedCell?.y ?? Math.floor(map.height / 2)
    const id = `spawn_${npcId}`
    setMap((current) => placeNpcSpawn(current, npcId, x, y))
    setDirty(true)
    setSelectedSpawnId(id)
    setTool("spawn")
  }

  const selectTileset = (atlasId: string) => {
    setSelectedAtlasId(atlasId)
    setSelectedTile(TILESET_TILE_TYPE[atlasId] ?? "grass")
    setSelectedStamp(defaultStampFor(atlasId))
    setTool("paint")
  }

  const selectEditorLayer = (layer: EditorLayer) => {
    setSelectedEditorLayer(layer)
    const atlasId = tilesetOptionsForEditorLayer(layer)[0]?.id
    if (atlasId) selectTileset(atlasId)
  }

  const selectStamp = useCallback((stamp: SpriteStamp) => {
    setSelectedStamp(stamp)
    setSelectedTile(TILESET_TILE_TYPE[stamp.atlasId] ?? "grass")
    setTool("paint")
  }, [])

  const selectedSpawn = map.spawnPoints.find((spawn) => spawn.id === selectedSpawnId)
  const selectedTilesetOptions = useMemo(
    () => tilesetOptionsForEditorLayer(selectedEditorLayer),
    [selectedEditorLayer]
  )
  const selectedTilesetLabel =
    selectedTilesetOptions.find((option) => option.id === selectedAtlasId)?.label ?? selectedAtlasId
  const selectedCharacterNpcId =
    selectedEditorLayer === "character" ? npcIdForCharacterAtlas(selectedAtlasId) : null
  const selectedTileInfo = selectedCell
    ? {
        ground: layerTileAt(map, "ground", selectedCell.x, selectedCell.y),
        decoration: layerTileAt(map, "decoration", selectedCell.x, selectedCell.y),
        object: layerTileAt(map, "object", selectedCell.x, selectedCell.y),
        overlay: layerTileAt(map, "overlay", selectedCell.x, selectedCell.y),
        elevation: map.elevation[selectedCell.y]?.[selectedCell.x] ?? 0,
      }
    : null

  return (
    <main style={styles.root}>
      <aside style={styles.toolRail}>
        <div style={styles.brandBlock}>
          <a href="/studio" style={styles.backLink}>Studio</a>
          <h1 style={styles.title}>Map Editor</h1>
          <p style={styles.subtitle}>{map.meta.name} · {map.width}x{map.height}</p>
        </div>

        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Layer</h2>
          <div style={styles.segmentGrid}>
            {EDITOR_LAYERS.map((layer) => (
              <button
                key={layer}
                type="button"
                onClick={() => selectEditorLayer(layer)}
                style={{
                  ...styles.segmentButton,
                  ...(selectedEditorLayer === layer ? styles.segmentButtonActive : {}),
                }}
              >
                {layer}
              </button>
            ))}
          </div>
        </section>

        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Tool</h2>
          <div style={styles.toolGrid}>
            {(["paint", "erase", "elevation", "spawn", "select", "pan"] as Tool[]).map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setTool(entry)}
                style={{
                  ...styles.toolButton,
                  ...(tool === entry ? styles.toolButtonActive : {}),
                }}
              >
                {entry}
              </button>
            ))}
          </div>
        </section>

        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Tileset</h2>
          <label style={styles.fieldLabel}>
            Source
            <select
              value={selectedAtlasId}
              onChange={(event) => selectTileset(event.target.value)}
              style={styles.select}
            >
              {selectedTilesetOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          {selectedEditorLayer !== "character" && (
            <label style={styles.fieldLabel}>
              Cell type
              <select
                value={selectedTile}
                onChange={(event) => setSelectedTile(event.target.value as TileType)}
                style={styles.select}
              >
                {TILE_TYPES.map((tile) => (
                  <option key={tile} value={tile}>{tile}</option>
                ))}
              </select>
            </label>
          )}

          <div style={styles.selectedStampRow}>
            {selectedEditorLayer === "character" ? (
              <SpriteSheetPreview image={atlasImages?.[selectedAtlasId] ?? null} size={32} />
            ) : (
              <SpriteCellPreview
                stamp={selectedStamp}
                image={atlasImages?.[selectedStamp.atlasId] ?? null}
                size={32}
              />
            )}
            <span>
              {selectedEditorLayer === "character" && selectedCharacterNpcId
                ? selectedTilesetLabel
                : `${selectedStamp.atlasId}.png (${selectedStamp.sx}, ${selectedStamp.sy})`}
            </span>
          </div>

          <TilesetSheetPicker
            atlasId={selectedAtlasId}
            image={atlasImages?.[selectedAtlasId] ?? null}
            selectedStamp={selectedStamp}
            onSelect={selectStamp}
            readOnly={selectedEditorLayer === "character"}
          />
        </section>

        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Elevation</h2>
          <input
            type="range"
            min={0}
            max={3}
            value={elevationValue}
            onChange={(event) => setElevationValue(Number(event.target.value))}
            style={styles.range}
          />
          <div style={styles.valueRow}>
            <span>Level</span>
            <strong>{elevationValue}</strong>
          </div>
        </section>

        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Overlays</h2>
          {(Object.keys(overlays) as OverlayKey[]).map((key) => (
            <label key={key} style={styles.checkRow}>
              <input
                type="checkbox"
                checked={overlays[key]}
                onChange={(event) =>
                  setOverlays((current) => ({ ...current, [key]: event.target.checked }))
                }
              />
              {key}
            </label>
          ))}
        </section>
      </aside>

      <section style={styles.canvasColumn}>
        <div style={styles.topBar}>
          <div style={styles.statusGroup}>
            <span style={dirty ? styles.dirtyBadge : styles.savedBadge}>
              {dirty ? "Unsaved" : "Saved"}
            </span>
            <span style={styles.metaText}>
              {hoveredCell ? `x ${hoveredCell.x}, y ${hoveredCell.y}` : "No cell hovered"}
            </span>
          </div>
          <div style={styles.commandRow}>
            <button type="button" onClick={() => setZoom((value) => clamp(value - 0.25, 1, 3))} style={styles.commandButton}>-</button>
            <span style={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((value) => clamp(value + 0.25, 1, 3))} style={styles.commandButton}>+</button>
            <button
              type="button"
              onClick={() => {
                setMap(savedMap)
                setDirty(false)
              }}
              disabled={!dirty}
              style={styles.commandButton}
            >
              Revert
            </button>
            <button type="button" onClick={saveDraft} disabled={!dirty} style={styles.primaryButton}>Save Draft</button>
            <a href="/dev/world?draftMap=1" style={styles.playLink}>Play Draft</a>
          </div>
        </div>

        <div style={styles.canvasWrap}>
          {!assetsReady && <div style={styles.loading}>Loading sprite atlases...</div>}
          {assetError && <div style={styles.assetError}>{assetError}</div>}
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              ...styles.canvas,
              width: VIEWPORT.width * zoom,
              height: VIEWPORT.height * zoom,
              cursor: tool === "pan" ? "grab" : "crosshair",
            }}
          />
        </div>
      </section>

      <aside style={styles.inspector}>
        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Map</h2>
          <label style={styles.fieldLabel}>
            Name
            <input
              value={map.meta.name}
              onChange={(event) => {
                setDirty(true)
                setMap((current) => ({
                  ...current,
                  meta: { ...current.meta, name: event.target.value },
                }))
              }}
              style={styles.input}
            />
          </label>
          <label style={styles.fieldLabel}>
            Id
            <input
              value={map.meta.id}
              onChange={(event) => {
                setDirty(true)
                setMap((current) => ({
                  ...current,
                  meta: { ...current.meta, id: event.target.value },
                }))
              }}
              style={styles.input}
            />
          </label>
          <div style={styles.commandGrid}>
            <button type="button" onClick={createBlank} style={styles.commandButton}>Blank</button>
            <button type="button" onClick={resetToVillage} style={styles.commandButton}>Village Seed</button>
          </div>
          <div style={styles.presetBlock}>
            <div style={styles.presetLabel}>Water Base + Grass Field</div>
            <div style={styles.presetGrid}>
              {BASE_MAP_PRESET_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => createBasePreset(size)}
                  style={styles.commandButton}
                >
                  {size}x{size}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>Saved Maps</h2>
            <button type="button" onClick={saveCurrentNamedMap} style={styles.smallButton}>Save Named</button>
          </div>
          {savedMaps.length > 0 ? (
            <>
              <select
                value={selectedSavedMapId}
                onChange={(event) => setSelectedSavedMapId(event.target.value)}
                style={styles.select}
              >
                {savedMaps.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} ({entry.width}x{entry.height})
                  </option>
                ))}
              </select>
              <div style={styles.commandGrid}>
                <button type="button" onClick={loadSelectedNamedMap} style={styles.commandButton}>Load</button>
                <button type="button" onClick={duplicateSelectedNamedMap} style={styles.commandButton}>Duplicate</button>
                <button type="button" onClick={deleteSelectedNamedMap} style={styles.dangerButton}>Delete</button>
                <a
                  href={`/dev/world?mapId=${encodeURIComponent(selectedSavedMapId)}`}
                  style={styles.playLink}
                >
                  Play Map
                </a>
              </div>
            </>
          ) : (
            <>
              <p style={styles.muted}>No named maps yet.</p>
              <button type="button" onClick={saveCurrentNamedMap} style={styles.commandButton}>
                Save Current Map
              </button>
            </>
          )}
        </section>

        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Cell</h2>
          {selectedCell && selectedTileInfo ? (
            <div style={styles.cellInfo}>
              <div>x {selectedCell.x}, y {selectedCell.y}</div>
              <div>ground: {selectedTileInfo.ground ?? "none"}</div>
              <div>decor: {selectedTileInfo.decoration ?? "none"}</div>
              <div>object: {selectedTileInfo.object ?? "none"}</div>
              <div>overlay: {selectedTileInfo.overlay ?? "none"}</div>
              <div>elevation: {selectedTileInfo.elevation}</div>
            </div>
          ) : (
            <p style={styles.muted}>Select a cell on the canvas.</p>
          )}
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>Spawns</h2>
            <button type="button" onClick={addNpcSpawn} style={styles.smallButton}>Add NPC</button>
          </div>
          <select
            value={selectedSpawnId}
            onChange={(event) => {
              setSelectedSpawnId(event.target.value)
              setTool("spawn")
            }}
            style={styles.select}
          >
            {map.spawnPoints.map((spawn) => (
              <option key={spawn.id} value={spawn.id}>{spawn.id}</option>
            ))}
          </select>
          {selectedSpawn ? (
            <div style={styles.cellInfo}>
              <div>{selectedSpawn.entityType} · {selectedSpawn.facing}</div>
              <div>x {selectedSpawn.x}, y {selectedSpawn.y}</div>
              {selectedSpawn.entityType === "npc" && <div>npcId: {selectedSpawn.npcId}</div>}
              {selectedSpawn.entityType === "npc" && (
                <button
                  type="button"
                  onClick={() => {
                    setMap((current) => removeSpawn(current, selectedSpawn.id))
                    setDirty(true)
                    setSelectedSpawnId("player_start")
                  }}
                  style={styles.dangerButton}
                >
                  Remove NPC
                </button>
              )}
            </div>
          ) : (
            <p style={styles.muted}>No spawn selected.</p>
          )}
        </section>

        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Validation</h2>
          {issues.length === 0 ? (
            <p style={styles.goodText}>No issues.</p>
          ) : (
            <div style={styles.issueList}>
              {issues.slice(0, 8).map((issue, index) => (
                <button
                  type="button"
                  key={issueKey(issue, index)}
                  onClick={() => {
                    if (issue.x != null && issue.y != null) setSelectedCell({ x: issue.x, y: issue.y })
                  }}
                  style={{
                    ...styles.issueItem,
                    ...(issue.level === "error" ? styles.issueError : styles.issueWarning),
                  }}
                >
                  {issue.message}
                </button>
              ))}
            </div>
          )}
        </section>

        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Import / Export</h2>
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder="Paste TileMap JSON"
            spellCheck={false}
            style={styles.textarea}
          />
          {importError && <p style={styles.errorText}>{importError}</p>}
          <button type="button" onClick={importMap} style={styles.commandButton}>Import JSON</button>
          <button
            type="button"
            onClick={() => setExportText(serializeTileMap(map))}
            style={styles.commandButton}
          >
            Generate Export
          </button>
          <textarea
            readOnly
            value={exportText}
            placeholder="Generate export when you need a JSON copy."
            spellCheck={false}
            style={styles.exportBox}
          />
        </section>
      </aside>
    </main>
  )
}

const TilesetSheetPicker = memo(function TilesetSheetPicker({
  atlasId,
  image,
  selectedStamp,
  onSelect,
  readOnly = false,
}: {
  atlasId: string
  image: LoadedAtlasImage | null
  selectedStamp: SpriteStamp
  onSelect: (stamp: SpriteStamp) => void
  readOnly?: boolean
}) {
  if (!image) return <div style={styles.sheetPlaceholder}>Loading {atlasId}.png</div>

  const cols = Math.floor(image.width / TILE_PX)
  const rows = Math.floor(image.height / TILE_PX)
  const cells = Array.from({ length: cols * rows }, (_, index) => ({
    sx: (index % cols) * TILE_PX,
    sy: Math.floor(index / cols) * TILE_PX,
  }))

  return (
    <div style={styles.sheetGrid}>
      {cells.map((cell) => {
        const stamp: SpriteStamp = {
          atlasId,
          sx: cell.sx,
          sy: cell.sy,
          sw: TILE_PX,
          sh: TILE_PX,
        }
        const selected =
          selectedStamp.atlasId === atlasId &&
          selectedStamp.sx === cell.sx &&
          selectedStamp.sy === cell.sy
        const cellPreview = <SpriteCellPreview stamp={stamp} image={image} size={32} />

        return readOnly ? (
          <div
            key={`${cell.sx}:${cell.sy}`}
            title={`${atlasId}.png ${cell.sx},${cell.sy}`}
            style={{ ...styles.sheetCell, cursor: "default" }}
          >
            {cellPreview}
          </div>
        ) : (
          <button
            key={`${cell.sx}:${cell.sy}`}
            type="button"
            title={`${atlasId}.png ${cell.sx},${cell.sy}`}
            aria-label={`Select ${atlasId} tile ${cell.sx}, ${cell.sy}`}
            onClick={() => onSelect(stamp)}
            style={{
              ...styles.sheetCell,
              ...(selected ? styles.sheetCellActive : {}),
            }}
          >
            {cellPreview}
          </button>
        )
      })}
    </div>
  )
})

const SpriteSheetPreview = memo(function SpriteSheetPreview({
  image,
  size,
}: {
  image: LoadedAtlasImage | null
  size: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false
    const scale = Math.min(size / image.width, size / image.height)
    const width = Math.max(1, Math.floor(image.width * scale))
    const height = Math.max(1, Math.floor(image.height * scale))
    const x = Math.floor((size - width) / 2)
    const y = Math.floor((size - height) / 2)
    ctx.drawImage(image, 0, 0, image.width, image.height, x, y, width, height)
  }, [image, size])

  if (!image) return <span aria-hidden="true" style={styles.spriteFallback} />

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ ...styles.spritePreviewCanvas, height: size, width: size }}
      aria-hidden="true"
    />
  )
})

const SpriteCellPreview = memo(function SpriteCellPreview({
  stamp,
  image,
  size,
}: {
  stamp: SpriteStamp
  image: LoadedAtlasImage | null
  size: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, stamp.sx, stamp.sy, stamp.sw, stamp.sh, 0, 0, size, size)
  }, [image, size, stamp.sh, stamp.sw, stamp.sx, stamp.sy])

  if (!image) return <span aria-hidden="true" style={styles.spriteFallback} />

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ ...styles.spritePreviewCanvas, height: size, width: size }}
      aria-hidden="true"
    />
  )
})

const styles: Record<string, CSSProperties> = {
  root: {
    display: "grid",
    gridTemplateColumns: "260px minmax(520px, 1fr) 320px",
    height: "100vh",
    minWidth: 0,
    background: "#10131a",
    color: "#e9edf4",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    overflow: "hidden",
  },
  toolRail: {
    borderRight: "1px solid #272d39",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
    overflowY: "auto",
    padding: 16,
  },
  inspector: {
    borderLeft: "1px solid #272d39",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
    overflowY: "auto",
    padding: 16,
  },
  canvasColumn: {
    display: "grid",
    gridTemplateRows: "56px 1fr",
    minWidth: 0,
    overflow: "hidden",
  },
  topBar: {
    alignItems: "center",
    borderBottom: "1px solid #272d39",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "0 16px",
  },
  canvasWrap: {
    alignItems: "center",
    background: "#181c25",
    display: "flex",
    justifyContent: "center",
    overflow: "auto",
    position: "relative",
  },
  canvas: {
    background: "#080a0e",
    border: "1px solid #303746",
    display: "block",
    imageRendering: "pixelated",
    touchAction: "none",
  },
  loading: {
    background: "rgba(10, 12, 16, 0.88)",
    border: "1px solid #343b49",
    color: "#b8c0cf",
    fontSize: 13,
    padding: "10px 12px",
    position: "absolute",
    top: 16,
    zIndex: 1,
  },
  assetError: {
    background: "rgba(54, 28, 32, 0.94)",
    border: "1px solid #8f4651",
    color: "#ffc6cc",
    fontSize: 12,
    maxWidth: 520,
    padding: "10px 12px",
    position: "absolute",
    top: 16,
    zIndex: 1,
  },
  brandBlock: { display: "grid", gap: 4 },
  backLink: { color: "#9fb4d8", fontSize: 12, fontWeight: 700, textDecoration: "none" },
  title: { fontSize: 22, lineHeight: 1.1, margin: 0 },
  subtitle: { color: "#99a3b4", fontSize: 12, margin: 0 },
  panel: {
    background: "#171b24",
    border: "1px solid #2a3140",
    borderRadius: 8,
    display: "grid",
    gap: 10,
    padding: 12,
  },
  panelHeader: { alignItems: "center", display: "flex", justifyContent: "space-between", gap: 8 },
  panelTitle: { color: "#cbd4e4", fontSize: 12, letterSpacing: 0.4, margin: 0, textTransform: "uppercase" },
  segmentGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  segmentButton: {
    background: "#11151d",
    border: "1px solid #313847",
    borderRadius: 5,
    color: "#aeb8c8",
    cursor: "pointer",
    fontSize: 12,
    padding: "8px 6px",
  },
  segmentButtonActive: { background: "#26344d", border: "1px solid #6f91cc", color: "#f4f8ff" },
  toolGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 },
  toolButton: {
    background: "#11151d",
    border: "1px solid #313847",
    borderRadius: 5,
    color: "#aeb8c8",
    cursor: "pointer",
    fontSize: 12,
    padding: "8px 4px",
  },
  toolButtonActive: { background: "#344123", border: "1px solid #8bb25f", color: "#f3ffe7" },
  select: {
    background: "#0d1118",
    border: "1px solid #313847",
    borderRadius: 5,
    color: "#e9edf4",
    minWidth: 0,
    padding: "8px 9px",
    width: "100%",
  },
  tilesetList: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  tilesetButton: {
    background: "#11151d",
    border: "1px solid #313847",
    borderRadius: 5,
    color: "#aeb8c8",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    padding: "8px 6px",
    textAlign: "left",
    textTransform: "capitalize",
  },
  tilesetButtonActive: { background: "#344123", border: "1px solid #8bb25f", color: "#f3ffe7" },
  selectedStampRow: {
    alignItems: "center",
    background: "#0d1118",
    border: "1px solid #313847",
    borderRadius: 5,
    color: "#cbd4e4",
    display: "flex",
    fontSize: 11,
    gap: 8,
    minWidth: 0,
    padding: 8,
  },
  sheetGrid: {
    background: "#0d1118",
    border: "1px solid #313847",
    borderRadius: 5,
    display: "grid",
    gap: 3,
    gridTemplateColumns: "repeat(6, 32px)",
    maxHeight: 360,
    overflow: "auto",
    padding: 6,
  },
  sheetCell: {
    alignItems: "center",
    background: "#0e1219",
    border: "0",
    borderRadius: 3,
    cursor: "pointer",
    display: "grid",
    height: 32,
    justifyItems: "center",
    minWidth: 0,
    padding: 0,
    width: 32,
  },
  sheetCellActive: { outline: "2px solid #f7d66b", outlineOffset: 1 },
  sheetPlaceholder: {
    background: "#0d1118",
    border: "1px solid #313847",
    borderRadius: 5,
    color: "#8f99aa",
    fontSize: 12,
    padding: 10,
  },
  spritePreviewCanvas: {
    imageRendering: "pixelated",
  },
  spriteFallback: { background: "#1a202b", borderRadius: 3, display: "block", height: 32, width: 32 },
  range: { width: "100%" },
  valueRow: { alignItems: "center", color: "#aeb8c8", display: "flex", justifyContent: "space-between", fontSize: 12 },
  checkRow: { alignItems: "center", color: "#cbd4e4", display: "flex", gap: 8, fontSize: 13 },
  statusGroup: { alignItems: "center", display: "flex", gap: 10, minWidth: 0 },
  dirtyBadge: { background: "#4a3716", borderRadius: 4, color: "#ffd36f", fontSize: 12, fontWeight: 800, padding: "4px 7px" },
  savedBadge: { background: "#183a29", borderRadius: 4, color: "#7ae3a6", fontSize: 12, fontWeight: 800, padding: "4px 7px" },
  metaText: { color: "#9aa5b7", fontSize: 12 },
  commandRow: { alignItems: "center", display: "flex", gap: 8 },
  commandGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  presetBlock: { display: "grid", gap: 7 },
  presetLabel: { color: "#8f99aa", fontSize: 11, fontWeight: 700 },
  presetGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  commandButton: {
    background: "#242a36",
    border: "1px solid #394353",
    borderRadius: 5,
    color: "#e7ecf5",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    padding: "8px 10px",
  },
  primaryButton: {
    background: "#5c7fc0",
    border: "1px solid #85a5df",
    borderRadius: 5,
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    padding: "8px 10px",
  },
  playLink: {
    background: "#28402c",
    border: "1px solid #5d9a68",
    borderRadius: 5,
    color: "#d9ffe0",
    fontSize: 12,
    fontWeight: 800,
    padding: "8px 10px",
    textDecoration: "none",
  },
  zoomLabel: { color: "#aeb8c8", fontSize: 12, minWidth: 42, textAlign: "center" },
  fieldLabel: { color: "#aeb8c8", display: "grid", fontSize: 12, gap: 5 },
  input: {
    background: "#0d1118",
    border: "1px solid #313847",
    borderRadius: 5,
    color: "#e9edf4",
    padding: "8px 9px",
  },
  cellInfo: { color: "#cbd4e4", display: "grid", fontSize: 12, gap: 5, lineHeight: 1.35 },
  muted: { color: "#8f99aa", fontSize: 12, margin: 0 },
  goodText: { color: "#7ae3a6", fontSize: 12, margin: 0 },
  smallButton: {
    background: "#242a36",
    border: "1px solid #394353",
    borderRadius: 5,
    color: "#e7ecf5",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    padding: "5px 7px",
  },
  dangerButton: {
    background: "#3a1e22",
    border: "1px solid #6d3339",
    borderRadius: 5,
    color: "#ffb2b9",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    marginTop: 4,
    padding: "7px 9px",
  },
  issueList: { display: "grid", gap: 6 },
  issueItem: {
    borderRadius: 5,
    cursor: "pointer",
    fontSize: 11,
    lineHeight: 1.25,
    padding: "7px 8px",
    textAlign: "left",
  },
  issueError: { background: "#3d1f25", border: "1px solid #7c3b44", color: "#ffc1c7" },
  issueWarning: { background: "#3b3219", border: "1px solid #6d5b28", color: "#ffe49a" },
  textarea: {
    background: "#0d1118",
    border: "1px solid #313847",
    borderRadius: 5,
    color: "#e9edf4",
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
    fontSize: 11,
    minHeight: 86,
    padding: 8,
    resize: "vertical",
    width: "100%",
  },
  exportBox: {
    background: "#0d1118",
    border: "1px solid #313847",
    borderRadius: 5,
    color: "#99a3b4",
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
    fontSize: 10,
    minHeight: 120,
    padding: 8,
    resize: "vertical",
    width: "100%",
  },
  errorText: { color: "#ff9da8", fontSize: 12, margin: 0 },
}
