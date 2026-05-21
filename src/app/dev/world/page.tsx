"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useSearchParams } from "next/navigation"
import {
  DEFAULT_DIALOGUE_CHOICES,
  dialogueChoiceForKey,
  makeWorldDialogueGameState,
  normalizeCustomDialogueMessage,
  resolveWorldNPCProfile,
  type DialogueChoice,
} from "@/game-core/game-loop/world-dialogue"
import {
  nextNpcPathStep,
  nextNpcWanderStep,
  planNpcDestination,
  type NpcDestinationKind,
} from "@/game-core/game-loop/npc-behavior"
import {
  advanceSpeechPage,
  attemptPlayerMove,
  findFacingNpc,
  type GridPosition,
  memorySpeechText,
  oppositeDirection,
  splitSpeechTextPages,
  type NpcPosition,
} from "@/game-core/game-loop/world-interaction"
import { loadMap } from "@/game-core/map/loader"
import { loadMapEditorDraft, loadSavedMap } from "@/game-core/map-editor/storage"
import { generateVillageTerrain } from "@/game-core/map/village-terrain"
import { cameraForPlayer } from "@/game-core/render/camera"
import { entitiesFromSpawns } from "@/game-core/render/entities"
import { loadAtlasImages, type LoadedAtlasImage } from "@/game-core/render/atlas-image-loader"
import {
  ATLAS_IMAGES,
  atlasCategoryFor,
  characterSpriteId,
} from "@/game-core/render/terrain-tiles"
import { renderTileMap } from "@/game-core/render/tilemap-renderer"
import { RENDER_SCALE, TILE_PX, type RenderEntity } from "@/game-core/render/types"
import { appendConversationEntry, loadNPCMemory } from "@/game-core/storage/npc-memory"
import { loadPromptOverrides } from "@/game-core/agent/prompt-overrides-storage"
import { loadNpcCharacterPrompt } from "@/game-core/storage/npc-character-prompt-storage"
import { loadNpcProfileOverride } from "@/game-core/storage/npc-profile-override-storage"
import type { Direction, SpawnPoint, TileMap } from "@/game-core/types/map"
import type { ConversationEntry } from "@/game-core/types/npc"

const DEFAULT_WORLD = loadMap(generateVillageTerrain())

const VIEW_TILES_W = 20
const VIEW_TILES_H = 13
const VIEWPORT = { width: VIEW_TILES_W * TILE_PX, height: VIEW_TILES_H * TILE_PX }
const STAGE_WIDTH = VIEWPORT.width * RENDER_SCALE
const STAGE_HEIGHT = VIEWPORT.height * RENDER_SCALE
const WALK_FRAME_COUNT = 4
const NPC_STEP_INTERVAL_MS = 760
const NPC_STEP_ANIMATION_MS = 420

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  W: "up",
  s: "down",
  S: "down",
  a: "left",
  A: "left",
  d: "right",
  D: "right",
}

type SpeechBubble = {
  npcId: string
  pages: string[]
  pageIndex: number
  gridX: number
  gridY: number
  choices?: DialogueChoice[]
  pending?: boolean
  error?: string
  decision?: "ok" | "not_ok"
}

type InteractApiResult = {
  responseText: string
  decision?: "ok" | "not_ok"
  action?: unknown
  memoryUpdate: ConversationEntry
}

type NpcRuntimeState = NpcPosition & {
  facing: Direction
  walkFrame: number
  previousX?: number
  previousY?: number
  movedAt?: number
  behavior: "idle" | "moving" | "wandering"
  path: GridPosition[]
  anchor?: GridPosition
  destinationKind?: NpcDestinationKind
  destinationLabel?: string
}

const NPC_DESTINATION_OPTIONS: Array<{ value: NpcDestinationKind; label: string }> = [
  { value: "house", label: "집 주변" },
  { value: "forest", label: "숲 근처" },
  { value: "sand", label: "모래" },
  { value: "waterfront", label: "물가" },
  { value: "grass", label: "잔디" },
]

function fallbackPlayerSpawn(world: TileMap): SpawnPoint {
  return {
    id: "player_start",
    x: Math.floor(world.width / 2),
    y: Math.floor(world.height / 2),
    facing: "down",
    entityType: "player",
  }
}

