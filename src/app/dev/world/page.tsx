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
  advanceSpeechPage,
  attemptPlayerMove,
  findFacingNpc,
  memorySpeechText,
  oppositeDirection,
  splitSpeechTextPages,
  type NpcPosition,
} from "@/game-core/game-loop/world-interaction"
import { loadMap } from "@/game-core/map/loader"
import { generateRandomTerrain } from "@/game-core/map/random-terrain"
import { cameraForPlayer } from "@/game-core/render/camera"
import { entitiesFromSpawns } from "@/game-core/render/entities"
import { ATLAS_IMAGES, characterSpriteId } from "@/game-core/render/terrain-tiles"
import { gridToScreen, renderTileMap } from "@/game-core/render/tilemap-renderer"
import { RENDER_SCALE, TILE_PX, type RenderEntity } from "@/game-core/render/types"
import { appendConversationEntry, loadNPCMemory } from "@/game-core/storage/npc-memory"
import { loadPromptOverrides } from "@/game-core/agent/prompt-overrides-storage"
import type { Direction } from "@/game-core/types/map"
import type { ConversationEntry } from "@/game-core/types/npc"

const WORLD = loadMap(generateRandomTerrain(200, 200))
const PLAYER_SPAWN =
  WORLD.spawnPoints.find((spawn) => spawn.entityType === "player") ?? WORLD.spawnPoints[0]
const NPC_SPAWNS = WORLD.spawnPoints.filter((spawn) => spawn.entityType === "npc")
const NPC_POSITIONS: NpcPosition[] = NPC_SPAWNS.map((spawn) => ({
  id: spawn.id,
  npcId: spawn.npcId,
  x: spawn.x,
  y: spawn.y,
}))
const INITIAL_NPC_FACINGS = NPC_SPAWNS.reduce<Record<string, Direction>>((facings, spawn) => {
  facings[spawn.id] = spawn.facing
  return facings
}, {})
const WORLD_DIALOGUE_STATE = makeWorldDialogueGameState(NPC_POSITIONS)

const VIEW_TILES_W = 20
const VIEW_TILES_H = 13
const VIEWPORT = { width: VIEW_TILES_W * TILE_PX, height: VIEW_TILES_H * TILE_PX }
const STAGE_WIDTH = VIEWPORT.width * RENDER_SCALE
const STAGE_HEIGHT = VIEWPORT.height * RENDER_SCALE
const WALK_FRAME_COUNT = 4

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
}

