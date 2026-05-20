"use client"

import { useEffect, useRef } from "react"
import { demoTerrainMap } from "@/game-core/fixtures/demo-terrain-map"
import { loadMap } from "@/game-core/map/loader"
import { loadAtlasImages } from "@/game-core/render/atlas-image-loader"
import { ATLAS_IMAGES, atlasCategoryFor } from "@/game-core/render/terrain-tiles"
import { renderTileMap } from "@/game-core/render/tilemap-renderer"
import { RENDER_SCALE, TILE_PX } from "@/game-core/render/types"

const MAP = loadMap(demoTerrainMap())

export default function TerrainPreviewPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = MAP.width * TILE_PX * RENDER_SCALE
    canvas.height = MAP.height * TILE_PX * RENDER_SCALE

    let cancelled = false
    ;(async () => {
      const images = await loadAtlasImages(ATLAS_IMAGES, {
        transparentBlackFor: (id) => atlasCategoryFor(id) !== "character",
      })
      if (cancelled) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      renderTileMap(ctx, { map: MAP, camera: { x: 0, y: 0 } }, { images })
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main style={{ background: "#1a1a24", minHeight: "100vh", padding: 24 }}>
      <h1 style={{ fontFamily: "monospace", color: "#fff", fontSize: 18 }}>
        Terrain Preview — TileMap 렌더러
      </h1>
      <p style={{ fontFamily: "monospace", color: "#aaa", fontSize: 13 }}>
        demoTerrainMap을 renderTileMap으로 렌더 (ground → decoration → object → overlay)
      </p>
      <canvas
        ref={canvasRef}
        style={{ imageRendering: "pixelated", border: "1px solid #444" }}
      />
    </main>
  )
}
