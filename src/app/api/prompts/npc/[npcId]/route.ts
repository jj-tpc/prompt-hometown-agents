import { NextRequest, NextResponse } from "next/server"
import { loadNpcCharacterPromptDefault } from "@/game-core/agent/prompts/load-prompt"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ npcId: string }> }
) {
  const { npcId } = await params
  const content = loadNpcCharacterPromptDefault(npcId)
  return NextResponse.json({ content })
}
