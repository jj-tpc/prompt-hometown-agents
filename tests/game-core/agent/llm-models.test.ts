import {
  DEFAULT_LLM_MODEL_SELECTION,
  GEMINI_35_FLASH_MODEL_ID,
  GEMINI_OPENAI_BASE_URL,
  createChatModel,
  normalizeLLMModelSelection,
} from "@/game-core/agent/llm-models"

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation((config) => ({ config })),
}))

const { ChatOpenAI } = jest.requireMock("@langchain/openai") as {
  ChatOpenAI: jest.Mock
}

beforeEach(() => {
  ChatOpenAI.mockClear()
  delete process.env.OPENAI_MODEL
  delete process.env.GOOGLE_API_KEY
})

it("normalizes unsupported model selections to the OpenAI default", () => {
  expect(normalizeLLMModelSelection("unknown-model")).toBe(DEFAULT_LLM_MODEL_SELECTION)
  expect(normalizeLLMModelSelection(GEMINI_35_FLASH_MODEL_ID)).toBe(GEMINI_35_FLASH_MODEL_ID)
})

it("creates the default OpenAI chat model from OPENAI_MODEL or fallback", () => {
  process.env.OPENAI_MODEL = "gpt-custom"

  createChatModel({ modelSelection: DEFAULT_LLM_MODEL_SELECTION, temperature: 0.2 })

  expect(ChatOpenAI).toHaveBeenCalledWith({
    model: "gpt-custom",
    temperature: 0.2,
  })
})

it("creates Gemini 3.5 Flash through the Gemini OpenAI-compatible endpoint", () => {
  process.env.GOOGLE_API_KEY = "google-key"

  createChatModel({ modelSelection: GEMINI_35_FLASH_MODEL_ID, temperature: 0.8 })

  expect(ChatOpenAI).toHaveBeenCalledWith({
    apiKey: "google-key",
    configuration: {
      baseURL: GEMINI_OPENAI_BASE_URL,
    },
    model: GEMINI_35_FLASH_MODEL_ID,
    temperature: 0.8,
  })
})
