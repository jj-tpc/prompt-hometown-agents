"use client"

import { useEffect, useRef } from "react"
import { TILE_PX, TILESETS, WATER_TILE } from "@/game-core/render/terrain-tiles"
import { grassAutotile } from "@/game-core/render/autotile"

const SCALE = 4

// 샘플 지형 맵 — G=grass, W=water. (잔디 섬 + 3×3 호수 + 만(灣) 모양 해안)
const MAP: string[] = [
  "WWWWWWWWWWWWWWWW",
  "WWGGGGGGGGGGGGWW",
  "WGGGGGGGGGGGGGGW",
  "WGGGGGGGWWWGGGGW",
  "WGGGGGGGWWWGGGGW",
  "WWWGGGGGWWWGGGGW",
  "WWGGGGGGGGGGGGGW",
  "WGGGGGGGGGGGGGGW",
  "WGGGGGGGGGGGGGGW",
  "WWGGGGGGGGGGGGWW",
  "WWWGGGGGGGGGGWWW",
  "WWWWWWWWWWWWWWWW",
]

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export default function TerrainPreviewPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rows = MAP.length
    const cols = MAP[0].length
    const dp = TILE_PX * SCALE
    canvas.width = cols * dp
    canvas.height = rows * dp
    ctx.imageSmoothingEnabled = false

    const inBounds = (x: number, y: number) =>
      y >= 0 && y < rows && x >= 0 && x < cols
    // 맵 밖은 잔디로 취급 (월드 경계에 잘린 가장자리 안 생기게)
    const isGrass = (x: number, y: number) =>
      !inBounds(x, y) || MAP[y][x] === "G"
    const isWater = (x: number, y: number) =>
      inBounds(x, y) && MAP[y][x] === "W"
    // 물 칸 + 물에 8방향 인접한 칸은 아래에 물을 깔아야 잔디 가장자리가 비친다
    const needsWaterBase = (x: number, y: number) => {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (isWater(x + dx, y + dy)) return true
        }
      }
      return false
    }

    let cancelled = false
    ;(async () => {
      const grass = await loadImage(TILESETS.grass)
      const water = await loadImage(TILESETS.water)
      if (cancelled) return

      const blit = (
        img: HTMLImageElement,
        col: number,
        row: number,
        cellX: number,
        cellY: number
      ) => {
        ctx.drawImage(
          img,
          col * TILE_PX, row * TILE_PX, TILE_PX, TILE_PX,
          cellX * dp, cellY * dp, dp, dp
        )
      }

      // pass 1: 물 베이스
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (needsWaterBase(x, y)) blit(water, WATER_TILE.col, WATER_TILE.row, x, y)
        }
      }

      // pass 2: 잔디 autotile (가장자리 조각의 투명부로 물이 비침)
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (MAP[y][x] !== "G") continue
          const t = grassAutotile(isGrass, x, y)
          blit(grass, t.col, t.row, x, y)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main style={{ background: "#1a1a24", minHeight: "100vh", padding: 24 }}>
      <h1 style={{ fontFamily: "monospace", color: "#fff", fontSize: 18 }}>
        Terrain Preview — 레이어드 autotiling
      </h1>
      <p style={{ fontFamily: "monospace", color: "#aaa", fontSize: 13 }}>
        물 베이스 + 잔디 3×3 autotile. 잔디 가장자리 조각의 투명부로 물가가 자연스럽게 생김.
      </p>
      <canvas
        ref={canvasRef}
        style={{ imageRendering: "pixelated", border: "1px solid #444" }}
      />
    </main>
  )
}
