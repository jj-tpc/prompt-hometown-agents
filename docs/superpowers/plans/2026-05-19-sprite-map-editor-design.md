# Sprite Map Editor Design and Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a usable sprite map editor for Hometown Agents so a designer can paint `TileMap` data visually, edit elevation and object layers, place player/NPC spawns, preview the existing canvas renderer, and export/import maps without hand-editing TypeScript fixtures.

**Architecture:** Build editor logic as pure TypeScript helpers around the existing `TileMap` model, then mount a client-only editor route in the Studio area. The editor reuses `TILE_DEFINITIONS`, `SPRITE_ATLAS`, `ATLAS_IMAGES`, `renderTileMap`, `canTraverse`, and `loadMap` instead of introducing a second map format. Draft maps are saved to localStorage for MVP, with JSON import/export as the interchange boundary.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, Jest + ts-jest, Canvas 2D, localStorage, existing Sprout Lands PNG assets, existing `@/` path alias. No new runtime dependencies for MVP.

---

## Design Brief

### Feature Summary

The sprite map editor is an internal creation tool for building and adjusting small-to-medium Hometown Agents maps. It is for the project creator or agentic workers who need to author village layouts, test traversal/elevation rules, and quickly see how edits will render in the same 3/4 pixel-art canvas used by `/dev/world`.

The editor should feel like a dense production tool, not a marketing page: fast, tactile, inspectable, and forgiving. The primary experience is editing the map, not reading instructions.

### Primary User Action

Select a tile/elevation/spawn tool, paint directly on the map canvas, and immediately see the rendered result plus validation feedback.

### Design Direction

Use the current Studio split-screen language as the base: dark utility panels, pixel-art preview, compact controls, and clear save/reset/import/export actions. The editor can borrow the "game hardware" feel from `src/app/studio/page.tsx`, but the map editing surface should be more workbench-like: tools on the left, canvas in the center, cell/layer inspector on the right.

Because `.impeccable.md` does not exist yet, this plan assumes:

- Audience: a creator/developer building a pixel-art agent village.
- Use case: rapid iteration on TileMap data and spawn placement.
- Tone: focused, playful in the preview, utilitarian in controls.

Confirm these before doing a visual polish pass.

### Layout Strategy

Use a three-zone editor:

1. Left tool rail: layer selector, brush mode, tile palette, elevation controls.
2. Center canvas: pixelated map preview with pan/zoom, hover cell highlight, active brush cursor, and optional grid/validation overlays.
3. Right inspector: selected cell details, spawn list, map metadata, JSON import/export, dirty state.

On narrower screens, keep the canvas primary and collapse the right inspector below the tool rail. Do not hide painting, layer switching, or save/export controls.

### Key States

- Default: load the saved draft map if present; otherwise seed from `generateVillageTerrain()`.
- Empty draft: create a valid `TileMap` with grass ground, empty decoration/object/overlay layers, zero elevation, one player spawn.
- Dirty: show unsaved draft state and enable save/revert.
- Saved: localStorage matches current draft; save disabled.
- Invalid map: keep editing available, show validation errors in the inspector.
- Import success: replace draft after validation and mark dirty until saved.
- Import failure: preserve current draft and show parse/validation errors.
- Missing sprite: render visible placeholder in canvas and list unresolved sprite IDs.
- Loading assets: show non-overlapping canvas loading state; controls may remain visible but painting should be disabled.

### Interaction Model

- Pointer down paints the active brush; dragging continues painting.
- Right click or erase mode clears nullable layers.
- Hover shows `{x, y, layer, tile, elevation}` in the inspector.
- Wheel or zoom buttons adjust zoom; drag with pan mode moves viewport.
- Brush modes: tile paint, erase, elevation raise/lower/set, player spawn, NPC spawn, select.
- Layer selector controls which layer receives tile paint: `ground`, `decoration`, `object`, `overlay`.
- Keyboard shortcuts are optional MVP polish, not required for first implementation.
- Validation should be immediate but non-blocking: bad cells are highlighted, not hidden.

### Content Requirements

Labels should be short and tool-like:

- Layers: Ground, Decor, Object, Overlay.
- Brush modes: Paint, Erase, Elevation, Spawn, Select.
- Commands: Save Draft, Revert, Export JSON, Import JSON, Reset to Village.
- Toggles: Grid, Walkability, Spawns, Vision.
- Empty messages: "No saved draft yet." and "Import a map or start from the village seed."
- Errors: "Invalid TileMap JSON", "Layer dimensions do not match map size", "Missing player spawn", "Unknown tile type: X".

### Recommended References

For implementation, use these design references from the `impeccable` skill only if a visual pass is requested:

- `reference/interaction-design.md` for tool states, import errors, and immediate feedback.
- `reference/responsive-design.md` for adapting the three-zone workbench.
- `reference/spatial-design.md` for dense app layout and panel rhythm.

