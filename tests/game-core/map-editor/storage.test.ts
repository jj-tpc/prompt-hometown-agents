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
})

describe("named map storage (server API)", () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("listSavedMaps returns summaries from the API", async () => {
    const summaries = [{ id: "a", name: "A", width: 4, height: 4, updatedAt: 100 }]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => summaries,
    }) as jest.Mock

    const result = await listSavedMaps()
    expect(result).toEqual(summaries)
    expect(global.fetch).toHaveBeenCalledWith("/api/maps")
  })

  it("listSavedMaps returns [] on fetch failure", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network error")) as jest.Mock

    expect(await listSavedMaps()).toEqual([])
  })

  it("loadSavedMap returns null for 404", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as jest.Mock

    expect(await loadSavedMap("missing")).toBeNull()
  })

  it("saveNamedMap POSTs the map and returns the summary", async () => {
    const map = createBlankTileMap({ id: "test", name: "Test", width: 4, height: 4 })
    const summary = { id: "test", name: "Test", width: 4, height: 4, updatedAt: 999 }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => summary,
    }) as jest.Mock

    const result = await saveNamedMap(map)
    expect(result).toEqual(summary)
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/maps",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("deleteSavedMap sends DELETE to the API", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }) as jest.Mock

    await deleteSavedMap("test-id")
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/maps/test-id",
      expect.objectContaining({ method: "DELETE" })
    )
  })
})
