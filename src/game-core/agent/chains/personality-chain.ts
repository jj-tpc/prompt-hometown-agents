import { ChatOpenAI } from "@langchain/openai"
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import { loadPrompt } from "@/game-core/agent/prompts/load-prompt"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"

const schema = z.object({
  prohibitViolated: z.boolean(),
  compatible: z.boolean(),
  reason: z.string(),
})

const systemTemplate = loadPrompt("personality.txt")

export async function runPersonalityChain(
  userRequest: string,
  profile: NPCProfile,
  memory: NPCMemory,
  systemPromptOverride?: string
): Promise<{ prohibitViolated: boolean; compatible: boolean; reason: string }> {
  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0,
  }).withStructuredOutput(schema)

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

  const result = await chain.invoke({
    name: profile.name,
    personality: profile.personality.join(", "),
    dislikeds: profile.dislikeds.join(", "),
    habits: profile.habits
      .map((h) => `${h.action} at ${h.location} around ${h.gameHour}:00`)
      .join(", "),
    prohibitBehavior: profile.prohibitBehavior ?? profile.dislikeds.join("; "),
    habitBehavior: profile.habitBehavior ?? "(none)",
    relationshipScore: memory.relationshipScore,
    history: recentHistory || "(없음)",
    userRequest,
  })

  // prohibitViolated=true면 LLM 판단과 무관하게 코드 레벨에서 compatible=false 강제
  return result.prohibitViolated ? { ...result, compatible: false } : result
}
