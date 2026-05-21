import { ChatPromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import { logLLMError, logLLMRequest, logLLMResponse } from "@/game-core/agent/llm-debug-log"
import { createChatModel, getLLMModelDebugInfo, type LLMModelSelection } from "@/game-core/agent/llm-models"
import { loadPrompt } from "@/game-core/agent/prompts/load-prompt"
import type { NPCProfile } from "@/game-core/types/npc"

export type FailureResponseStage = "validate" | "personality"

type ValidateResult = {
  valid: boolean
  reason: string
}

type PersonalityResult = {
  compatible: boolean
  reason: string
}

const schema = z.object({
  responseText: z.string(),
})

const systemTemplate = loadPrompt("failure.txt")

function guidanceForFailureStage(stage: FailureResponseStage): string {
  if (stage === "validate") {
    return [
      "This is validation pipeline stage 1: physical/world-rule validation failed.",
      "The request is impossible in this town or current world state.",
      "Do not imply the NPC personally refuses the player.",
      "A natural Korean direction is: 내가 사는 곳에서는 그 부탁을 들어주는 게 불가능할 것 같아.",
    ].join(" ")
  }

  return [
    "This is validation pipeline stage 2: personality/prohibited-behavior validation failed.",
    "The request is physically possible, but it conflicts with the NPC's personality, dislikes, relationship, or prohibited behavior.",
    "Decline and filter the request in the NPC's own persona.",
  ].join(" ")
}

export async function runFailureResponseChain(params: {
  userRequest: string
  profile: NPCProfile
  failureStage: FailureResponseStage
  validateResult: ValidateResult
  personalityResult?: PersonalityResult
  systemPromptOverride?: string
  modelSelection?: LLMModelSelection
}): Promise<{ responseText: string }> {
  const {
    userRequest,
    profile,
    failureStage,
    validateResult,
    personalityResult,
    systemPromptOverride,
    modelSelection,
  } = params
  const temperature = 0.7
  const modelInfo = getLLMModelDebugInfo({ modelSelection, temperature })
  const model = createChatModel({ modelSelection, temperature }).withStructuredOutput(schema)

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPromptOverride ?? systemTemplate],
    ["human", "{userRequest}"],
  ])

  const input = {
    name: profile.name,
    speechStyle: profile.speechStyle,
    personality: profile.personality.join(", "),
    dislikeds: profile.dislikeds.join(", "),
    habitBehavior: profile.habitBehavior ?? "(none)",
    prohibitBehavior: profile.prohibitBehavior ?? "(none)",
    validateResult: `valid=${validateResult.valid}, reason: ${validateResult.reason}`,
    personalityResult: personalityResult
      ? `compatible=${personalityResult.compatible}, reason: ${personalityResult.reason}`
      : "(not run)",
    failureStage,
    failureGuidance: guidanceForFailureStage(failureStage),
    userRequest,
  }

  logLLMRequest("failure", {
    model: modelInfo,
    input: {
      systemPrompt: systemPromptOverride ?? systemTemplate,
      variables: input,
    },
  })

  let raw: z.infer<typeof schema>
  try {
    raw = await prompt.pipe(model).invoke(input)
    logLLMResponse("failure", { model: modelInfo, output: raw })
  } catch (error) {
    logLLMError("failure", { model: modelInfo, error })
    throw error
  }

  return {
    responseText: raw.responseText,
  }
}
