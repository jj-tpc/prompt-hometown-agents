import { createBlankTileMap } from "@/game-core/map-editor/create-map"
import {
  clearMapEditorDraft,
  deleteSavedMap,
  listSavedMaps,
  loadMapEditorDraft,
  loadSavedMap,
  parseTileMapJson,
  saveMapEditorDraft,
  saveNamedMap,
  serializeTileMap,
} from "@/game-core/map-editor/storage"
import type { TileMap } from "@/game-core/types/map"

describe("map editor storage serialization", () => {
  const originalWindow = global.window

  afterEach(() => {
    global.window = originalWindow
  })

  function installMockWindow() {
    const store = new Map<string, string>()
    global.window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
      },
    } as unknown as Window & typeof globalThis
  }

  it("serializes and parses a valid TileMap", () => {
    const map = createBlankTileMap({ id: "round_trip", name: "Round Trip", width: 4, height: 4 })

    expect(parseTileMapJson(serializeTileMap(map))).toEqual(map)
  })

  it("throws a useful error for invalid JSON", () => {
    expect(() => parseTileMapJson("{")).toThrow("Invalid TileMap JSON")
  })

  it("throws the loader error for invalid map shape", () => {
    const map = createBlankTileMap({ id: "invalid", name: "Invalid", width: 4, height: 4 })
    delete (map as Partial<TileMap>).layers

    expect(() => parseTileMapJson(JSON.stringify(map))).toThrow(
      "Invalid TileMap: missing required fields"
    )
  })

  it("saves, loads, and clears the draft in localStorage", () => {
    installMockWindow()
    const map = createBlankTileMap({ id: "draft", name: "Draft", width: 4, height: 4 })

    expect(loadMapEditorDraft()).toBeNull()
    saveMapEditorDraft(map)
    expect(loadMapEditorDraft()).toEqual(map)
    clearMapEditorDraft()
    expect(loadMapEditorDraft()).toBeNull()
  })

  it("saves, lists, loads, and deletes named maps", () => {
    installMockWindow()
    const first = createBlankTileMap({ id: "first", name: "First", width: 4, height: 4 })
    const second = createBlankTileMap({ id: "second", name: "Second", width: 6, height: 5 })

    saveNamedMap(first, 100)
    saveNamedMap(second, 200)

    expect(listSavedMaps().map((map) => map.id)).toEqual(["second", "first"])
    expect(loadSavedMap("first")).toEqual(first)

    deleteSavedMap("second")
    expect(listSavedMaps().map((map) => map.id)).toEqual(["first"])
    expect(loadSavedMap("second")).toBeNull()
  })
})
