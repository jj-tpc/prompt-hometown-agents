import { resetGameData } from "@/game-core/storage/reset"

const mockStorage: Record<string, string> = {}

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k])
  global.localStorage = {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockStorage[k] = v },
    removeItem: (k: string) => { delete mockStorage[k] },
    clear: () => {},
    key: (i: number) => Object.keys(mockStorage)[i] ?? null,
    get length() { return Object.keys(mockStorage).length },
  } as Storage
})

it("game: prefix 키만 삭제, 다른 키는 보존", () => {
  mockStorage["game:npc:npc_1:memory"] = "{}"
  mockStorage["game:clock"] = "{}"
  mockStorage["other-app:data"] = "keep-me"

  resetGameData()

  expect(mockStorage["game:npc:npc_1:memory"]).toBeUndefined()
  expect(mockStorage["game:clock"]).toBeUndefined()
  expect(mockStorage["other-app:data"]).toBe("keep-me")
})
