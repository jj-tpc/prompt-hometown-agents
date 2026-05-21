import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { runDecisionChain } from "@/game-core/agent/chains/decision-chain"
import { runPersonalityChain } from "@/game-core/agent/chains/personality-chain"
import { runValidateChain } from "@/game-core/agent/chains/validate-chain"
import { logLLMError, logLLMRequest, logLLMResponse } from "@/game-core/agent/llm-debug-log"
import { createChatModel, getLLMModelDebugInfo, type LLMModelSelection } from "@/game-core/agent/llm-models"
import { withAcceptedRequestAction } from "@/game-core/agent/request-action"
import { loadPrompt } from "@/game-core/agent/prompts/load-prompt"
import type { PromptOverrides } from "@/game-core/agent/prompt-overrides"
import type { NPCProfile, NPCMemory, ConversationEntry } from "@/game-core/types/npc"
import type { GameState, NPCAction } from "@/game-core/types/game"

const interactTemplate = loadPrompt("interact.txt")
const REQUEST_TRIGGER_PATTERN =
  /(해줘|해줄\s*수|도와줄\s*수|부탁|줘|알려줘|가줘|이동|따라와|줄래|할\s*수|찾아줘)/

export type AgentPipelineStage = "validate" | "personality" | "decision" | "chat"

export class AgentPipelineError extends Error {
  stage: AgentPipelineStage
  cause: unknown

  constructor(stage: AgentPipelineStage, cause: unknown) {
    super(`Agent pipeline failed at ${stage}`)
    this.name = "AgentPipelineError"
    this.stage = stage
    this.cause = cause
  }
}

export type InteractResult = {
  responseText: string
  decision?: "ok" | "not_ok"
  action?: NPCAction
  memoryUpdate: ConversationEntry
}

export async function interactWithNPC(params: {
  npcProfile: NPCProfile
  npcMemory: NPCMemory
  userMessage: string
  gameState: GameState
  gameTimestamp: number
  promptOverrides?: PromptOverrides
  characterPrompt?: string
  modelSelection?: LLMModelSelection
}): Promise<InteractResult> {
  const {
    npcProfile,
    npcMemory,
    userMessage,
    gameState,
    gameTimestamp,
    promptOverrides,
    characterPrompt,
    modelSelection,
  } = params

  const contextSize = parseInt(process.env.HISTORY_CONTEXT_SIZE ?? "10")
  const recentHistory = npcMemory.conversationHistory
    .slice(-contextSize)
    .map((e) => `${e.speaker === "user" ? "유저" : npcProfile.name}: ${e.message}`)
    .join("\n")

  const interactSource = promptOverrides?.interact ?? interactTemplate
  const systemPrompt = interactSource
    .replaceAll("{name}", npcProfile.name)
    .replaceAll("{personality}", npcProfile.personality.join(", "))
    .replaceAll("{dislikeds}", npcProfile.dislikeds.join(", "))
    .replaceAll("{speechStyle}", npcProfile.speechStyle)
    .replaceAll("{habitBehavior}", npcProfile.habitBehavior ?? "(none)")
    .replaceAll("{prohibitBehavior}", npcProfile.prohibitBehavior ?? "(none)")
    .replaceAll("{history}", recentHistory || "(없음)")

  const characterBg = characterPrompt?.trim()
  const worldKnowledge = promptOverrides?.worldKnowledge?.trim()

  const finalPrompt = [
    systemPrompt,
    characterBg ? `<character_background>\n${characterBg}\n</character_background>` : null,
    worldKnowledge ? `<worldKnowledge>\n${worldKnowledge}\n</worldKnowledge>` : null,
  ]
    .filter(Boolean)
    .join("\n\n")

  if (REQUEST_TRIGGER_PATTERN.test(userMessage)) {
    const validateResult = await runPipelineStage("validate", () =>
      runValidateChain(
        userMessage,
        gameState,
        promptOverrides?.validate,
        modelSelection
      )
    )

    const personalityResult = validateResult.valid
      ? await runPipelineStage("personality", () =>
          runPersonalityChain(
            userMessage,
            npcProfile,
            npcMemory,
            promptOverrides?.personality,
            modelSelection
          )
        )
      : { compatible: false, reason: "유효하지 않은 요청" }

    const decisionResult = await runPipelineStage("decision", () =>
      runDecisionChain(
        userMessage,
        npcProfile,
        validateResult,
        personalityResult,
        promptOverrides?.decision,
        modelSelection
      )
    )
    const requestResult = withAcceptedRequestAction(userMessage, decisionResult)

    const memoryUpdate: ConversationEntry = {
      timestamp: gameTimestamp,
      speaker: "npc",
      message: requestResult.responseText,
      type: "request",
      decision: requestResult.decision,
    }

    return {
      responseText: requestResult.responseText,
      decision: requestResult.decision,
      action: requestResult.action,
      memoryUpdate,
    }
  }

  const temperature = 0.8
  const modelInfo = getLLMModelDebugInfo({ modelSelection, temperature })
  const model = createChatModel({ modelSelection, temperature })
  logLLMRequest("chat", {
    model: modelInfo,
    input: {
      systemPrompt: finalPrompt,
      userMessage,
    },
  })
  let response: Awaited<ReturnType<typeof model.invoke>>
  try {
    response = await runPipelineStage("chat", () =>
      model.invoke([new SystemMessage(finalPrompt), new HumanMessage(userMessage)])
    )
    logLLMResponse("chat", { model: modelInfo, output: response })
  } catch (error) {
    logLLMError("chat", { model: modelInfo, error })
    throw error
  }

  const responseText = String(response.content)

  const memoryUpdate: ConversationEntry = {
    timestamp: gameTimestamp,
    speaker: "npc",
    message: responseText,
    type: "chat",
  }

  return {
    responseText,
    memoryUpdate,
  }
}

async function runPipelineStage<T>(
  stage: AgentPipelineStage,
  run: () => Promise<T>
): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw new AgentPipelineError(stage, error)
  }
}
