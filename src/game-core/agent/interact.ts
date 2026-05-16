import { createAgent } from "langchain"
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { createValidateRequestTool, type RequestResult } from "@/game-core/agent/tools/validate-request"
import { loadPrompt } from "@/game-core/agent/prompts/load-prompt"
import type { NPCProfile, NPCMemory, ConversationEntry } from "@/game-core/types/npc"
import type { GameState, NPCAction } from "@/game-core/types/game"

const interactTemplate = loadPrompt("interact.txt")

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

  const systemPrompt = interactTemplate
    .replaceAll("{name}", npcProfile.name)
    .replaceAll("{personality}", npcProfile.personality.join(", "))
    .replaceAll("{speechStyle}", npcProfile.speechStyle)
    .replaceAll("{history}", recentHistory || "(없음)")

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