### Open Questions

- Should the editor live as a new `/studio/map` route or as a new tab inside the existing `/studio` page?
- Should MVP save only one local draft, or multiple named maps?
- Should edited maps be playable immediately in `/dev/world`, or is JSON export enough for the first pass?
- Should NPC spawn editing bind to existing `WORLD_NPC_CHARACTER_PROMPTS`, or allow arbitrary `npcId` text first?

---

## Current Codebase Hooks

Reuse these existing boundaries:

- `src/game-core/types/map.ts` defines `TileMap`, `TileType`, `LayerName`, `SpawnPoint`, and `Direction`.
- `src/game-core/map/loader.ts` validates authored map data.
- `src/game-core/map/traversal.ts` provides `canTraverse`.
- `src/game-core/map/village-terrain.ts` provides a good seed map.
- `src/game-core/render/tilemap-renderer.ts` provides `renderTileMap`, `gridToScreen`, and tile source helpers.
- `src/game-core/render/terrain-tiles.ts` provides `ATLAS_IMAGES`, `SPRITE_ATLAS`, and character sprite IDs.
- `src/app/studio/page.tsx` provides the existing Studio shell and embedded world preview language.

Do not fork the renderer. The editor preview must call the same renderer path used by `/dev/world`.

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/game-core/map-editor/types.ts` |
| Create | `src/game-core/map-editor/create-map.ts` |
| Create | `src/game-core/map-editor/editor-reducer.ts` |
| Create | `src/game-core/map-editor/validation.ts` |
| Create | `src/game-core/map-editor/storage.ts` |
| Create | `tests/game-core/map-editor/create-map.test.ts` |
| Create | `tests/game-core/map-editor/editor-reducer.test.ts` |
| Create | `tests/game-core/map-editor/validation.test.ts` |
| Create | `src/app/studio/map/page.tsx` |
| Modify | `src/app/studio/page.tsx` if choosing an in-Studio tab/link |
| Optional Modify | `src/app/dev/world/page.tsx` if playable draft loading is included |

---

## Data Model

Keep editor-only state separate from `TileMap`:

```typescript
export type MapEditorTool = "paint" | "erase" | "elevation" | "spawn" | "select" | "pan"
export type ElevationMode = "raise" | "lower" | "set"

export type MapEditorDraft = {
  map: TileMap
  selectedLayer: LayerName
  selectedTile: TileType
  selectedTool: MapEditorTool
  elevationMode: ElevationMode
  elevationValue: number
  selectedSpawnId?: string
  selectedCell?: { x: number; y: number }
}
```

The saved artifact is still `TileMap`. Editor state may be saved separately, but exported JSON should default to map data only.

---

### Task 0: Preflight and Next.js Guardrail

**Files:**
- Read: `AGENTS.md`
- Read: `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
- Read: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- Read: `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`

- [ ] **Step 1: Confirm framework rules**

  Read the listed Next.js docs before editing `src/app/**`. This repo explicitly warns that the installed Next.js version may differ from older conventions.

- [ ] **Step 2: Capture baseline**

  Run:

  ```bash
  npx jest --no-coverage
  npx tsc --noEmit
  npm run lint
  ```

  Expected: existing tests pass, or any pre-existing failures are recorded before making changes.

---

### Task 1: Add Map Editor Core Types and Map Factory

**Files:**
- Create: `src/game-core/map-editor/types.ts`
- Create: `src/game-core/map-editor/create-map.ts`
- Create: `tests/game-core/map-editor/create-map.test.ts`

- [ ] **Step 1: Define editor draft types**

  Add editor-only state types without changing `src/game-core/types/map.ts`.

- [ ] **Step 2: Add a valid blank map factory**

  Create:

  ```typescript
  export function createBlankTileMap(options: {
    id: string
    name: string
    width: number
    height: number
    biome?: TileMap["meta"]["biome"]
    fill?: TileType
  }): TileMap
  ```

  Requirements:

  - `tileSize` is always `16`.
  - Creates all four layers.
  - Ground is filled with `fill ?? "grass"`.
  - Other layers are `null`.
  - Elevation is all `0`.
  - Includes one player spawn at the center.

- [ ] **Step 3: Test factory validity**

  Cover dimensions, layer names, elevation dimensions, center player spawn, and `loadMap(createBlankTileMap(...))`.

- [ ] **Step 4: Verify**

  ```bash
  npx jest tests/game-core/map-editor/create-map.test.ts --no-coverage
  npx tsc --noEmit
  ```

---

### Task 2: Implement Pure Editing Reducer

**Files:**
- Create: `src/game-core/map-editor/editor-reducer.ts`
- Create: `tests/game-core/map-editor/editor-reducer.test.ts`

