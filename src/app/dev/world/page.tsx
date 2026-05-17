"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { loadMap } from "@/game-core/map/loader"
import { generateRandomTerrain } from "@/game-core/map/random-terrain"
import { canTraverse } from "@/game-core/map/traversal"
import { cameraForPlayer } from "@/game-core/render/camera"
import { entitiesFromSpawns } from "@/game-core/render/entities"
import { ATLAS_IMAGES } from "@/game-core/render/terrain-tiles"
import { renderTileMap } from "@/game-core/render/tilemap-renderer"
import { RENDER_SCALE, TILE_PX, type RenderEntity } from "@/game-core/render/types"

// 200×200 랜덤 맵 — 모듈 로드 시 1회 생성.
const WORLD = loadMap(generateRandomTerrain(200, 200))
const SPAWN = WORLD.spawnPoints[0]

// 플레이어를 제외한 NPC 엔티티 (정적).
const NPC_ENTITIES = entitiesFromSpawns(WORLD).filter((e) => e.id !== SPAWN.id)

// 화면에 보이는 타일 수 (뷰포트). 카메라가 이 창만 보여준다.
const VIEW_TILES_W = 20
const VIEW_TILES_H = 13
const VIEWPORT = { width: VIEW_TILES_W * TILE_PX, height: VIEW_TILES_H * TILE_PX }

const KEY_DIRS: Record<string, { dx: number; dy: number }> = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  w: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export default function WorldPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<Record<string, HTMLImageElement> | null>(null)
  const [ready, setReady] = useState(false)
  const [player, setPlayer] = useState({ x: SPAWN.x, y: SPAWN.y })

  // 아틀라스 이미지 1회 로드
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

  // 방향키 / WASD 이동 — canTraverse로 통행 게이트
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_DIRS[e.key]
      if (!dir) return
      e.preventDefault()
      setPlayer((p) => {
        const next = { x: p.x + dir.dx, y: p.y + dir.dy }
        return canTraverse(WORLD, p, next) ? next : p
      })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const images = imagesRef.current
    if (!canvas || !images) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const camera = cameraForPlayer(
      {
        worldX: player.x * TILE_PX + TILE_PX / 2,
        worldY: player.y * TILE_PX + TILE_PX / 2,
      },
      WORLD,
      VIEWPORT
    )

    // 플레이어 엔티티는 라이브 위치, NPC는 정적. 렌더러가 Y-sort로 함께 그린다.
    const playerEntity: RenderEntity = {
      id: "player",
      spriteId: "entity:player:front",
      gridX: player.x,
      gridY: player.y,
      elevation: WORLD.elevation[player.y]?.[player.x] ?? 0,
      spriteHeightPx: TILE_PX,
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    renderTileMap(
      ctx,
      { map: WORLD, camera, entities: [...NPC_ENTITIES, playerEntity] },
      { images }
    )
  }, [player])

  useEffect(() => {
    if (ready) render()
  }, [ready, render])

  return (
    <main style={{ background: "#1a1a24", minHeight: "100vh", padding: 24 }}>
      <h1 style={{ fontFamily: "monospace", color: "#fff", fontSize: 18 }}>
        World — 200×200 랜덤 맵 + 추적 카메라 + NPC
      </h1>
      <p style={{ fontFamily: "monospace", color: "#aaa", fontSize: 13 }}>
        방향키 / WASD로 이동. NPC와 플레이어는 렌더러가 Y-sort로 함께 그림. (임시 스프라이트)
      </p>
      <canvas
        ref={canvasRef}
        width={VIEW_TILES_W * TILE_PX * RENDER_SCALE}
        height={VIEW_TILES_H * TILE_PX * RENDER_SCALE}
        style={{ imageRendering: "pixelated", border: "1px solid #444" }}
      />
    </main>
  )
}
