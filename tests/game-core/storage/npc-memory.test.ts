import { loadNPCMemory, saveNPCMemory, appendConversationEntry } from "@/game-core/storage/npc-memory"
import type { ConversationEntry } from "@/game-core/types/npc"

const mockStorage: Record<string, string> = {}

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k])
  global.localStorage = {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockStorage[k] = v },
    removeItem: (k: string) => { delete mockStorage[k] },
    clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]) },
    key: () => null,
    length: 0,
  } as Storage
})

describe("loadNPCMemory", () => {
  it("존재하지 않는 NPC는 기본 메모리 반환", () => {
    const memory = loadNPCMemory("npc_1")
    expect(memory).toEqual({ npcId: "npc_1", conversationHistory: [], relationshipScore: 0 })
  })

  it("저장된 메모리를 올바르게 불러옴", () => {
    const data = { npcId: "npc_1", conversationHistory: [], relationshipScore: 5 }
    mockStorage["game:npc:npc_1:memory"] = JSON.stringify(data)
    expect(loadNPCMemory("npc_1")).toEqual(data)
  })
})

describe("saveNPCMemory", () => {
  it("game: 네임스페이스 키로 저장됨", () => {
    saveNPCMemory({ npcId: "npc_1", conversationHistory: [], relationshipScore: 0 })
    expect(mockStorage["game:npc:npc_1:memory"]).toBeDefined()
  })
})

describe("appendConversationEntry", () => {
  it("기존 히스토리에 항목이 추가됨", () => {
    saveNPCMemory({ npcId: "npc_1", conversationHistory: [], relationshipScore: 0 })
    const entry: ConversationEntry = { timestamp: 60, speaker: "user", message: "안녕", type: "chat" }
    appendConversationEntry("npc_1", entry)
    const memory = loadNPCMemory("npc_1")
    expect(memory.conversationHistory).toHaveLength(1)
    expect(memory.conversationHistory[0]).toEqual(entry)
  })
})
