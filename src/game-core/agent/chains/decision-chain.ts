import { ChatPromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import { logLLMError, logLLMRequest, logLLMResponse } from "@/game-core/agent/llm-debug-log"
import { createChatModel, getLLMModelDebugInfo, type LLMModelSelection } from "@/game-core/agent/llm-models"
import { loadPrompt } from "@/game-core/agent/prompts/load-prompt"
import type { NPCProfile } from "@/game-core/types/npc"
import type { NPCAction } from "@/game-core/types/game"

const destinationKindSchema = z.enum(["house", "forest", "sand", "waterfront", "grass"])

const schema = z.object({
  decision: z.enum(["ok", "not_ok"]),
  responseText: z.string(),
  action: z
    .union([
      z.object({ type: z.literal("give_item"), itemId: z.string(), quantity: z.number() }),
      z.object({ type: z.literal("move_to"), targetNpcId: z.string() }),
      z.object({ type: z.literal("move_to_tile"), destinationKind: destinationKindSchema }),
      z.object({ type: z.literal("follow_player") }),
      z.null(),
    ])
    .nullable()
    .optional(),
})

const systemTemplate = loadPrompt("decision.txt")

export type DecisionFailureStage = "validate" | "personality"

export type DecisionGuardResult = {
  compatible: boolean
  reason: string
  failureStage?: DecisionFailureStage
}

function resolveFailureStage(
  validateResult: { valid: boolean; reason: string },
  guardResult: DecisionGuardResult
): DecisionFailureStage | "none" {
  if (!validateResult.valid) return guardResult.failureStage ?? "validate"
  if (!guardResult.compatible) return guardResult.failureStage ?? "personality"
  return "none"
}

function guidanceForFailureStage(stage: DecisionFailureStage | "none"): string {
  if (stage === "validate") {
    return [
      "The request failed the physical/world-rule validation, not the NPC personality check.",
      "Decline because the request is impossible in this village/world state.",
      "Do not invent a personality or prohibited-behavior reason.",
      "A natural Korean direction is: '내가 사는 곳에서는 그 부탁을 들어주는 게 불가능할 것 같아.'",
    ].join(" ")
  }

  if (stage === "personality") {
    return [
      "The request is physically possible, but it conflicts with the NPC personality, relationship, or prohibited behavior.",
      "Decline in the NPC's persona and explain the persona/prohibition-based reason.",
    ].join(" ")
  }

  return "No failure. If the request is acceptable, respond naturally and include any required action."
}

export async function runDecisionChain(
  userRequest: string,
  profile: NPCProfile,
  validateResult: { valid: boolean; reason: string },
  personalityResult: DecisionGuardResult,
  systemPromptOverride?: string,
  modelSelection?: LLMModelSelection
): Promise<{ decision: "ok" | "not_ok"; responseText: string; action?: NPCAction }> {
  const temperature = 0.7
  const modelInfo = getLLMModelDebugInfo({ modelSelection, temperature })
  const model = createChatModel({ modelSelection, temperature }).withStructuredOutput(schema)

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPromptOverride ?? systemTemplate],
    ["human", "{userRequest}"],
  ])

  const chain = prompt.pipe(model)
  const requestFailureStage = resolveFailureStage(validateResult, personalityResult)
  const input = {
    name: profile.name,
    speechStyle: profile.speechStyle,
    personality: profile.personality.join(", "),
    validateResult: `valid=${validateResult.valid}, reason: ${validateResult.reason}`,
    personalityResult:
      `compatible=${personalityResult.compatible}, ` +
      `failureStage=${personalityResult.failureStage ?? "none"}, ` +
      `reason: ${personalityResult.reason}`,
    requestFailureStage,
    failureGuidance: guidanceForFailureStage(requestFailureStage),
    userRequest,
  }

  logLLMRequest("decision", {
    model: modelInfo,
    input: {
      systemPrompt: systemPromptOverride ?? systemTemplate,
      variables: input,
    },
  })

  let raw: z.infer<typeof schema>
  try {
    raw = await chain.invoke(input)
    logLLMResponse("decision", { model: modelInfo, output: raw })
  } catch (error) {
    logLLMError("decision", { model: modelInfo, error })
    throw error
  }

  return {
    decision: raw.decision,
    responseText: raw.responseText,
    action: raw.action ?? undefined,
  }
}
