import {
  loadNpcProfileOverride,
  saveNpcProfileOverride,
  clearNpcProfileOverride,
} from "@/game-core/storage/npc-profile-override-storage"

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

describe("loadNpcProfileOverride", () => {
  it("저장된 값이 없으면 null 반환", () => {
    expect(loadNpcProfileOverride("npc_5")).toBeNull()
  })

  it("저장된 오버라이드 반환", () => {
    mockStorage["hometown:npc-profile-override:npc_5"] = JSON.stringify({ personality: "용감함, 충직함" })
    expect(loadNpcProfileOverride("npc_5")).toEqual({ personality: "용감함, 충직함" })
  })

  it("JSON 파싱 실패 시 null 반환", () => {
    mockStorage["hometown:npc-profile-override:npc_5"] = "not-json"
    expect(loadNpcProfileOverride("npc_5")).toBeNull()
  })
})

describe("saveNpcProfileOverride", () => {
  it("올바른 키로 JSON 저장", () => {
    saveNpcProfileOverride("npc_6", {
      personality: "친절함",
      dislikeds: "무례함",
      speechStyle: "경어",
      habitBehavior: "늘 여관을 챙긴다.",
      prohibitBehavior: "여관을 비우지 않는다.",
    })
    expect(JSON.parse(mockStorage["hometown:npc-profile-override:npc_6"])).toEqual({
      personality: "친절함",
      dislikeds: "무례함",
      speechStyle: "경어",
      habitBehavior: "늘 여관을 챙긴다.",
      prohibitBehavior: "여관을 비우지 않는다.",
    })
  })

  it("npcId 별로 독립 저장", () => {
    saveNpcProfileOverride("npc_5", { speechStyle: "A" })
    saveNpcProfileOverride("npc_6", { speechStyle: "B" })
    expect(loadNpcProfileOverride("npc_5")?.speechStyle).toBe("A")
    expect(loadNpcProfileOverride("npc_6")?.speechStyle).toBe("B")
  })
})

describe("clearNpcProfileOverride", () => {
  it("저장된 값 삭제", () => {
    mockStorage["hometown:npc-profile-override:npc_5"] = JSON.stringify({ speechStyle: "반말" })
    clearNpcProfileOverride("npc_5")
    expect(mockStorage["hometown:npc-profile-override:npc_5"]).toBeUndefined()
  })
})
