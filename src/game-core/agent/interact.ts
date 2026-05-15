import { createAgent } from "langchain"
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { createValidateRequestTool, type RequestResult } from "@/game-core/agent/tools/validate-request"
import type { NPCProfile, NPCMemory, ConversationEntry } from "@/game-core/types/npc"
import type { GameState, NPCAction } from "@/game-core/types/game"

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
}): Promise<InteractResult> {
  const { npcProfile, npcMemory, userMessage, gameState, gameTimestamp } = params

  // eslint-disable-next-line prefer-const
  let requestResult: RequestResult | null = null as RequestResult | null

  const validateTool = createValidateRequestTool(
    npcProfile, npcMemory, gameState,
    (result) => { requestResult = result }
  )

  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.8,
  })

  const contextSize = parseInt(process.env.HISTORY_CONTEXT_SIZE ?? "10")
  const recentHistory = npcMemory.conversationHistory
    .slice(-contextSize)
    .map((e) => `${e.speaker === "user" ? "유저" : npcProfile.name}: ${e.message}`)
    .join("\n")

  const systemPrompt = `당신은 ${npcProfile.name}입니다.\n성격: ${npcProfile.personality.join(", ")}\n말투: ${npcProfile.speechStyle}\n\n최근 대화:\n${recentHistory || "(없음)"}\n\n유저와 자연스럽게 대화하세요. 유저가 구체적인 행동을 요청하면 validate_request 툴을 사용하세요.`

  const agent = createAgent({ model, tools: [validateTool] })
  const agentResult = await agent.invoke({
    messages: [new SystemMessage(systemPrompt), new HumanMessage(userMessage)],
  })

  const lastMessage = agentResult.messages[agentResult.messages.length - 1]
  const responseText =
    requestResult !== null ? requestResult.responseText : String(lastMessage.content)

  const memoryUpdate: ConversationEntry = {
    timestamp: gameTimestamp,
    speaker: "npc",
    message: responseText,
    type: requestResult !== null ? "request" : "chat",
    decision: requestResult !== null ? requestResult.decision : undefined,
  }

  return {
    responseText,
    decision: requestResult !== null ? requestResult.decision : undefined,
    action: requestResult !== null ? requestResult.action : undefined,
    memoryUpdate,
  }
}
