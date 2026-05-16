"use client"

import { useEffect, useRef } from "react"

const SCALE = 6
const SUBTILE = 8
const TILE = 16
const PAD = 18

type Sheet = { name: string; src: string }

const SHEETS: Sheet[] = [
  { name: "grass.png (176×112)", src: "/assets/sprout-lands/tilesets/grass.png" },
  { name: "hills.png (176×144)", src: "/assets/sprout-lands/tilesets/hills.png" },
  { name: "water.png (64×16)", src: "/assets/sprout-lands/tilesets/water.png" },
  { name: "paths.png (64×64)", src: "/assets/sprout-lands/tilesets/paths.png" },
]

function TilesetInspector({ sheet }: { sheet: Sheet }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.src = sheet.src
    img.onload = () => {
      const w = img.width
      const h = img.height
      canvas.width = w * SCALE + PAD
      canvas.height = h * SCALE + PAD

      ctx.imageSmoothingEnabled = false
      ctx.fillStyle = "#2b2b3a"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, PAD, PAD, w * SCALE, h * SCALE)

      // 8px 서브셀 그리드 (얇은 흰선)
      ctx.strokeStyle = "rgba(255,255,255,0.22)"
      ctx.lineWidth = 1
      for (let x = 0; x <= w; x += SUBTILE) {
        ctx.beginPath()
        ctx.moveTo(PAD + x * SCALE, PAD)
        ctx.lineTo(PAD + x * SCALE, PAD + h * SCALE)
        ctx.stroke()
      }
      for (let y = 0; y <= h; y += SUBTILE) {
        ctx.beginPath()
        ctx.moveTo(PAD, PAD + y * SCALE)
        ctx.lineTo(PAD + w * SCALE, PAD + y * SCALE)
        ctx.stroke()
      }

      // 16px 타일 그리드 (굵은 노란선) + 좌표 라벨
      ctx.strokeStyle = "rgba(255,210,60,0.9)"
      ctx.lineWidth = 2
      ctx.fillStyle = "#ffd23c"
      ctx.font = "11px monospace"
      for (let x = 0; x <= w; x += TILE) {
        ctx.beginPath()
        ctx.moveTo(PAD + x * SCALE, PAD)
        ctx.lineTo(PAD + x * SCALE, PAD + h * SCALE)
        ctx.stroke()
        if (x < w) ctx.fillText(String(x / TILE), PAD + x * SCALE + 3, 13)
      }
      for (let y = 0; y <= h; y += TILE) {
        ctx.beginPath()
        ctx.moveTo(PAD, PAD + y * SCALE)
        ctx.lineTo(PAD + w * SCALE, PAD + y * SCALE)
        ctx.stroke()
        if (y < h) ctx.fillText(String(y / TILE), 3, PAD + y * SCALE + 13)
      }
    }
  }, [sheet])

  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{ fontFamily: "monospace", color: "#eee", fontSize: 15 }}>{sheet.name}</h2>
      <canvas ref={canvasRef} style={{ imageRendering: "pixelated", border: "1px solid #444" }} />
    </section>
  )
}

export default function TilesetDevPage() {
  return (
    <main style={{ background: "#1a1a24", minHeight: "100vh", padding: 24 }}>
      <h1 style={{ fontFamily: "monospace", color: "#fff", fontSize: 18 }}>
        Tileset Inspector
      </h1>
      <p style={{ fontFamily: "monospace", color: "#aaa", fontSize: 13 }}>
        노란선 = 16px 타일 격자 (숫자 = 타일 col/row), 흰선 = 8px 서브셀
      </p>
      {SHEETS.map((s) => (
        <TilesetInspector key={s.src} sheet={s} />
      ))}
    </main>
  )
}
