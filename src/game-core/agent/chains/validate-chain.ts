import { ChatOpenAI } from "@langchain/openai"
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import { loadPrompt } from "@/game-core/agent/prompts/load-prompt"
import type { GameState } from "@/game-core/types/game"

const schema = z.object({
  valid: z.boolean(),
  reason: z.string(),
})

const systemTemplate = loadPrompt("validate.txt")

export async function runValidateChain(
  userRequest: string,
  gameState: GameState
): Promise<{ valid: boolean; reason: string }> {
  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0,
  }).withStructuredOutput(schema)

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemTemplate],
    ["human", "{userRequest}"],
  ])

  const chain = prompt.pipe(model)
  const hour = Math.floor(gameState.clock.currentMinute / 60)
  const minute = gameState.clock.currentMinute % 60

  return chain.invoke({
    locations: gameState.availableLocations.join(", "),
    items: gameState.availableItems.map((i) => `${i.name}(${i.quantity}개)`).join(", "),
    day: gameState.clock.day,
    hour: String(hour).padStart(2, "0"),
    minute: String(minute).padStart(2, "0"),
    userRequest,
  })
}
