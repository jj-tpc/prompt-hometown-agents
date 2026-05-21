"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useSearchParams } from "next/navigation"
import {
  DEFAULT_DIALOGUE_CHOICES,
  dialogueChoiceForKey,
  makeWorldDialogueGameState,
  normalizeCustomDialogueMessage,
  resolveWorldNPCProfile,
  worldNpcDisplayInfo,
  type DialogueChoice,
} from "@/game-core/game-loop/world-dialogue"
import {
  nextNpcFollowStep,
  nextNpcPathStep,
  nextNpcWanderStep,
  planNpcPathToPosition,
  planNpcDestination,
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
import { loadLLMSettings } from "@/game-core/agent/llm-settings-storage"
import { loadPromptOverrides } from "@/game-core/agent/prompt-overrides-storage"
import { loadNpcCharacterPrompt } from "@/game-core/storage/npc-character-prompt-storage"
import { loadNpcProfileOverride } from "@/game-core/storage/npc-profile-override-storage"
import type { Direction, SpawnPoint, TileMap } from "@/game-core/types/map"
import type { ConversationEntry, NPCProfile } from "@/game-core/types/npc"
import type { NPCAction, NpcDestinationKind } from "@/game-core/types/game"

const DEFAULT_WORLD = loadMap(generateVillageTerrain())

const VIEW_TILES_W = 20
const VIEW_TILES_H = 13
const VIEWPORT = { width: VIEW_TILES_W * TILE_PX, height: VIEW_TILES_H * TILE_PX }
const STAGE_WIDTH = VIEWPORT.width * RENDER_SCALE
const STAGE_HEIGHT = VIEWPORT.height * RENDER_SCALE
const WALK_FRAME_COUNT = 4
const NPC_STEP_INTERVAL_MS = 760
const NPC_STEP_ANIMATION_MS = 420
const NPC_FOLLOW_TICKS = 24
const NPC_RETURN_DELAY_TICKS = 10
const DIALOGUE_REQUEST_TIMEOUT_MS = 20000
const PIPELINE_SUCCESS_PANEL_HIDE_MS = 1500
const PIPELINE_FAILURE_PANEL_HIDE_MS = 12000
const PIPELINE_PANEL_EXIT_MS = 450
const UNKNOWN_DIALOGUE_FAILURE_RESPONSE = "잘 못 들었는데... 다시 한 번 말해봐."
const CACHED_DIALOGUE_FAILURE_RESPONSE =
  "바람소리가 너무 크게 불어 아무것도 들리지 않는다. 다시 이야기해보자"

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
  pendingAction?: NPCAction
  choices?: DialogueChoice[]
  pending?: boolean
}

type InteractApiResult = {
  responseText: string
  decision?: "ok" | "not_ok"
  action?: NPCAction
  memoryUpdate: ConversationEntry
  failedStage?: PipelinePhase | "chat" | "unknown"
  errorMessage?: string
  error?: ValidationPipelineErrorPayload
}

type PipelinePhase = "validate" | "personality" | "decision"
type PipelineStatus = "running" | "passed" | "failed"

type PipelinePanelState = {
  phase: PipelinePhase
  status: PipelineStatus
  visible: boolean
  errorMessage?: string
  error?: ValidationPipelineErrorPayload
}

const PIPELINE_PHASE_META: Record<PipelinePhase, { label: string; detail: string }> = {
  validate: {
    label: "요청 유효성 검증",
    detail: "세계 규칙과 가능한 행동을 확인 중",
  },
  personality: {
    label: "페르소나 적합성 검증",
    detail: "성격과 관계에 맞는 요청인지 확인 중",
  },
  decision: {
    label: "최종 결정 생성",
    detail: "응답과 행동 결과를 정리 중",
  },
}

function mergeWorldNpcProfile(npcId: string): NPCProfile {
  const resolvedProfile = resolveWorldNPCProfile(npcId)
  const profileOverride = loadNpcProfileOverride(npcId)
  if (!profileOverride) return resolvedProfile

  return {
    ...resolvedProfile,
    personality: profileOverride.personality
      ? profileOverride.personality.split(",").map((s) => s.trim()).filter(Boolean)
      : resolvedProfile.personality,
    dislikeds: profileOverride.dislikeds
      ? profileOverride.dislikeds.split(",").map((s) => s.trim()).filter(Boolean)
      : resolvedProfile.dislikeds,
    speechStyle: profileOverride.speechStyle ?? resolvedProfile.speechStyle,
    habitBehavior: profileOverride.habitBehavior ?? resolvedProfile.habitBehavior,
    prohibitBehavior: profileOverride.prohibitBehavior ?? resolvedProfile.prohibitBehavior,
  }
}

