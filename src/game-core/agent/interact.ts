import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { runDecisionChain } from "@/game-core/agent/chains/decision-chain"
import { runFailureResponseChain } from "@/game-core/agent/chains/failure-response-chain"
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
const IMPERATIVE_REQUEST_PATTERNS = [
  /(?:^|\s)(?:하자|해\s*보자|해\s*봐|해라|하세요|하십시오)\s*[.!?…]*$/,
  /(?:^|\s)(?:가|가자|가봐|가라|가세요)\s*[.!?…]*$/,
  /(?:^|\s)(?:와|와봐|와라|오세요)\s*[.!?…]*$/,
  /(?:^|\s)(?:써|써봐|써라|써줘|쓰세요)\s*[.!?…]*$/,
  /(?:말해|말해봐|말해줘|말하라)\s*[.!?…]*$/,
  /(?:움직여|비워|떠나|기다려|캐내|안내해|건네|넘겨|찾아|도와|보여줘|만들어|팔아|사와|열어|치워)\s*[.!?…]*$/,
  /(?:해도|가도|써도|말해도|움직여도|비워도|떠나도|안내해도)\s*(?:돼|되지|괜찮)/,
]

function isRequestLikeMessage(message: string): boolean {
  const normalized = message.trim()
  return (
    REQUEST_TRIGGER_PATTERN.test(normalized) ||
    IMPERATIVE_REQUEST_PATTERNS.some((pattern) => pattern.test(normalized))
  )
}

export type AgentPipelineStage = "validate" | "personality" | "failure" | "decision" | "chat"

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
  // not_ok이 1·2단계에서 정상 필터링된 경우, 실제 실패 단계와 사유를 함께 전달한다.
  failedStage?: AgentPipelineStage
  failureReason?: string
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

  if (isRequestLikeMessage(userMessage)) {
    const validateResult = await runPipelineStage("validate", () =>
      runValidateChain(
        userMessage,
        gameState,
        promptOverrides?.validate,
        modelSelection
      )
    )

    let failedStage: AgentPipelineStage | undefined
    let failureReason: string | undefined
    let decisionResult: { decision: "ok" | "not_ok"; responseText: string; action?: NPCAction }

    if (!validateResult.valid) {
      failedStage = "validate"
      failureReason = validateResult.reason
      decisionResult = {
        decision: "not_ok" as const,
        ...(await runPipelineStage("failure", () =>
          runFailureResponseChain({
            userRequest: userMessage,
            profile: npcProfile,
            failureStage: "validate",
            validateResult,
            systemPromptOverride: promptOverrides?.failure,
            modelSelection,
          })
        )),
      }
    } else {
      const validated = await runValidatedRequestDecision({
        userMessage,
        npcProfile,
        npcMemory,
        validateResult,
        promptOverrides,
        modelSelection,
      })
      decisionResult = {
        decision: validated.decision,
        responseText: validated.responseText,
        action: validated.action,
      }
      failedStage = validated.failedStage
      failureReason = validated.failureReason
    }

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
      failedStage,
      failureReason,
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

async function runValidatedRequestDecision(params: {
  userMessage: string
  npcProfile: NPCProfile
  npcMemory: NPCMemory
  validateResult: { valid: boolean; reason: string }
  promptOverrides?: PromptOverrides
  modelSelection?: LLMModelSelection
}): Promise<{
  decision: "ok" | "not_ok"
  responseText: string
  action?: NPCAction
  failedStage?: AgentPipelineStage
  failureReason?: string
}> {
  const { userMessage, npcProfile, npcMemory, validateResult, promptOverrides, modelSelection } = params
  const personalityResult = await runPipelineStage("personality", () =>
    runPersonalityChain(
      userMessage,
      npcProfile,
      npcMemory,
      promptOverrides?.personality,
      modelSelection
    )
  )

  if (!personalityResult.compatible) {
    return {
      decision: "not_ok",
      failedStage: "personality",
      failureReason: personalityResult.reason,
      ...(await runPipelineStage("failure", () =>
        runFailureResponseChain({
          userRequest: userMessage,
          profile: npcProfile,
          failureStage: "personality",
          validateResult,
          personalityResult,
          systemPromptOverride: promptOverrides?.failure,
          modelSelection,
        })
      )),
    }
  }

  return runPipelineStage("decision", () =>
    runDecisionChain(
      userMessage,
      npcProfile,
      validateResult,
      personalityResult,
      promptOverrides?.decision,
      modelSelection
    )
  )
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
