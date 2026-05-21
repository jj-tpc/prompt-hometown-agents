import { NextResponse } from "next/server"
import { loadMap } from "@/game-core/map/loader"
import { serverListMaps, serverSaveMap } from "./map-store"

export async function GET() {
  return NextResponse.json(serverListMaps())
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  try {
    const map = loadMap((body as { map: unknown })?.map)
    const summary = serverSaveMap(map)
    return NextResponse.json(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid map"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
