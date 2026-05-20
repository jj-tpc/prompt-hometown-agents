"use client"

import { useEffect, useRef } from "react"
import { ATLAS_IMAGE_GROUPS, type AtlasImageCategory } from "@/game-core/render/terrain-tiles"

const SCALE = 6
const SUBTILE = 8
const TILE = 16
const PAD = 18

type Sheet = { category: AtlasImageCategory; id: string; src: string }

const SHEETS: Sheet[] = (Object.keys(ATLAS_IMAGE_GROUPS) as AtlasImageCategory[]).flatMap(
  (category) =>
    Object.entries(ATLAS_IMAGE_GROUPS[category]).map(([id, src]) => ({
      category,
      id,
      src,
    }))
)

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
      <h2 style={{ fontFamily: "monospace", color: "#eee", fontSize: 15 }}>
        {sheet.category} / {sheet.id}
      </h2>
      <p style={{ fontFamily: "monospace", color: "#aaa", fontSize: 12 }}>{sheet.src}</p>
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
        Grouped by editor layer. Yellow grid is 16px, white grid is 8px.
      </p>
      {SHEETS.map((sheet) => (
        <TilesetInspector key={sheet.src} sheet={sheet} />
      ))}
    </main>
  )
}
