import { ChatOpenAI } from "@langchain/openai"
import { ChatPromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import type { NPCProfile } from "@/game-core/types/npc"
import type { NPCAction } from "@/game-core/types/game"

const schema = z.object({
  decision: z.enum(["ok", "not_ok"]),
  responseText: z.string(),
  action: z
    .union([
      z.object({ type: z.literal("give_item"), itemId: z.string(), quantity: z.number() }),
      z.object({ type: z.literal("move_to"), targetNpcId: z.string() }),
      z.null(),
    ])
    .nullable()
    .optional(),
})

const systemTemplate = `You are generating a response for an NPC in a game.

NPC Name: {name}
Speech style: {speechStyle}
Personality: {personality}

Validation result: {validateResult}
Personality check result: {personalityResult}

Decide if the NPC accepts (ok) or declines (not_ok) the request.
Write responseText in Korean using the NPC's speech style.
If decision is ok and the request involves giving an item, include action with type "give_item".
If decision is ok and the request involves going to meet another NPC, include action with type "move_to".
Otherwise omit or set action to null.`

export async function runDecisionChain(
  userRequest: string,
  profile: NPCProfile,
  validateResult: { valid: boolean; reason: string },
  personalityResult: { compatible: boolean; reason: string }
): Promise<{ decision: "ok" | "not_ok"; responseText: string; action?: NPCAction }> {
  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.7,
  }).withStructuredOutput(schema)

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemTemplate],
    ["human", "{userRequest}"],
  ])

  const chain = prompt.pipe(model)
  const raw = await chain.invoke({
    name: profile.name,
    speechStyle: profile.speechStyle,
    personality: profile.personality.join(", "),
    validateResult: `valid=${validateResult.valid}, reason: ${validateResult.reason}`,
    personalityResult: `compatible=${personalityResult.compatible}, reason: ${personalityResult.reason}`,
    userRequest,
  })

  return {
    decision: raw.decision,
    responseText: raw.responseText,
    action: raw.action ?? undefined,
  }
}
