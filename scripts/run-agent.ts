/**
 * Agent 통합 테스트 스크립트
 * 실행: npx tsx --env-file=.env.local scripts/run-agent.ts
 */

import { interactWithNPC } from "../src/game-core/agent/interact"
import { appendConversationEntry } from "../src/game-core/storage/npc-memory"
import { RABBIT, BLACKSMITH, emptyMemory, sampleGameState } from "../src/game-core/fixtures/sample-npcs"
import type { NPCMemory } from "../src/game-core/types/npc"

const DIVIDER = "─".repeat(50)

async function chat(
  npcMemory: NPCMemory,
  userMessage: string,
  scenario: { npc: typeof RABBIT; label: string }
) {
  const { npc, label } = scenario
  console.log(`\n${DIVIDER}`)
  console.log(`[${label}] 유저: ${userMessage}`)

  const result = await interactWithNPC({
    npcProfile: npc,
    npcMemory,
    userMessage,
    gameState: sampleGameState(),
    gameTimestamp: sampleGameState().clock.currentMinute,
  })

  console.log(`[${label}] ${npc.name}: ${result.responseText}`)
  if (result.decision) console.log(`  → 결정: ${result.decision}`)
  if (result.action) console.log(`  → 액션: ${JSON.stringify(result.action)}`)

  appendConversationEntry(npc.id, {
    timestamp: sampleGameState().clock.currentMinute,
    speaker: "user",
    message: userMessage,
    type: result.decision ? "request" : "chat",
  })
  appendConversationEntry(npc.id, result.memoryUpdate)

  return result
}

async function main() {
  console.log("=== Agent 통합 테스트 시작 ===")
  console.log("모델:", process.env.OPENAI_MODEL ?? "gpt-4o-mini")

  const rabbitMemory = emptyMemory(RABBIT.id)
  const smithMemory = emptyMemory(BLACKSMITH.id)

  // --- 시나리오 1: 토끼와 일반 대화 ---
  await chat(rabbitMemory, "안녕! 오늘 날씨 좋다~", { npc: RABBIT, label: "일반 대화" })

  // --- 시나리오 2: 토끼에게 유효한 아이템 요청 ---
  await chat(rabbitMemory, "낚싯대 나한테 줄 수 있어?", { npc: RABBIT, label: "아이템 요청" })

  // --- 시나리오 3: 토끼에게 성격과 맞지 않는 요청 ---
  await chat(rabbitMemory, "위험한 숲 속 동굴에 같이 가줘", { npc: RABBIT, label: "성격 충돌 요청" })

  // --- 시나리오 4: 존재하지 않는 곳 요청 ---
  await chat(rabbitMemory, "우주 정거장에 가줘", { npc: RABBIT, label: "유효하지 않은 요청" })

  // --- 시나리오 5: 대장장이에게 검 요청 ---
  await chat(smithMemory, "철제 검 하나 만들어줘", { npc: BLACKSMITH, label: "대장장이 요청" })

  console.log(`\n${DIVIDER}`)
  console.log("=== 테스트 완료 ===")
}

main().catch(console.error)
