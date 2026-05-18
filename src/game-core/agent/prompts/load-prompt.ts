import fs from "fs"
import path from "path"

export function loadPrompt(filename: string): string {
  const promptPath = path.join(process.cwd(), "src/game-core/agent/prompts", filename)
  try {
    return fs.readFileSync(promptPath, "utf-8").trim()
  } catch (cause) {
    throw new Error(
      `프롬프트 파일 "${filename}"을 ${promptPath} 에서 읽지 못했습니다. ` +
        `배포 산출물에 이 파일이 포함되었는지 확인하세요 ` +
        `(next.config.ts의 outputFileTracingIncludes 참고). 원인: ${String(cause)}`
    )
  }
}

// NPC 캐릭터 프롬프트 파일 로드. 파일이 없으면 빈 문자열 반환 (에러 없음).
export function loadNpcCharacterPromptDefault(key: string): string {
  const promptPath = path.join(
    process.cwd(),
    "src/game-core/agent/prompts/npcs",
    `${key}.txt`
  )
  try {
    return fs.readFileSync(promptPath, "utf-8").trim()
  } catch {
    return ""
  }
}
