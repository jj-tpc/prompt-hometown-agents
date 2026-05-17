"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { loadMap } from "@/game-core/map/loader"
import { generateRandomTerrain } from "@/game-core/map/random-terrain"
import { canTraverse } from "@/game-core/map/traversal"
import { cameraForPlayer } from "@/game-core/render/camera"
import { ATLAS_IMAGES, SPRITE_ATLAS } from "@/game-core/render/terrain-tiles"
import { gridToScreen, renderTileMap } from "@/game-core/render/tilemap-renderer"
import { RENDER_SCALE, TILE_PX } from "@/game-core/render/types"

// 200×200 랜덤 맵 — 모듈 로드 시 1회 생성.
const WORLD = loadMap(generateRandomTerrain(200, 200))
const SPAWN = WORLD.spawnPoints[0]

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

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    renderTileMap(ctx, { map: WORLD, camera }, { images })

    // 플레이어 스프라이트 (임시 — 기본 캐릭터 정면 프레임. 본 캐릭터 구현은 다음 파트)
    const sp = SPRITE_ATLAS["entity:player:front"]
    const charImg = images[sp.atlasId]
    if (charImg) {
      const s = gridToScreen(player.x, player.y, 0, camera)
      const tileDp = TILE_PX * RENDER_SCALE
      const destW = sp.sw * RENDER_SCALE // 스프라이트 자연 비율 유지
      const destH = sp.sh * RENDER_SCALE
      ctx.drawImage(
        charImg,
        sp.sx, sp.sy, sp.sw, sp.sh,
        s.x * RENDER_SCALE + tileDp / 2 - destW / 2, // 타일 가로 중앙
        s.y * RENDER_SCALE + tileDp - destH, // 발밑을 타일 바닥에 맞춤
        destW, destH
      )
    }
  }, [player])

  useEffect(() => {
    if (ready) render()
  }, [ready, render])

  return (
    <main style={{ background: "#1a1a24", minHeight: "100vh", padding: 24 }}>
      <h1 style={{ fontFamily: "monospace", color: "#fff", fontSize: 18 }}>
        World — 200×200 랜덤 맵 + 추적 카메라
      </h1>
      <p style={{ fontFamily: "monospace", color: "#aaa", fontSize: 13 }}>
        방향키 / WASD로 캐릭터 이동. 카메라가 따라가며 맵 일부만 보여줌. 캐릭터는 임시 스프라이트.
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