type ValidationPipelineErrorPayload = {
  code: "validation_pipeline_failed" | "dialogue_request_failed"
  pipelineStage?: string
  pipelineStageLabel?: string
  message: string
  responseText?: string
}

type NpcRuntimeState = NpcPosition & {
  facing: Direction
  walkFrame: number
  previousX?: number
  previousY?: number
  movedAt?: number
  behavior: "idle" | "moving" | "wandering" | "following" | "returning"
  path: GridPosition[]
  home: GridPosition
  anchor?: GridPosition
  destinationKind?: NpcDestinationKind
  destinationLabel?: string
  followTicksRemaining?: number
  returnDelayTicks?: number
}

const NPC_DESTINATION_OPTIONS: Array<{ value: NpcDestinationKind; label: string }> = [
  { value: "house", label: "집 주변" },
  { value: "forest", label: "숲 근처" },
  { value: "sand", label: "모래" },
  { value: "waterfront", label: "물가" },
  { value: "grass", label: "잔디" },
]
const errorPulse = "validation-error-pulse"

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
      home: { x: spawn.x, y: spawn.y },
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

function isValidationPipelineErrorPayload(value: unknown): value is ValidationPipelineErrorPayload {
  if (typeof value !== "object" || value === null) return false
  const error = value as Partial<ValidationPipelineErrorPayload>
  return (
    typeof error.code === "string" &&
    typeof error.message === "string" &&
    (error.pipelineStage == null || typeof error.pipelineStage === "string") &&
    (error.pipelineStageLabel == null || typeof error.pipelineStageLabel === "string") &&
    (error.responseText == null || typeof error.responseText === "string")
  )
}

function normalizeInteractionError(error: unknown): ValidationPipelineErrorPayload {
  if (isValidationPipelineErrorPayload(error)) return error

  return {
    code: "dialogue_request_failed",
    pipelineStageLabel: "대화 요청",
    message: error instanceof Error ? error.message : "응답을 받을 수 없음",
    responseText: UNKNOWN_DIALOGUE_FAILURE_RESPONSE,
  }
}

