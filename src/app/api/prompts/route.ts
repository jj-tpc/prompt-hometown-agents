import { NextResponse } from "next/server"
import { loadPrompt } from "@/game-core/agent/prompts/load-prompt"

// 원본 .txt 프롬프트의 기본값을 반환한다. 스튜디오 에디터의 "리셋" 기준값.
export async function GET() {
  return NextResponse.json({
    interact: loadPrompt("interact.txt"),
    validate: loadPrompt("validate.txt"),
    personality: loadPrompt("personality.txt"),
    failure: loadPrompt("failure.txt"),
    decision: loadPrompt("decision.txt"),
  })
}
