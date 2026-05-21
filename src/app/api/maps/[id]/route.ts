import { NextResponse } from "next/server"
import { serverLoadMap, serverDeleteMap } from "../map-store"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const map = serverLoadMap(id)
  if (!map) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(map)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  serverDeleteMap(id)
  return NextResponse.json({ ok: true })
}
