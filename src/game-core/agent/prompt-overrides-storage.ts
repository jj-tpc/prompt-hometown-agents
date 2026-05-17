// 스튜디오 에디터(/studio)와 게임(/dev/world)을 잇는 localStorage 브리지.
// 에디터는 "저장"한 오버라이드를 여기에 기록하고, 게임은 요청 직전에 읽어 API로 보낸다.
import type { PromptOverrides } from "@/game-core/agent/prompt-overrides"

export const PROMPT_OVERRIDES_KEY = "hometown:prompt-overrides"

const OVERRIDE_FIELDS: (keyof PromptOverrides)[] = [
  "interact",
  "validate",
  "personality",
  "decision",
  "worldKnowledge",
]

// 빈 문자열 필드는 제거해 "오버라이드 없음(원본 파일 사용)"으로 처리한다.
function pruneEmpty(raw: PromptOverrides): PromptOverrides {
  const result: PromptOverrides = {}
  for (const field of OVERRIDE_FIELDS) {
    const value = raw[field]
    if (typeof value === "string" && value.trim() !== "") {
      result[field] = value
    }
  }
  return result
}

export function loadPromptOverrides(): PromptOverrides {
  if (typeof window === "undefined") return {}
  try {
    const stored = window.localStorage.getItem(PROMPT_OVERRIDES_KEY)
    if (!stored) return {}
    return pruneEmpty(JSON.parse(stored) as PromptOverrides)
  } catch {
    return {}
  }
}

export function savePromptOverrides(overrides: PromptOverrides): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(PROMPT_OVERRIDES_KEY, JSON.stringify(pruneEmpty(overrides)))
}