- [ ] **Step 1: Add immutable cell editing helpers**

  Add pure functions:

  ```typescript
  export function paintTile(map: TileMap, layer: LayerName, x: number, y: number, tile: TileType): TileMap
  export function eraseTile(map: TileMap, layer: LayerName, x: number, y: number): TileMap
  export function setElevation(map: TileMap, x: number, y: number, elevation: number): TileMap
  export function moveSpawn(map: TileMap, spawnId: string, x: number, y: number): TileMap
  export function upsertNpcSpawn(map: TileMap, spawn: SpawnPoint): TileMap
  export function removeSpawn(map: TileMap, spawnId: string): TileMap
  ```

- [ ] **Step 2: Preserve TileMap invariants**

  Requirements:

  - Out-of-bounds edits return the original map reference.
  - `ground` erase should set the cell to `"grass"` instead of `null`.
  - Other layer erase should set the cell to `null`.
  - Elevation clamps to integer range `0..3` for MVP.
  - Spawn placement does not mutate unrelated spawns.

- [ ] **Step 3: Test behavior**

  Cover paint, erase, elevation clamp, spawn move, NPC spawn upsert, and out-of-bounds no-op behavior.

- [ ] **Step 4: Verify**

  ```bash
  npx jest tests/game-core/map-editor/editor-reducer.test.ts --no-coverage
  npx tsc --noEmit
  ```

---

### Task 3: Add Editor Validation

**Files:**
- Create: `src/game-core/map-editor/validation.ts`
- Create: `tests/game-core/map-editor/validation.test.ts`

- [ ] **Step 1: Add validation result types**

  ```typescript
  export type MapEditorIssueLevel = "error" | "warning"
  export type MapEditorIssue = {
    level: MapEditorIssueLevel
    message: string
    x?: number
    y?: number
    layer?: LayerName
  }
  ```

- [ ] **Step 2: Validate authoring issues**

  Add:

  ```typescript
  export function validateMapForEditing(map: TileMap): MapEditorIssue[]
  ```

  Checks:

  - `loadMap` accepts the map shape.
  - Exactly one player spawn is recommended; zero is an error, more than one is a warning.
  - Spawns must be in bounds.
  - Spawns should be on traversable cells.
  - Every layer row/column count matches `width`/`height`.
  - Tile types are known.
  - Sprite IDs resolve through `SPRITE_ATLAS`; unresolved sprites are warnings.

- [ ] **Step 3: Test validation**

  Include valid blank map, missing player spawn, out-of-bounds spawn, bad dimensions, and non-traversable spawn.

- [ ] **Step 4: Verify**

  ```bash
  npx jest tests/game-core/map-editor/validation.test.ts --no-coverage
  npx tsc --noEmit
  ```

---

### Task 4: Add Local Draft Storage and JSON Import/Export

**Files:**
- Create: `src/game-core/map-editor/storage.ts`
- Create or extend: `tests/game-core/map-editor/validation.test.ts`

- [ ] **Step 1: Add localStorage helpers**

  Create browser-safe helpers:

  ```typescript
  export function loadMapEditorDraft(): TileMap | null
  export function saveMapEditorDraft(map: TileMap): void
  export function clearMapEditorDraft(): void
  export function serializeTileMap(map: TileMap): string
  export function parseTileMapJson(json: string): TileMap
  ```

- [ ] **Step 2: Keep server imports safe**

  `loadMapEditorDraft`, `saveMapEditorDraft`, and `clearMapEditorDraft` must guard `typeof window === "undefined"`.

- [ ] **Step 3: Validate imports**

  `parseTileMapJson` should parse JSON, call `loadMap`, and throw a useful error message on invalid input.

- [ ] **Step 4: Verify**

  ```bash
  npx jest tests/game-core/map-editor --no-coverage
  npx tsc --noEmit
  ```

---

### Task 5: Build the Editor Route Shell

**Files:**
- Create: `src/app/studio/map/page.tsx`

- [ ] **Step 1: Create a client route**

  Add a `"use client"` page at `/studio/map` that:

  - Loads atlas images from `ATLAS_IMAGES`.
  - Seeds state from `loadMapEditorDraft() ?? generateVillageTerrain()`.
  - Renders a three-zone workbench.
  - Tracks dirty state against the last saved serialized map.

- [ ] **Step 2: Add the tool rail**

  Include:

  - Layer segmented control.
  - Tool buttons for paint, erase, elevation, spawn, select, pan.
  - Tile palette generated from `TILE_DEFINITIONS`.
  - Elevation controls with `0..3` value.
  - Overlay toggles for grid, walkability, spawns, validation.

- [ ] **Step 3: Add the inspector**

  Include:

  - Map metadata edit fields.
  - Selected cell info.
  - Spawn list and selected spawn editor.
  - Validation issue list.
  - Save, Revert, Reset to Village, Export JSON, Import JSON.

