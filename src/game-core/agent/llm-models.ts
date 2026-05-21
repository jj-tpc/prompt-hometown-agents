import { ChatOpenAI } from "@langchain/openai"

export const DEFAULT_LLM_MODEL_SELECTION = "openai-default"
export const GEMINI_35_FLASH_MODEL_ID = "gemini-3.5-flash"
export const GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

export type LLMModelSelection =
  | typeof DEFAULT_LLM_MODEL_SELECTION
  | typeof GEMINI_35_FLASH_MODEL_ID

export const LLM_MODEL_OPTIONS: { id: LLMModelSelection; label: string; hint: string }[] = [
  {
    id: DEFAULT_LLM_MODEL_SELECTION,
    label: "OpenAI 기본값",
    hint: "OPENAI_MODEL 환경변수 또는 gpt-4o-mini",
  },
  {
    id: GEMINI_35_FLASH_MODEL_ID,
    label: "Gemini 3.5 Flash",
    hint: "GOOGLE_API_KEY + gemini-3.5-flash",
  },
]

export function normalizeLLMModelSelection(value: unknown): LLMModelSelection {
  return value === GEMINI_35_FLASH_MODEL_ID
    ? GEMINI_35_FLASH_MODEL_ID
    : DEFAULT_LLM_MODEL_SELECTION
}

export function createChatModel(params: {
  modelSelection?: LLMModelSelection
  temperature: number
}) {
  const modelSelection = normalizeLLMModelSelection(params.modelSelection)

  if (modelSelection === GEMINI_35_FLASH_MODEL_ID) {
    return new ChatOpenAI({
      apiKey: process.env.GOOGLE_API_KEY,
      configuration: {
        baseURL: GEMINI_OPENAI_BASE_URL,
      },
      model: GEMINI_35_FLASH_MODEL_ID,
      temperature: params.temperature,
    })
  }

  return new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: params.temperature,
  })
}
