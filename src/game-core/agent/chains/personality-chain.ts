import { ChatPromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import { logLLMError, logLLMRequest, logLLMResponse } from "@/game-core/agent/llm-debug-log"
import { createChatModel, getLLMModelDebugInfo, type LLMModelSelection } from "@/game-core/agent/llm-models"
import { loadPrompt } from "@/game-core/agent/prompts/load-prompt"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"

const schema = z.object({
  compatible: z.boolean(),
  reason: z.string(),
})

const systemTemplate = loadPrompt("personality.txt")

export async function runPersonalityChain(
  userRequest: string,
  profile: NPCProfile,
  memory: NPCMemory,
  systemPromptOverride?: string,
  modelSelection?: LLMModelSelection
): Promise<{ compatible: boolean; reason: string }> {
  const temperature = 0
  const modelInfo = getLLMModelDebugInfo({ modelSelection, temperature })
  const model = createChatModel({ modelSelection, temperature }).withStructuredOutput(schema)

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPromptOverride ?? systemTemplate],
    ["human", "{userRequest}"],
  ])

  const chain = prompt.pipe(model)
  const contextSize = parseInt(process.env.HISTORY_CONTEXT_SIZE ?? "10")
  const recentHistory = memory.conversationHistory
    .slice(-contextSize)
    .map((e) => `[${e.speaker}] ${e.message}${e.decision ? ` (${e.decision})` : ""}`)
    .join("\n")

  const input = {
    name: profile.name,
    personality: profile.personality.join(", "),
    dislikeds: profile.dislikeds.join(", "),
    habits: profile.habits
      .map((h) => `${h.action} at ${h.location} around ${h.gameHour}:00`)
      .join(", "),
    habitBehavior: profile.habitBehavior ?? "(none)",
    prohibitBehavior: profile.prohibitBehavior ?? "(none)",
    relationshipScore: memory.relationshipScore,
    history: recentHistory || "(없음)",
    userRequest,
  }

  logLLMRequest("personality", {
    model: modelInfo,
    input: {
      systemPrompt: systemPromptOverride ?? systemTemplate,
      variables: input,
    },
  })

  try {
    const result = await chain.invoke(input)
    logLLMResponse("personality", { model: modelInfo, output: result })

    return result
  } catch (error) {
    logLLMError("personality", { model: modelInfo, error })
    throw error
  }
}
