import { ChatPromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import { logLLMError, logLLMRequest, logLLMResponse } from "@/game-core/agent/llm-debug-log"
import { createChatModel, getLLMModelDebugInfo, type LLMModelSelection } from "@/game-core/agent/llm-models"
import { loadPrompt } from "@/game-core/agent/prompts/load-prompt"

const schema = z.object({
  isRequest: z.boolean(),
  reason: z.string(),
})

const systemTemplate = loadPrompt("request-classifier.txt")

export async function runRequestClassifierChain(
  userMessage: string,
  modelSelection?: LLMModelSelection
): Promise<{ isRequest: boolean; reason: string }> {
  const temperature = 0
  const modelInfo = getLLMModelDebugInfo({ modelSelection, temperature })
  const model = createChatModel({ modelSelection, temperature }).withStructuredOutput(schema)

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemTemplate],
    ["human", "{userMessage}"],
  ])
  const chain = prompt.pipe(model)
  const input = { userMessage }

  logLLMRequest("request", {
    model: modelInfo,
    input: {
      systemPrompt: systemTemplate,
      variables: input,
    },
  })

  try {
    const result = await chain.invoke(input)
    logLLMResponse("request", { model: modelInfo, output: result })

    return result
  } catch (error) {
    logLLMError("request", { model: modelInfo, error })
    throw error
  }
}
