import {
  DEFAULT_LLM_MODEL_SELECTION,
  normalizeLLMModelSelection,
  type LLMModelSelection,
} from "@/game-core/agent/llm-models"

export const LLM_SETTINGS_KEY = "hometown:llm-settings"

export type LLMSettings = {
  modelSelection: LLMModelSelection
}

export function loadLLMSettings(): LLMSettings {
  if (typeof window === "undefined") {
    return { modelSelection: DEFAULT_LLM_MODEL_SELECTION }
  }

  try {
    const stored = window.localStorage.getItem(LLM_SETTINGS_KEY)
    if (!stored) return { modelSelection: DEFAULT_LLM_MODEL_SELECTION }
    const parsed = JSON.parse(stored) as Partial<LLMSettings>
    return { modelSelection: normalizeLLMModelSelection(parsed.modelSelection) }
  } catch {
    return { modelSelection: DEFAULT_LLM_MODEL_SELECTION }
  }
}

export function saveLLMSettings(settings: LLMSettings): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    LLM_SETTINGS_KEY,
    JSON.stringify({
      modelSelection: normalizeLLMModelSelection(settings.modelSelection),
    })
  )
}
