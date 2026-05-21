import { ChatPromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import { logLLMError, logLLMRequest, logLLMResponse } from "@/game-core/agent/llm-debug-log"
import { createChatModel, getLLMModelDebugInfo, type LLMModelSelection } from "@/game-core/agent/llm-models"
import { loadPrompt } from "@/game-core/agent/prompts/load-prompt"
import type { GameState } from "@/game-core/types/game"

const schema = z.object({
  valid: z.boolean(),
  reason: z.string(),
})

const systemTemplate = loadPrompt("validate.txt")

export async function runValidateChain(
  userRequest: string,
  gameState: GameState,
  systemPromptOverride?: string,
  modelSelection?: LLMModelSelection
): Promise<{ valid: boolean; reason: string }> {
  const temperature = 0
  const modelInfo = getLLMModelDebugInfo({ modelSelection, temperature })
  const model = createChatModel({ modelSelection, temperature }).withStructuredOutput(schema)

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPromptOverride ?? systemTemplate],
    ["human", "{userRequest}"],
  ])

  const chain = prompt.pipe(model)
  const hour = Math.floor(gameState.clock.currentMinute / 60)
  const minute = gameState.clock.currentMinute % 60

  const input = {
    locations: gameState.availableLocations.join(", "),
    items: gameState.availableItems.map((i) => `${i.name}(${i.quantity}개)`).join(", "),
    day: gameState.clock.day,
    hour: String(hour).padStart(2, "0"),
    minute: String(minute).padStart(2, "0"),
    userRequest,
  }

  logLLMRequest("validate", {
    model: modelInfo,
    input: {
      systemPrompt: systemPromptOverride ?? systemTemplate,
      variables: input,
    },
  })

  try {
    const result = await chain.invoke(input)
    logLLMResponse("validate", { model: modelInfo, output: result })

    return result
  } catch (error) {
    logLLMError("validate", { model: modelInfo, error })
    throw error
  }
}
