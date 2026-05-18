import {
  loadNpcCharacterPrompt,
  saveNpcCharacterPrompt,
  clearNpcCharacterPrompt,
} from "@/game-core/storage/npc-character-prompt-storage"

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

describe("loadNpcCharacterPrompt", () => {
  it("저장된 값이 없으면 null 반환", () => {
    expect(loadNpcCharacterPrompt("npc_guard")).toBeNull()
  })

  it("저장된 오버라이드를 반환", () => {
    mockStorage["hometown:npc-character-prompt:npc_guard"] = "커스텀 프롬프트"
    expect(loadNpcCharacterPrompt("npc_guard")).toBe("커스텀 프롬프트")
  })
})

describe("saveNpcCharacterPrompt", () => {
  it("올바른 키로 localStorage에 저장됨", () => {
    saveNpcCharacterPrompt("npc_guard", "테스트 내용")
    expect(mockStorage["hometown:npc-character-prompt:npc_guard"]).toBe("테스트 내용")
  })
})

describe("clearNpcCharacterPrompt", () => {
  it("저장된 값 삭제", () => {
    mockStorage["hometown:npc-character-prompt:npc_guard"] = "삭제될 내용"
    clearNpcCharacterPrompt("npc_guard")
    expect(mockStorage["hometown:npc-character-prompt:npc_guard"]).toBeUndefined()
  })
})