type InteractApiResult = {
  responseText: string
  decision?: "ok" | "not_ok"
  action?: unknown
  memoryUpdate: ConversationEntry
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
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
  const imagesRef = useRef<Record<string, HTMLImageElement> | null>(null)
  const [ready, setReady] = useState(false)
  const [player, setPlayer] = useState({
    x: PLAYER_SPAWN.x,
    y: PLAYER_SPAWN.y,
    walkFrame: 0,
  })
  const [facing, setFacing] = useState<Direction>(PLAYER_SPAWN.facing)
  const [npcFacings, setNpcFacings] = useState(INITIAL_NPC_FACINGS)
  const [speechBubble, setSpeechBubble] = useState<SpeechBubble | null>(null)
  const [customDialogueMessage, setCustomDialogueMessage] = useState("")
  // 스튜디오 iframe(?embed=1)에 들어갈 때는 타이틀/설명을 숨기고 검은 패딩만 남긴다.
  const embed = useSearchParams().get("embed") === "1"

  const camera = useMemo(
    () =>
      cameraForPlayer(
        {
          worldX: player.x * TILE_PX + TILE_PX / 2,
          worldY: player.y * TILE_PX + TILE_PX / 2,
        },
        WORLD,
        VIEWPORT
      ),
    [player]
  )

  const movePlayer = useCallback((direction: Direction) => {
    setFacing(direction)
    setSpeechBubble(null)
    setPlayer((current) => {
      const result = attemptPlayerMove({
        map: WORLD,
        player: current,
        direction,
        occupiedPositions: NPC_POSITIONS,
      })
      return {
        ...result.position,
        walkFrame: result.moved
          ? (current.walkFrame + 1) % WALK_FRAME_COUNT
          : current.walkFrame,
      }
    })
  }, [])

  const npcEntities = useMemo(
    () =>
      entitiesFromSpawns({
        ...WORLD,
        spawnPoints: NPC_SPAWNS.map((spawn) => ({
          ...spawn,
          facing: npcFacings[spawn.id] ?? spawn.facing,
        })),
      }),
    [npcFacings]
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

    const npc = findFacingNpc(player, facing, NPC_POSITIONS)
    if (!npc) {
      setSpeechBubble(null)
      return
    }

    const npcId = npc.npcId ?? npc.id
    setNpcFacings((current) => ({
      ...current,
      [npc.id]: oppositeDirection(facing),
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
  }, [facing, player, speechBubble])

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
      })

      try {
        const response = await fetch("/api/agent/interact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            npcProfile: resolveWorldNPCProfile(npcId),
            npcMemory: loadNPCMemory(npcId),
            userMessage,
            gameState: WORLD_DIALOGUE_STATE,
            promptOverrides: loadPromptOverrides(),
          }),
        })

        if (!response.ok) {
          throw new Error(`Dialogue request failed with ${response.status}`)
        }

        const result = (await response.json()) as InteractApiResult
        appendConversationEntry(npcId, {
          timestamp: WORLD_DIALOGUE_STATE.clock.day * 1440 + WORLD_DIALOGUE_STATE.clock.currentMinute - 1,
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
    [speechBubble]
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const images: Record<string, HTMLImageElement> = {}
      for (const [id, url] of Object.entries(ATLAS_IMAGES)) {
        images[id] = await loadImage(url)
      }
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
      elevation: WORLD.elevation[player.y]?.[player.x] ?? 0,
      spriteHeightPx: TILE_PX,
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    renderTileMap(
      ctx,
      { map: WORLD, camera, entities: [...npcEntities, playerEntity] },
      { images }
    )
  }, [camera, facing, npcEntities, player])

  useEffect(() => {
    if (ready) render()
  }, [ready, render])

  const bubblePosition = useMemo(() => {
    if (!speechBubble) return null
    const elevation = WORLD.elevation[speechBubble.gridY]?.[speechBubble.gridX] ?? 0
    const screen = gridToScreen(speechBubble.gridX, speechBubble.gridY, elevation, camera)
    const width = 380
    return {
      width,
      left: clamp(screen.x * RENDER_SCALE + (TILE_PX * RENDER_SCALE) / 2 - width / 2, 12, STAGE_WIDTH - width - 12),
      top: clamp(screen.y * RENDER_SCALE - 118, 12, STAGE_HEIGHT - 150),
    }
  }, [camera, speechBubble])

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
          World — 200x200 랜덤 맵 + 추적 카메라 + NPC
        </h1>
      )}
      {!embed && (
        <p style={{ fontFamily: "monospace", color: "#aaa", fontSize: 13 }}>
          방향키 / WASD로 이동, E로 바라보는 NPC와 상호작용.
        </p>
      )}

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

        {speechBubble && bubblePosition ? (
          <div
            role="status"
            style={{
              position: "absolute",
              left: bubblePosition.left,
              top: bubblePosition.top,
              width: bubblePosition.width,
              boxSizing: "border-box",
              border: "4px solid #45455a",
              background: "#f7f7ff",
              boxShadow: "inset 0 0 0 2px #b7b8cc, 4px 4px 0 rgba(0, 0, 0, 0.35)",
              color: "#3a3a4a",
              fontFamily: "monospace",
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1.35,
              minHeight: 108,
              padding: "16px 42px 18px 18px",
              textShadow: "1px 1px 0 #d7d8e8",
            }}
          >
            <div style={{ color: "#696a84", fontSize: 12, marginBottom: 4 }}>
              {speechBubble.npcId}
              {speechBubble.pages.length > 1
                ? ` ${speechBubble.pageIndex + 1}/${speechBubble.pages.length}`
                : ""}
            </div>
            {speechBubble.pages[speechBubble.pageIndex]}
            {speechBubble.choices ? (
              <div
                aria-label="Dialogue choices"
                style={{
                  display: "grid",
                  gap: 6,
                  marginTop: 14,
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
                right: 12,
                bottom: 10,
                width: 0,
                height: 0,
                borderLeft: "7px solid transparent",
                borderRight: "7px solid transparent",
                borderTop: "12px solid #6c6d82",
              }}
            />
          </div>
        ) : null}

        <div
          aria-label="Movement and interaction controls"
          style={{
            position: "absolute",
            right: 16,
            bottom: 16,
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