async function readInteractionError(response: Response): Promise<ValidationPipelineErrorPayload> {
  try {
    const data = (await response.json()) as { error?: unknown; responseText?: unknown }
    if (isValidationPipelineErrorPayload(data.error)) {
      return {
        ...data.error,
        responseText:
          typeof data.responseText === "string" ? data.responseText : data.error.responseText,
      }
    }
  } catch {
    // The response body may be empty for unexpected server failures.
  }

  return {
    code: "dialogue_request_failed",
    pipelineStageLabel: "대화 요청",
    message: `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
    responseText: UNKNOWN_DIALOGUE_FAILURE_RESPONSE,
  }
}

function dialogueFailureResponseText(error: ValidationPipelineErrorPayload): string {
  const generatedText = error.responseText?.trim() || UNKNOWN_DIALOGUE_FAILURE_RESPONSE
  return generatedText.trim() || CACHED_DIALOGUE_FAILURE_RESPONSE
}

function firstNpcStateId(states: Record<string, NpcRuntimeState>): string {
  return Object.keys(states)[0] ?? ""
}

function npcStateKeyForNpcId(states: Record<string, NpcRuntimeState>, npcId: string): string | null {
  return Object.entries(states).find(([, npc]) => npc.npcId === npcId || npc.id === npcId)?.[0] ?? null
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
  const [pipelinePanel, setPipelinePanel] = useState<PipelinePanelState | null>(null)
  const pipelineTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
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

  const clearPipelineTimers = useCallback(() => {
    for (const timer of pipelineTimersRef.current) {
      clearTimeout(timer)
    }
    pipelineTimersRef.current = []
  }, [])

  const startPipelinePanel = useCallback(() => {
    clearPipelineTimers()
    setPipelinePanel({ phase: "validate", status: "running", visible: true })
    pipelineTimersRef.current = [
      setTimeout(
        () => setPipelinePanel({ phase: "personality", status: "running", visible: true }),
        700
      ),
      setTimeout(
        () => setPipelinePanel({ phase: "decision", status: "running", visible: true }),
        1400
      ),
    ]
  }, [clearPipelineTimers])

  const finishPipelinePanel = useCallback(
    (
      status: Exclude<PipelineStatus, "running">,
      failedStage?: InteractApiResult["failedStage"],
      errorMessage?: string,
      error?: ValidationPipelineErrorPayload
    ) => {
      clearPipelineTimers()
      const phase: PipelinePhase =
        failedStage === "validate" || failedStage === "personality" || failedStage === "decision"
          ? failedStage
          : "decision"
      const hideAfter =
        status === "failed" ? PIPELINE_FAILURE_PANEL_HIDE_MS : PIPELINE_SUCCESS_PANEL_HIDE_MS
      setPipelinePanel({ phase, status, visible: true, errorMessage, error })
      pipelineTimersRef.current = [
        setTimeout(
          () => setPipelinePanel((current) => (current ? { ...current, visible: false } : current)),
          hideAfter
        ),
        setTimeout(() => setPipelinePanel(null), hideAfter + PIPELINE_PANEL_EXIT_MS),
      ]
    },
    [clearPipelineTimers]
  )

  const dismissPipelinePanel = useCallback(() => {
    clearPipelineTimers()
    setPipelinePanel((current) => (current ? { ...current, visible: false } : current))
    pipelineTimersRef.current = [setTimeout(() => setPipelinePanel(null), PIPELINE_PANEL_EXIT_MS)]
  }, [clearPipelineTimers])

  useEffect(() => clearPipelineTimers, [clearPipelineTimers])

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

  const applyNpcAction = useCallback((npcId: string, action: NPCAction) => {
    if (action.type === "give_item") return

    setNpcStates((current) => {
      const npcKey = npcStateKeyForNpcId(current, npcId)
      if (!npcKey) return current
      const npc = current[npcKey]
      const states = Object.values(current)
      const occupiedPositions = [
        { x: player.x, y: player.y },
        ...states
          .filter((other) => other.id !== npc.id)
          .map((other) => ({ x: other.x, y: other.y })),
      ]

      if (action.type === "follow_player") {
        return {
          ...current,
          [npcKey]: {
            ...npc,
            behavior: "following",
            destinationLabel: "따라오는 중",
            followTicksRemaining: NPC_FOLLOW_TICKS,
            path: [],
            returnDelayTicks: undefined,
          },
        }
      }

      if (action.type === "move_to_tile") {
        const plan = planNpcDestination({
          map: world,
          npcId: npc.npcId ?? npc.id,
          start: { x: npc.x, y: npc.y },
          occupiedPositions,
          destinationKind: action.destinationKind,
        })
        if (!plan.ok) return current
        return {
          ...current,
          [npcKey]: {
            ...npc,
            behavior: "moving",
            destinationKind: plan.destinationKind,
            destinationLabel: plan.label,
            anchor: plan.anchor,
            path: plan.path,
            returnDelayTicks: NPC_RETURN_DELAY_TICKS,
          },
        }
      }

      const target = states.find((entry) => entry.npcId === action.targetNpcId || entry.id === action.targetNpcId)
      if (!target) return current
      const path = planNpcPathToPosition({
        map: world,
        start: { x: npc.x, y: npc.y },
        destination: { x: target.x, y: target.y },
        occupiedPositions: occupiedPositions.filter((position) => position.x !== target.x || position.y !== target.y),
      })
      if (!path || path.length === 0) return current
      return {
        ...current,
        [npcKey]: {
          ...npc,
          behavior: "moving",
          destinationLabel: `${action.targetNpcId}에게 이동 중`,
          anchor: { x: target.x, y: target.y },
          path,
          returnDelayTicks: NPC_RETURN_DELAY_TICKS,
        },
      }
    })
  }, [player, world])

  const closeActiveSpeechBubble = useCallback(() => {
    if (speechBubble?.pendingAction) {
      applyNpcAction(speechBubble.npcId, speechBubble.pendingAction)
    }
    setSpeechBubble(null)
  }, [applyNpcAction, speechBubble])

  const movePlayer = useCallback((direction: Direction) => {
    setFacing(direction)
    closeActiveSpeechBubble()
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
  }, [closeActiveSpeechBubble, npcPositions, world])

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
        closeActiveSpeechBubble()
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
    const npcProfile = mergeWorldNpcProfile(npcId)
    const npcMemory = loadNPCMemory(npcId)
    setNpcStates((current) => ({
      ...current,
      [npc.id]: {
        ...current[npc.id],
        facing: oppositeDirection(facing),
      },
    }))
    setSpeechBubble({
      npcId,
      pages: splitSpeechTextPages(memorySpeechText(npcMemory, npcProfile)),
      pageIndex: 0,
      gridX: npc.x,
      gridY: npc.y,
      choices: DEFAULT_DIALOGUE_CHOICES,
    })
    setCustomDialogueMessage("")
  }, [closeActiveSpeechBubble, facing, npcPositions, player, speechBubble])

  const sendDialogueMessage = useCallback(
    async (rawMessage: string) => {
      if (!speechBubble || speechBubble.pending) return

      const userMessage = normalizeCustomDialogueMessage(rawMessage)
      if (!userMessage) return

      const npcId = speechBubble.npcId
      startPipelinePanel()
      setCustomDialogueMessage("")
      setSpeechBubble({
        ...speechBubble,
        pages: ["..."],
        pageIndex: 0,
        pendingAction: undefined,
        pending: true,
      })

      try {
        const resolvedProfile = resolveWorldNPCProfile(npcId)
        const mergedProfile = mergeWorldNpcProfile(npcId)
        const characterPromptOverride = resolvedProfile.characterPromptKey
          ? loadNpcCharacterPrompt(resolvedProfile.characterPromptKey) ?? undefined
          : undefined

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), DIALOGUE_REQUEST_TIMEOUT_MS)
        const response = await fetch("/api/agent/interact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            npcProfile: mergedProfile,
            npcMemory: loadNPCMemory(npcId),
            userMessage,
            gameState: dialogueState,
            promptOverrides: loadPromptOverrides(),
            characterPromptOverride,
            modelSelection: loadLLMSettings().modelSelection,
          }),
        }).finally(() => clearTimeout(timeoutId))

        if (!response.ok) {
          throw await readInteractionError(response)
        }

        const result = (await response.json()) as InteractApiResult
        finishPipelinePanel(
          result.decision === "not_ok" ? "failed" : "passed",
          result.failedStage,
          result.errorMessage,
          result.error
        )
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
                pendingAction: result.decision === "ok" ? result.action : undefined,
                choices: DEFAULT_DIALOGUE_CHOICES,
                pending: false,
              }
            : current
        )
      } catch (error) {
        const interactionError = normalizeInteractionError(error)
        const failedStage: InteractApiResult["failedStage"] =
          interactionError.pipelineStage === "validate" ||
          interactionError.pipelineStage === "personality" ||
          interactionError.pipelineStage === "decision"
            ? interactionError.pipelineStage
            : "unknown"
        finishPipelinePanel(
          "failed",
          failedStage,
          interactionError.message,
          interactionError
        )
        const responseText = dialogueFailureResponseText(interactionError)
        setSpeechBubble((current) =>
          current?.npcId === npcId
            ? {
                ...current,
                pages: splitSpeechTextPages(responseText),
                pageIndex: 0,
                choices: DEFAULT_DIALOGUE_CHOICES,
                pending: false,
              }
            : current
        )
      }
    },
    [dialogueState, finishPipelinePanel, speechBubble, startPipelinePanel]
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
        returnDelayTicks: NPC_RETURN_DELAY_TICKS,
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

          const returnPath = () =>
            planNpcPathToPosition({
              map: world,
              start: { x: npc.x, y: npc.y },
              destination: npc.home,
              occupiedPositions,
            }) ?? []

          if (npc.behavior === "following") {
            const followTicksRemaining = (npc.followTicksRemaining ?? NPC_FOLLOW_TICKS) - 1
            if (followTicksRemaining <= 0) {
              const path = returnPath()
              changed = true
              nextStates[npc.id] = {
                ...npc,
                behavior: path.length > 0 ? "returning" : "idle",
                destinationLabel: path.length > 0 ? "제자리로 돌아가는 중" : undefined,
                followTicksRemaining: undefined,
                path,
                returnDelayTicks: undefined,
              }
              continue
            }

            const step = nextNpcFollowStep({
              map: world,
              position: { x: npc.x, y: npc.y },
              player,
              occupiedPositions,
            })

            if (step.moved) {
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
                followTicksRemaining,
                path: [],
              }
            } else {
              changed = true
              nextStates[npc.id] = { ...npc, followTicksRemaining }
            }
            continue
          }

          if (npc.behavior === "wandering" && npc.returnDelayTicks != null && npc.path.length === 0) {
            const returnDelayTicks = npc.returnDelayTicks - 1
            if (returnDelayTicks <= 0) {
              const path = returnPath()
              changed = true
              nextStates[npc.id] = {
                ...npc,
                behavior: path.length > 0 ? "returning" : "idle",
                destinationLabel: path.length > 0 ? "제자리로 돌아가는 중" : undefined,
                path,
                returnDelayTicks: undefined,
              }
              continue
            }
            changed = true
            nextStates[npc.id] = { ...npc, returnDelayTicks }
            continue
          }

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
            const remainingPath = step.path ?? []
            const arrived = remainingPath.length === 0
            const nextBehavior =
              arrived && npc.behavior === "returning"
                ? "idle"
                : arrived && npc.behavior === "moving"
                  ? "wandering"
                  : npc.behavior
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
              path: remainingPath,
              behavior: nextBehavior,
              anchor: nextBehavior === "idle" ? npc.home : npc.anchor,
              destinationLabel: nextBehavior === "idle" ? undefined : npc.destinationLabel,
              destinationKind: nextBehavior === "idle" ? undefined : npc.destinationKind,
              returnDelayTicks:
                arrived && npc.behavior === "moving"
                  ? npc.returnDelayTicks ?? NPC_RETURN_DELAY_TICKS
                  : nextBehavior === "idle"
                    ? undefined
                    : npc.returnDelayTicks,
            }
          } else if (npc.behavior === "returning" && npc.path.length === 0) {
            changed = true
            nextStates[npc.id] = {
              ...npc,
              behavior: "idle",
              destinationLabel: undefined,
              destinationKind: undefined,
              returnDelayTicks: undefined,
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
        if (pipelinePanel?.status === "failed") {
          dismissPipelinePanel()
          return
        }
        interact()
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dismissPipelinePanel, interact, movePlayer, pipelinePanel?.status, selectDialogueChoice, speechBubble])

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
  const activeDialogueNpc = useMemo(
    () => (speechBubble ? worldNpcDisplayInfo(speechBubble.npcId) : null),
    [speechBubble]
  )

  return (
    <main
      style={{
        background: embed ? "#000" : "#1a1a24",
        minHeight: "100vh",
        padding: embed ? 20 : 24,
      }}
    >
      <style>{`
        .pipeline-panel {
          position: absolute;
          top: -108px;
          right: 28px;
          width: 382px;
          box-sizing: border-box;
          border: 4px solid #8a829a;
          background: #f8f5ee;
          box-shadow:
            inset 0 0 0 3px #fffdf7,
            0 5px 0 rgba(0, 0, 0, 0.32);
          color: #39313d;
          display: grid;
          gap: 4px;
          padding: 14px 18px;
          text-shadow: 1px 1px 0 #ffffff;
          transform: translateY(44px);
          opacity: 0;
          pointer-events: none;
          transition:
            opacity 260ms cubic-bezier(0.25, 1, 0.5, 1),
            transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
            border-color 180ms ease;
          will-change: transform, opacity;
          z-index: 4;
        }

        .pipeline-panel--visible {
          opacity: 1;
          transform: translateY(0);
        }

        .pipeline-panel--hidden {
          opacity: 0;
          transform: translateY(44px);
        }

        @media (prefers-reduced-motion: reduce) {
          .pipeline-panel {
            transition-duration: 1ms;
          }
        }
      `}</style>
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
              fontSize: 24,
              fontWeight: 700,
              lineHeight: 1.45,
              minHeight: 170,
              padding: "24px 62px 24px 30px",
              textShadow: "1px 1px 0 #ffffff",
              zIndex: 3,
            }}
          >
            {pipelinePanel ? (
              <div
                aria-label="검증 파이프라인 상태"
                className={[
                  "pipeline-panel",
                  pipelinePanel.visible ? "pipeline-panel--visible" : "pipeline-panel--hidden",
                ].join(" ")}
                style={{
                  borderColor:
                    pipelinePanel.status === "passed"
                      ? "#4d7dff"
                      : pipelinePanel.status === "failed"
                        ? "#d84a4a"
                        : "#8a829a",
                }}
              >
                {pipelinePanel.status === "failed" ? (
                  <div
                    role="alert"
                    style={{
                      alignItems: "start",
                      display: "grid",
                      gap: 10,
                      gridTemplateColumns: "16px 1fr",
                      lineHeight: 1.35,
                      textShadow: "none",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className={errorPulse}
                      style={{
                        background: "#e21d31",
                        border: "2px solid #fff7f5",
                        borderRadius: "50%",
                        height: 12,
                        marginTop: 6,
                        width: 12,
                      }}
                    />
                    <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
                      <strong style={{ color: "#7f1521", fontSize: 16 }}>
                        {pipelinePanel.error?.code === "validation_pipeline_failed"
                          ? "검증 파이프라인 실패"
                          : "대화 요청 실패"}
                      </strong>
                      <span style={{ color: "#44181c", fontSize: 15 }}>
                        {(pipelinePanel.error?.pipelineStageLabel ??
                          PIPELINE_PHASE_META[pipelinePanel.phase].label)} 단계에서 멈췄어.
                      </span>
                      <span style={{ color: "#6c2a2f", fontSize: 14, overflowWrap: "anywhere" }}>
                        원인: {pipelinePanel.error?.message ?? pipelinePanel.errorMessage ?? "알 수 없는 오류"}
                      </span>
                      <span style={{ color: "#7f1521", fontSize: 13, fontWeight: 900 }}>
                        E를 눌러 닫기
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        color: pipelinePanel.status === "passed" ? "#224fdd" : "#4b4260",
                        fontSize: 14,
                        fontWeight: 900,
                        letterSpacing: 0.2,
                      }}
                    >
                      {pipelinePanel.status === "running" ? "검증 중" : "통과"}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 900 }}>
                      {PIPELINE_PHASE_META[pipelinePanel.phase].label}
                    </div>
                    <div style={{ color: "#6c6070", fontSize: 13, fontWeight: 700 }}>
                      {pipelinePanel.status === "running"
                        ? PIPELINE_PHASE_META[pipelinePanel.phase].detail
                        : "요청을 처리할 수 있어요."}
                    </div>
                  </>
                )}
              </div>
            ) : null}
            {activeDialogueNpc ? (
              <div
                style={{
                  alignItems: "baseline",
                  color: "#6c6070",
                  display: "flex",
                  flexWrap: "wrap",
                  fontSize: 15,
                  gap: "6px 12px",
                  marginBottom: 10,
                }}
              >
                <span style={{ color: "#2f2935", fontSize: 18, fontWeight: 900 }}>
                  {activeDialogueNpc.name}
                </span>
                <span>직업: {activeDialogueNpc.occupation}</span>
                {speechBubble.pages.length > 1 ? (
                  <span>{speechBubble.pageIndex + 1}/{speechBubble.pages.length}</span>
                ) : null}
              </div>
            ) : null}
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
                          fontSize: 15,
                          fontWeight: 700,
                          gap: 8,
                          gridTemplateColumns: "28px 1fr",
                          lineHeight: 1.2,
                          padding: "6px 9px",
                          textAlign: "left",
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            background: "#3f4054",
                            color: "#f7f7ff",
                            display: "inline-grid",
                            fontSize: 14,
                            height: 24,
                            placeItems: "center",
                            width: 24,
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
                        gridTemplateColumns: "1fr 62px",
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
                          fontSize: 15,
                          fontWeight: 700,
                          lineHeight: 1.2,
                          minWidth: 0,
                          padding: "6px 9px",
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
                          fontSize: 15,
                          fontWeight: 800,
                          lineHeight: 1.2,
                          padding: "6px 9px",
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