- [ ] **Step 4: Verify compile**

  ```bash
  npx tsc --noEmit
  npm run lint
  ```

---

### Task 6: Implement Canvas Editing and Preview

**Files:**
- Modify: `src/app/studio/map/page.tsx`

- [ ] **Step 1: Render the map with existing renderer**

  Use `renderTileMap(ctx, { map, camera, entities }, { images })`.

- [ ] **Step 2: Add canvas coordinate conversion**

  Add route-local helpers to convert pointer coordinates to grid cells using current zoom, pan/camera, and `TILE_PX`.

- [ ] **Step 3: Paint on pointer drag**

  Requirements:

  - `pointerdown` applies one edit.
  - `pointermove` applies edits while dragging.
  - `pointerup` ends painting.
  - Ignore painting while assets are not loaded.
  - Prevent context menu on the canvas so right-click erase can work later.

- [ ] **Step 4: Draw overlays after renderer**

  Use Canvas 2D overlays:

  - Active cell outline.
  - Optional grid.
  - Spawn markers.
  - Validation highlights.
  - Walkability tint when enabled.

- [ ] **Step 5: Visual QA**

  Start the dev server:

  ```bash
  npm run dev
  ```

  Open `/studio/map` and confirm:

  - Canvas is nonblank and pixelated.
  - Painting changes the rendered map immediately.
  - Layer changes affect the expected TileMap layer.
  - Elevation edits visibly lift tiles.
  - Controls do not overlap the canvas on desktop or narrow viewport.

---

### Task 7: Integrate with Studio Navigation

**Files:**
- Modify: `src/app/studio/page.tsx`

- [ ] **Step 1: Add a map editor entry point**

  Choose one:

  - Add a `Map Editor` tab that links to `/studio/map`.
  - Add a compact button in the Studio header.

  Prefer a link for MVP so the existing Prompt Studio remains stable.

- [ ] **Step 2: Keep existing Studio behavior stable**

  Do not alter prompt override, NPC prompt, or embedded world-preview behavior.

- [ ] **Step 3: Verify**

  ```bash
  npx tsc --noEmit
  npm run lint
  ```

---

### Task 8: Optional Playable Draft Preview

**Files:**
- Optional Modify: `src/app/dev/world/page.tsx`
- Optional Create: `src/game-core/map-editor/browser-draft.ts`

- [ ] **Step 1: Add an explicit preview mode**

  If included, `/dev/world?draftMap=1` may load the saved editor draft from localStorage. Default `/dev/world` should continue using `generateVillageTerrain()`.

- [ ] **Step 2: Guard invalid drafts**

  If the saved draft is missing or invalid, fall back to `generateVillageTerrain()` and show a small non-overlapping warning.

- [ ] **Step 3: Do not introduce network persistence**

  Keep MVP browser-local. Server persistence should be a separate plan.

---

## Milestones

**Milestone A - Editor core:** Tasks 1-4. Pure map authoring helpers, validation, storage, and tests exist.

**Milestone B - Usable route:** Tasks 5-6. `/studio/map` loads, renders, paints, edits elevation/spawns, and saves local drafts.

**Milestone C - Product integration:** Task 7. Studio links to the editor without destabilizing Prompt Studio.

**Milestone D - Playtest loop:** Task 8. Saved draft can optionally be loaded into `/dev/world` for movement/NPC QA.

---

## Verification Matrix

Run after core tasks:

```bash
npx jest tests/game-core/map-editor --no-coverage
npx tsc --noEmit
```

Run after app route tasks:

```bash
npx tsc --noEmit
npm run lint
```

Run before completion:

```bash
npx jest --no-coverage
npx tsc --noEmit
npm run lint
```

Visual QA checkpoints:

- `/studio/map` loads without console errors.
- Canvas is nonblank, pixelated, and uses the same renderer as `/dev/world`.
- Paint/erase/elevation/spawn edits update immediately.
- Saved draft reloads after refresh.
- Exported JSON can be imported back and passes `loadMap`.
- Validation issues are visible without blocking editing.
- Narrow viewport keeps the main canvas usable and controls reachable.

---

## Self Review

Coverage:

- Uses the existing `TileMap` shape instead of creating a second schema.
- Keeps renderer reuse explicit.
- Keeps persistence local and reversible for MVP.
- Includes pure helper tests before the UI.
- Leaves server-backed map management out of scope.

Risks:

- The existing Studio page is a large inline-style client component; adding the full editor into the same file would make it harder to maintain. Prefer a separate `/studio/map` route.
- Canvas pointer coordinate math can drift when zoom/pan are added. Keep coordinate conversion in one helper and test it if it becomes non-trivial.
- Map authoring can produce invalid gameplay states. Validation must be visible from the first UI pass, even if it is non-blocking.