function makeWorldRuntime(world: TileMap) {
  const playerSpawn =
    world.spawnPoints.find((spawn) => spawn.entityType === "player") ?? fallbackPlayerSpawn(world)
  const npcSpawns = world.spawnPoints.filter((spawn) => spawn.entityType === "npc")
  const initialNpcStates = npcSpawns.reduce<Record<string, NpcRuntimeState>>((states, spawn) => {
    states[spawn.id] = {
      id: spawn.id,
      npcId: spawn.npcId,
      x: spawn.x,
      y: spawn.y,
      facing: spawn.facing,
      walkFrame: 0,
      behavior: "idle",
      path: [],
    }
    return states
  }, {})
  const npcPositions: NpcPosition[] = Object.values(initialNpcStates).map((npc) => ({
    id: npc.id,
    npcId: npc.npcId,
    x: npc.x,
    y: npc.y,
  }))

  return {
    playerSpawn,
    npcSpawns,
    npcPositions,
    initialNpcStates,
    dialogueState: makeWorldDialogueGameState(npcPositions),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

function firstNpcStateId(states: Record<string, NpcRuntimeState>): string {
  return Object.keys(states)[0] ?? ""
}

function npcRenderOffset(npc: NpcRuntimeState, now: number): { offsetX: number; offsetY: number } {
  if (npc.previousX == null || npc.previousY == null || npc.movedAt == null) {
    return { offsetX: 0, offsetY: 0 }
  }

  const progress = clamp((now - npc.movedAt) / NPC_STEP_ANIMATION_MS, 0, 1)
  return {
    offsetX: (npc.previousX - npc.x) * TILE_PX * (1 - progress),
    offsetY: (npc.previousY - npc.y) * TILE_PX * (1 - progress),
  }
}

function KeyButton({
  label,
  ariaLabel,
  onClick,
}: {
  label: string
  ariaLabel: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        width: 34,
        height: 32,
        border: "2px solid #2c2b30",
        borderTopColor: "#f6f2e8",
        borderLeftColor: "#f6f2e8",
        borderRadius: 3,
        background: "linear-gradient(180deg, #d8d2c5 0%, #9e978a 100%)",
        boxShadow: "inset -2px -2px 0 #6f685f, inset 2px 2px 0 #fffaf0, 0 3px 0 #1e1d22",
        color: "#222126",
        cursor: "pointer",
        fontFamily: "monospace",
        fontSize: 15,
        fontWeight: 800,
        lineHeight: "26px",
        padding: 0,
        textShadow: "0 1px #eee8dc",
      }}
    >
      {label}
    </button>
  )
}

function WorldPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<Record<string, LoadedAtlasImage> | null>(null)
  const npcBehaviorTickRef = useRef(0)
  const searchParams = useSearchParams()
  const embed = searchParams.get("embed") === "1"
  const draftMapEnabled = searchParams.get("draftMap") === "1"
  const mapId = searchParams.get("mapId")
  const [world, setWorld] = useState(DEFAULT_WORLD)
  const runtime = useMemo(() => makeWorldRuntime(world), [world])
  const [ready, setReady] = useState(false)
  const [player, setPlayer] = useState({
    x: runtime.playerSpawn.x,
    y: runtime.playerSpawn.y,
    walkFrame: 0,
  })
  const [facing, setFacing] = useState<Direction>(runtime.playerSpawn.facing)
  const [npcStates, setNpcStates] = useState(runtime.initialNpcStates)
  const [npcCommandNpcId, setNpcCommandNpcId] = useState(firstNpcStateId(runtime.initialNpcStates))
  const [npcCommandDestination, setNpcCommandDestination] =
    useState<NpcDestinationKind>("grass")
  const [npcCommandResponse, setNpcCommandResponse] = useState("")
  const [animationNow, setAnimationNow] = useState(() => Date.now())
  const [speechBubble, setSpeechBubble] = useState<SpeechBubble | null>(null)
  const [customDialogueMessage, setCustomDialogueMessage] = useState("")
  const [draftMapWarning, setDraftMapWarning] = useState<string | null>(null)

  useEffect(() => {
    queueMicrotask(() => {
      if (!draftMapEnabled && !mapId) {
        const nextRuntime = makeWorldRuntime(DEFAULT_WORLD)
        setWorld(DEFAULT_WORLD)
        setPlayer({ x: nextRuntime.playerSpawn.x, y: nextRuntime.playerSpawn.y, walkFrame: 0 })
        setFacing(nextRuntime.playerSpawn.facing)
        setNpcStates(nextRuntime.initialNpcStates)
        setNpcCommandNpcId(firstNpcStateId(nextRuntime.initialNpcStates))
        setNpcCommandResponse("")
        setSpeechBubble(null)
        setDraftMapWarning(null)
        return
      }

      const requestedMap = mapId ? loadSavedMap(mapId) : loadMapEditorDraft()
      if (!requestedMap) {
        const nextRuntime = makeWorldRuntime(DEFAULT_WORLD)
        setWorld(DEFAULT_WORLD)
        setPlayer({ x: nextRuntime.playerSpawn.x, y: nextRuntime.playerSpawn.y, walkFrame: 0 })
        setFacing(nextRuntime.playerSpawn.facing)
        setNpcStates(nextRuntime.initialNpcStates)
        setNpcCommandNpcId(firstNpcStateId(nextRuntime.initialNpcStates))
        setNpcCommandResponse("")
        setSpeechBubble(null)
        setDraftMapWarning(
          mapId
            ? `Saved map "${mapId}" not found or invalid. Showing the default village.`
            : "Saved map draft not found or invalid. Showing the default village."
        )
        return
      }

      const nextRuntime = makeWorldRuntime(requestedMap)
      setWorld(requestedMap)
      setPlayer({ x: nextRuntime.playerSpawn.x, y: nextRuntime.playerSpawn.y, walkFrame: 0 })
      setFacing(nextRuntime.playerSpawn.facing)
      setNpcStates(nextRuntime.initialNpcStates)
      setNpcCommandNpcId(firstNpcStateId(nextRuntime.initialNpcStates))
      setNpcCommandResponse("")
      setSpeechBubble(null)
      setDraftMapWarning(null)
    })
  }, [draftMapEnabled, mapId])

  const camera = useMemo(
    () =>
      cameraForPlayer(
        {
          worldX: player.x * TILE_PX + TILE_PX / 2,
          worldY: player.y * TILE_PX + TILE_PX / 2,
        },
        world,
        VIEWPORT
      ),
    [player, world]
  )

  const npcPositions = useMemo(
    () =>
      Object.values(npcStates).map((npc) => ({
        id: npc.id,
        npcId: npc.npcId,
        x: npc.x,
        y: npc.y,
      })),
    [npcStates]
  )

  const dialogueState = useMemo(() => makeWorldDialogueGameState(npcPositions), [npcPositions])

  const activeNpcCommandNpcId =
    npcCommandNpcId && npcStates[npcCommandNpcId] ? npcCommandNpcId : firstNpcStateId(npcStates)

  const movePlayer = useCallback((direction: Direction) => {
    setFacing(direction)
    setSpeechBubble(null)
    setPlayer((current) => {
      const result = attemptPlayerMove({
        map: world,
        player: current,
        direction,
        occupiedPositions: npcPositions,
      })
      return {
        ...result.position,
        walkFrame: result.moved
          ? (current.walkFrame + 1) % WALK_FRAME_COUNT
          : current.walkFrame,
      }
    })
  }, [npcPositions, world])

  const npcEntities = useMemo(
    () => {
      const offsets = new Map(
        Object.values(npcStates).map((npc) => [npc.id, npcRenderOffset(npc, animationNow)])
      )
      return entitiesFromSpawns({
        ...world,
        spawnPoints: Object.values(npcStates).map((npc) => ({
          id: npc.id,
          npcId: npc.npcId,
          x: npc.x,
          y: npc.y,
          facing: npc.facing,
          entityType: "npc",
        })),
      }).map((entity) => ({
        ...entity,
        ...(offsets.get(entity.id) ?? {}),
      }))
    },
    [animationNow, npcStates, world]
  )

  const interact = useCallback(() => {
    if (speechBubble) {
      const nextPageIndex = advanceSpeechPage(speechBubble.pageIndex, speechBubble.pages.length)
      if (nextPageIndex == null) {
        setSpeechBubble(null)
      } else {
        setSpeechBubble({ ...speechBubble, pageIndex: nextPageIndex })
      }
      return
    }

    const npc = findFacingNpc(player, facing, npcPositions)
    if (!npc) {
      setSpeechBubble(null)
      return
    }

    const npcId = npc.npcId ?? npc.id
    setNpcStates((current) => ({
      ...current,
      [npc.id]: {
        ...current[npc.id],
        facing: oppositeDirection(facing),
      },
    }))
    setSpeechBubble({
      npcId,
      pages: splitSpeechTextPages(memorySpeechText(loadNPCMemory(npcId))),
      pageIndex: 0,
      gridX: npc.x,
      gridY: npc.y,
      choices: DEFAULT_DIALOGUE_CHOICES,
    })
    setCustomDialogueMessage("")
  }, [facing, npcPositions, player, speechBubble])

  const sendDialogueMessage = useCallback(
    async (rawMessage: string) => {
      if (!speechBubble || speechBubble.pending) return

      const userMessage = normalizeCustomDialogueMessage(rawMessage)
      if (!userMessage) return

      const npcId = speechBubble.npcId
      setCustomDialogueMessage("")
      setSpeechBubble({
        ...speechBubble,
        pages: ["..."],
        pageIndex: 0,
        pending: true,
        error: undefined,
        decision: undefined,
      })

      try {
        const resolvedProfile = resolveWorldNPCProfile(npcId)
        const profileOverride = loadNpcProfileOverride(npcId)
        const mergedProfile = profileOverride
          ? {
              ...resolvedProfile,
              personality: profileOverride.personality
                ? profileOverride.personality.split(",").map((s) => s.trim()).filter(Boolean)
                : resolvedProfile.personality,
              dislikeds: profileOverride.dislikeds
                ? profileOverride.dislikeds.split(",").map((s) => s.trim()).filter(Boolean)
                : resolvedProfile.dislikeds,
              speechStyle: profileOverride.speechStyle ?? resolvedProfile.speechStyle,
            }
          : resolvedProfile
        const characterPromptOverride = resolvedProfile.characterPromptKey
          ? loadNpcCharacterPrompt(resolvedProfile.characterPromptKey) ?? undefined
          : undefined

        const response = await fetch("/api/agent/interact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            npcProfile: mergedProfile,
            npcMemory: loadNPCMemory(npcId),
            userMessage,
            gameState: dialogueState,
            promptOverrides: loadPromptOverrides(),
            characterPromptOverride,
          }),
        })

        if (!response.ok) {
          throw new Error(`Dialogue request failed with ${response.status}`)
        }

        const result = (await response.json()) as InteractApiResult
        appendConversationEntry(npcId, {
          timestamp: dialogueState.clock.day * 1440 + dialogueState.clock.currentMinute - 1,
          speaker: "user",
          message: userMessage,
          type: "chat",
        })
        appendConversationEntry(npcId, result.memoryUpdate)
        setSpeechBubble((current) =>
          current?.npcId === npcId
            ? {
                ...current,
                pages: splitSpeechTextPages(result.responseText),
                pageIndex: 0,
                choices: DEFAULT_DIALOGUE_CHOICES,
                pending: false,
                decision: result.decision,
              }
            : current
        )
      } catch {
        setSpeechBubble((current) =>
          current?.npcId === npcId
            ? {
                ...current,
                pages: ["대화 연결에 실패했어. 잠시 후 다시 말을 걸어줘."],
                pageIndex: 0,
                choices: DEFAULT_DIALOGUE_CHOICES,
                pending: false,
                error: "request_failed",
              }
            : current
        )
      }
    },
    [dialogueState, speechBubble]
  )

  const selectDialogueChoice = useCallback(
    (choice: DialogueChoice) => {
      void sendDialogueMessage(choice.userMessage)
    },
    [sendDialogueMessage]
  )

  const submitCustomDialogue = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      void sendDialogueMessage(customDialogueMessage)
    },
    [customDialogueMessage, sendDialogueMessage]
  )

  const commandNpcToDestination = useCallback(() => {
    const npc = npcStates[activeNpcCommandNpcId]
    if (!npc) {
      setNpcCommandResponse("명령을 보낼 NPC를 먼저 선택해야 해.")
      return
    }

    const plan = planNpcDestination({
      map: world,
      npcId: npc.npcId ?? npc.id,
      start: { x: npc.x, y: npc.y },
      occupiedPositions: [
        { x: player.x, y: player.y },
        ...npcPositions.filter((position) => position.id !== npc.id),
      ],
      destinationKind: npcCommandDestination,
    })
    setNpcCommandResponse(plan.responseText)

    if (!plan.ok) return

    setNpcStates((current) => ({
      ...current,
      [npc.id]: {
        ...current[npc.id],
        behavior: "moving",
        destinationKind: plan.destinationKind,
        destinationLabel: plan.label,
        anchor: plan.anchor,
        path: plan.path,
      },
    }))
  }, [activeNpcCommandNpcId, npcCommandDestination, npcPositions, npcStates, player, world])

  useEffect(() => {
    if (speechBubble) return

    const interval = window.setInterval(() => {
      npcBehaviorTickRef.current += 1
      const tick = npcBehaviorTickRef.current
      const movedAt = Date.now()
      setNpcStates((current) => {
        let changed = false
        const states = Object.values(current)
        const nextStates: Record<string, NpcRuntimeState> = {}

        for (const npc of states) {
          const occupiedPositions = [
            { x: player.x, y: player.y },
            ...states
              .filter((other) => other.id !== npc.id)
              .map((other) => ({ x: other.x, y: other.y })),
          ]
          const pathStep =
            npc.path.length > 0
              ? nextNpcPathStep({ path: npc.path, position: { x: npc.x, y: npc.y } })
              : null
          const wanderStep =
            !pathStep?.moved && npc.anchor && npc.behavior === "wandering" && tick % 2 === 0
              ? nextNpcWanderStep({
                  map: world,
                  position: { x: npc.x, y: npc.y },
                  anchor: npc.anchor,
                  radius: 4,
                  occupiedPositions,
                  tick,
                })
              : null
          const step = pathStep?.moved ? pathStep : wanderStep

          const stepBlocked =
            step?.moved &&
            occupiedPositions.some(
              (position) => position.x === step.position.x && position.y === step.position.y
            )

          if (step?.moved && !stepBlocked) {
            changed = true
            nextStates[npc.id] = {
              ...npc,
              previousX: npc.x,
              previousY: npc.y,
              movedAt,
              x: step.position.x,
              y: step.position.y,
              facing: step.facing,
              walkFrame: (npc.walkFrame + 1) % WALK_FRAME_COUNT,
              path: step.path ?? [],
              behavior: step.path && step.path.length > 0 ? "moving" : "wandering",
            }
          } else {
            nextStates[npc.id] = npc
          }
        }

        return changed ? nextStates : current
      })
    }, NPC_STEP_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [player, speechBubble, world])

  useEffect(() => {
    let frame = 0
    const update = () => {
      setAnimationNow(Date.now())
      frame = window.requestAnimationFrame(update)
    }
    frame = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const images = await loadAtlasImages(ATLAS_IMAGES, {
        transparentBlackFor: (id) => atlasCategoryFor(id) !== "character",
      })
      if (cancelled) return
      imagesRef.current = images
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target)) return

      const choice = dialogueChoiceForKey(event.key)
      if (choice && speechBubble?.choices) {
        event.preventDefault()
        void selectDialogueChoice(choice)
        return
      }

      const direction = KEY_DIRECTIONS[event.key]
      if (direction) {
        event.preventDefault()
        movePlayer(direction)
        return
      }

      if (event.key === "e" || event.key === "E") {
        event.preventDefault()
        interact()
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [interact, movePlayer, selectDialogueChoice, speechBubble])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const images = imagesRef.current
    if (!canvas || !images) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const playerEntity: RenderEntity = {
      id: "player",
      spriteId: characterSpriteId("player", facing, player.walkFrame),
      gridX: player.x,
      gridY: player.y,
      elevation: world.elevation[player.y]?.[player.x] ?? 0,
      spriteHeightPx: TILE_PX,
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    renderTileMap(
      ctx,
      { map: world, camera, entities: [...npcEntities, playerEntity] },
      { images }
    )
  }, [camera, facing, npcEntities, player, world])

  useEffect(() => {
    if (ready) render()
  }, [ready, render])

  const npcCommandOptions = useMemo(
    () =>
      Object.values(npcStates).map((npc) => {
        const npcId = npc.npcId ?? npc.id
        const profile = resolveWorldNPCProfile(npcId)
        return {
          id: npc.id,
          label: `${npcId} / ${profile.name}`,
          status:
            npc.behavior === "idle"
              ? "idle"
              : `${npc.destinationLabel ?? "이동 중"} · x ${npc.x}, y ${npc.y}`,
        }
      }),
    [npcStates]
  )

  return (
    <main
      style={{
        background: embed ? "#000" : "#1a1a24",
        minHeight: "100vh",
        padding: embed ? 20 : 24,
      }}
    >
      {!embed && (
        <h1 style={{ fontFamily: "monospace", color: "#fff", fontSize: 18 }}>
          World — 100x100 마을 + 추적 카메라 + NPC
        </h1>
      )}
      {!embed && (
        <p style={{ fontFamily: "monospace", color: "#aaa", fontSize: 13 }}>
          방향키 / WASD로 이동, E로 바라보는 NPC와 상호작용.
        </p>
      )}
      {!embed && (draftMapEnabled || mapId) && (
        <p style={{ fontFamily: "monospace", color: draftMapWarning ? "#ffb7b7" : "#9fe6b6", fontSize: 13 }}>
          {draftMapWarning ?? (mapId ? `Playing saved map: ${mapId}.` : "Playing saved map editor draft.")}
        </p>
      )}

      {!embed && npcCommandOptions.length > 0 ? (
        <section
          aria-label="NPC Command"
          style={{
            alignItems: "end",
            background: "#22232d",
            border: "1px solid #45475a",
            display: "grid",
            gap: 10,
            gridTemplateColumns: "minmax(180px, 1fr) 150px 104px",
            marginBottom: 14,
            maxWidth: STAGE_WIDTH,
            padding: 12,
          }}
        >
          <label style={{ color: "#d8d9ea", display: "grid", fontFamily: "monospace", fontSize: 12, gap: 5 }}>
            NPC
            <select
              value={activeNpcCommandNpcId}
              onChange={(event) => setNpcCommandNpcId(event.target.value)}
              style={{
                background: "#11121a",
                border: "1px solid #5c5f77",
                color: "#f6f6ff",
                fontFamily: "monospace",
                padding: "8px 9px",
              }}
            >
              {npcCommandOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} ({option.status})
                </option>
              ))}
            </select>
          </label>

          <label style={{ color: "#d8d9ea", display: "grid", fontFamily: "monospace", fontSize: 12, gap: 5 }}>
            Destination
            <select
              value={npcCommandDestination}
              onChange={(event) => setNpcCommandDestination(event.target.value as NpcDestinationKind)}
              style={{
                background: "#11121a",
                border: "1px solid #5c5f77",
                color: "#f6f6ff",
                fontFamily: "monospace",
                padding: "8px 9px",
              }}
            >
              {NPC_DESTINATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={commandNpcToDestination}
            style={{
              background: "#d7cf88",
              border: "2px solid #4e4930",
              color: "#24210f",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: 13,
              fontWeight: 900,
              padding: "8px 10px",
            }}
          >
            Send
          </button>
          {npcCommandResponse ? (
            <p
              style={{
                color: npcCommandResponse.includes("찾지 못했어") ? "#ffb4b4" : "#bff1c8",
                fontFamily: "monospace",
                fontSize: 12,
                gridColumn: "1 / -1",
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              {npcCommandResponse}
            </p>
          ) : null}
        </section>
      ) : null}

      <div
        style={{
          position: "relative",
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          border: "1px solid #444",
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvasRef}
          width={STAGE_WIDTH}
          height={STAGE_HEIGHT}
          style={{ imageRendering: "pixelated", display: "block" }}
        />

        {speechBubble ? (
          <div
            role="status"
            style={{
              position: "absolute",
              bottom: 18,
              left: 22,
              right: 22,
              boxSizing: "border-box",
              border: "4px solid #3d3548",
              background: "#f8f5ee",
              boxShadow:
                "inset 0 0 0 3px #fffdf7, inset 0 0 0 6px #9b8f7a, 0 4px 0 rgba(0, 0, 0, 0.36)",
              color: "#39313d",
              fontFamily: "monospace",
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1.45,
              minHeight: 160,
              padding: "24px 62px 24px 30px",
              textShadow: "1px 1px 0 #ffffff",
              zIndex: 3,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ color: "#6c6070", fontSize: 14 }}>
                {speechBubble.npcId}
                {speechBubble.pages.length > 1
                  ? ` ${speechBubble.pageIndex + 1}/${speechBubble.pages.length}`
                  : ""}
              </span>
              {speechBubble.pending ? (
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "#2a2d50",
                  color: "#8888cc",
                  letterSpacing: 0.5,
                }}>
                  검증 중…
                </span>
              ) : speechBubble.decision === "not_ok" ? (
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "#4a1d1d",
                  color: "#ff7070",
                  letterSpacing: 0.5,
                }}>
                  검증 실패
                </span>
              ) : speechBubble.decision === "ok" ? (
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "#1d3a2d",
                  color: "#5ad68e",
                  letterSpacing: 0.5,
                }}>
                  검증 통과
                </span>
              ) : null}
            </div>
            {speechBubble.pages[speechBubble.pageIndex]}
            {speechBubble.choices ? (
              <div
                aria-label="Dialogue choices"
                style={{
                  display: "grid",
                  gap: 6,
                  marginTop: 16,
                }}
              >
                {speechBubble.choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={speechBubble.pending}
                    onClick={() => void selectDialogueChoice(choice)}
                    style={{
                      alignItems: "center",
                      background: speechBubble.pending ? "#d9d9e4" : "#ececf8",
                      border: "2px solid #77788f",
                      color: "#353548",
                      cursor: speechBubble.pending ? "default" : "pointer",
                      display: "grid",
                      fontFamily: "monospace",
                      fontSize: 13,
                      fontWeight: 700,
                      gap: 8,
                      gridTemplateColumns: "26px 1fr",
                      lineHeight: 1.2,
                      padding: "5px 8px",
                      textAlign: "left",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        background: "#3f4054",
                        color: "#f7f7ff",
                        display: "inline-grid",
                        height: 22,
                        placeItems: "center",
                        width: 22,
                      }}
                    >
                      {choice.id}
                    </span>
                    <span>{choice.label}</span>
                  </button>
                ))}
                <form
                  aria-label="Custom dialogue"
                  onSubmit={submitCustomDialogue}
                  style={{
                    display: "grid",
                    gap: 6,
                    gridTemplateColumns: "1fr 54px",
                    marginTop: 2,
                  }}
                >
                  <input
                    aria-label="Custom dialogue message"
                    disabled={speechBubble.pending}
                    maxLength={120}
                    onChange={(event) => setCustomDialogueMessage(event.target.value)}
                    placeholder="직접 말하기"
                    value={customDialogueMessage}
                    style={{
                      background: speechBubble.pending ? "#d9d9e4" : "#ffffff",
                      border: "2px solid #77788f",
                      color: "#353548",
                      fontFamily: "monospace",
                      fontSize: 13,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      minWidth: 0,
                      padding: "5px 8px",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={
                      speechBubble.pending ||
                      normalizeCustomDialogueMessage(customDialogueMessage) == null
                    }
                    style={{
                      background:
                        speechBubble.pending ||
                        normalizeCustomDialogueMessage(customDialogueMessage) == null
                          ? "#d9d9e4"
                          : "#ececf8",
                      border: "2px solid #77788f",
                      color: "#353548",
                      cursor:
                        speechBubble.pending ||
                        normalizeCustomDialogueMessage(customDialogueMessage) == null
                          ? "default"
                          : "pointer",
                      fontFamily: "monospace",
                      fontSize: 13,
                      fontWeight: 800,
                      lineHeight: 1.2,
                      padding: "5px 8px",
                    }}
                  >
                    전송
                  </button>
                </form>
              </div>
            ) : null}
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                right: 18,
                bottom: 16,
                width: 0,
                height: 0,
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderTop: "13px solid #5d5361",
              }}
            />
          </div>
        ) : null}

        <div
          aria-label="Movement and interaction controls"
          style={{
            position: "absolute",
            right: 16,
            bottom: speechBubble ? 202 : 16,
            display: "flex",
            gap: 10,
            alignItems: "end",
            padding: 10,
            border: "2px solid #26252b",
            borderTopColor: "#5a5760",
            borderLeftColor: "#5a5760",
            background: "rgba(31, 30, 36, 0.78)",
            boxShadow: "0 4px 0 rgba(0, 0, 0, 0.38)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "34px 34px 34px",
              gridTemplateRows: "32px 32px",
              gap: 4,
            }}
          >
            <div />
            <KeyButton label="↑" ariaLabel="Move up" onClick={() => movePlayer("up")} />
            <div />
            <KeyButton label="←" ariaLabel="Move left" onClick={() => movePlayer("left")} />
            <KeyButton label="↓" ariaLabel="Move down" onClick={() => movePlayer("down")} />
            <KeyButton label="→" ariaLabel="Move right" onClick={() => movePlayer("right")} />
          </div>
          <KeyButton label="E" ariaLabel="Interact" onClick={interact} />
        </div>
      </div>
    </main>
  )
}

// useSearchParams 를 쓰므로 Suspense 경계로 감싼다.
export default function WorldPageRoute() {
  return (
    <Suspense>
      <WorldPage />
    </Suspense>
  )
}
