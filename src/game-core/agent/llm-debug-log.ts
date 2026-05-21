import type { AgentPipelineStage } from "@/game-core/agent/interact"
import type { LLMModelDebugInfo } from "@/game-core/agent/llm-models"

const MAX_STRING_LENGTH = 4000
const REDACTED_KEYS = new Set([
  "apiKey",
  "apikey",
  "api_key",
  "authorization",
  "bearer",
  "key",
  "password",
  "secret",
  "token",
])

type LLMLogPayload = {
  model: LLMModelDebugInfo
  input?: unknown
  output?: unknown
  error?: unknown
}

export function logLLMRequest(
  stage: AgentPipelineStage,
  payload: Omit<LLMLogPayload, "output" | "error">
) {
  logLLM("request", stage, payload)
}

export function logLLMResponse(
  stage: AgentPipelineStage,
  payload: Omit<LLMLogPayload, "input" | "error">
) {
  logLLM("response", stage, payload)
}

export function logLLMError(
  stage: AgentPipelineStage,
  payload: Omit<LLMLogPayload, "input" | "output">
) {
  logLLM("error", stage, payload)
}

function logLLM(kind: "request" | "response" | "error", stage: AgentPipelineStage, payload: LLMLogPayload) {
  if (process.env.NODE_ENV === "test") {
    return
  }

  const message = `[LLM][${stage}] ${kind}`
  const safePayload = sanitizeForLog(payload)

  if (kind === "error") {
    console.error(message, safePayload)
    return
  }

  console.info(message, safePayload)
}

function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return "[MaxDepth]"
  }

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}... [truncated ${value.length - MAX_STRING_LENGTH} chars]`
      : value
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, depth + 1))
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        shouldRedactKey(key) ? "[REDACTED]" : sanitizeForLog(item, depth + 1),
      ])
    )
  }

  return String(value)
}

function shouldRedactKey(key: string): boolean {
  return REDACTED_KEYS.has(key.toLowerCase())
}
