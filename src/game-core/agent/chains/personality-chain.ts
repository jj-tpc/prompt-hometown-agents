import { ChatOpenAI } from "@langchain/openai"
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"

const schema = z.object({
  compatible: z.boolean(),
  reason: z.string(),
})

const systemTemplate = `You are evaluating whether a request is compatible with this NPC's personality and history.

NPC Name: {name}
Personality: {personality}
Dislikes: {dislikeds}
Habits: {habits}
Relationship score with user: {relationshipScore}

Recent conversation history:
{history}

Respond in Korean. Determine if the request conflicts with the NPC's character or past interactions.`

export async function runPersonalityChain(
  userRequest: string,
  profile: NPCProfile,
  memory: NPCMemory
): Promise<{ compatible: boolean; reason: string }> {
  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0,
  }).withStructuredOutput(schema)

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemTemplate],
    ["human", "{userRequest}"],
  ])

  const chain = prompt.pipe(model)
  const contextSize = parseInt(process.env.HISTORY_CONTEXT_SIZE ?? "10")
  const recentHistory = memory.conversationHistory
    .slice(-contextSize)
    .map((e) => `[${e.speaker}] ${e.message}${e.decision ? ` (${e.decision})` : ""}`)
    .join("\n")

  return chain.invoke({
    name: profile.name,
    personality: profile.personality.join(", "),
    dislikeds: profile.dislikeds.join(", "),
    habits: profile.habits
      .map((h) => `${h.action} at ${h.location} around ${h.gameHour}:00`)
      .join(", "),
    relationshipScore: memory.relationshipScore,
    history: recentHistory || "(없음)",
    userRequest,
  })
}
