# Terrain, Map Core, and Game Screen Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current hardcoded `/dev/terrain` rendering spike into a TileMap-backed game foundation with terrain autotiling, elevation rendering, Y-sort, camera follow, character rendering, movement, vision events, and Agent interaction hooks.

**Architecture:** Build the TileMap and vision core first, then make the existing terrain preview consume TileMap data instead of string rows. Rendering stays read-only: it receives `TileMap`, entities, sprite atlas entries, and camera state, then draws canvas frames without mutating game logic. Movement and Agent integration consume the same `canTraverse`, vision events, and NPC profiles so the game screen and core tests share one source of truth.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, Jest + ts-jest, Canvas 2D, Sprout Lands PNG assets, existing `@/` path alias.

---

## Execution Decision

The next coding pass should start with `docs/superpowers/plans/2026-05-16-map-vision-core.md`, not more one-off rendering. The renderer work already proved the visual direction; the missing foundation is a typed `TileMap`, loader, traversal, LOS, vision event flow, and Agent bridge. Once `/dev/terrain` reads from `TileMap`, path/dirt/sand autotiling and hills rendering become durable instead of another hardcoded preview.

Recommended order:

1. Map and vision core.
2. `/dev/terrain` conversion from string map to `TileMap`.
3. Path/dirt/sand autotiling.
4. Hills/elevation rendering.
5. Y-sort and camera.
6. Player/NPC sprites and movement.
7. Vision-to-Agent connection on the actual game screen.

---

## File Structure

Create or complete these core files:

- `src/game-core/types/map.ts` - TileMap, layers, elevation, vision config, vision events.
- `src/game-core/map/tile-definitions.ts` - walkable/transparent/sprite/autotile metadata by tile type.
- `src/game-core/map/loader.ts` - runtime validation for authored JSON-like TileMap data.
- `src/game-core/map/traversal.ts` - `isCellWalkable` and elevation-aware `canTraverse`.
- `src/game-core/vision/line-of-sight.ts` - Bresenham LOS over transparent tile definitions.
- `src/game-core/vision/compute-vision.ts` - linear, cone, radius, and proximity vision.
- `src/game-core/vision/vision-event-emitter.ts` - DETECTED/LOST_SIGHT diffing.
- `src/game-core/agent/vision-interaction-bridge.ts` - converts selected vision events into `interactWithNPC`.
- `src/game-core/fixtures/sample-maps.ts` - test fixtures for open, walled, and elevated maps.
- `src/game-core/fixtures/demo-terrain-map.ts` - first playable visual map used by `/dev/terrain`.

Create or complete these renderer files:

- `src/game-core/render/types.ts` - `Camera`, `Renderable`, `SpriteAtlas`, constants.
- `src/game-core/render/autotile.ts` - generic terrain autotile helpers plus grass/path/dirt/sand wrappers.
- `src/game-core/render/terrain-tiles.ts` - Sprout Lands atlas paths and MVP tile atlas entries.
- `src/game-core/render/camera.ts` - player follow and bounds clamp.
- `src/game-core/render/depth-sort.ts` - Y-sort key and renderable sorting.
- `src/game-core/render/tilemap-renderer.ts` - pure canvas renderer for TileMap layers and renderables.

Modify these app/game files:

- `src/app/dev/terrain/page.tsx` - replace hardcoded string rows with `demo-terrain-map`, renderer, camera, and entities.
- `src/game-core/types/npc.ts` - add optional `visionProfile`.
- `src/game-core/fixtures/sample-npcs.ts` - add basic vision profiles for sample NPCs.

Add or extend these tests:

- `tests/game-core/map/*.test.ts`
- `tests/game-core/vision/*.test.ts`
- `tests/game-core/agent/vision-interaction-bridge.test.ts`
- `tests/game-core/render/autotile.test.ts`
- `tests/game-core/render/camera.test.ts`
- `tests/game-core/render/depth-sort.test.ts`
- `tests/game-core/render/tilemap-renderer.test.ts`

---

### Task 0: Preflight and Next.js Guardrail

**Files:**
- Read: `AGENTS.md`
- Read: `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
- Read: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- Read: `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`

- [ ] **Step 1: Confirm the framework rules**

  Read the listed Next.js docs before editing any `src/app/**` file. This satisfies the repo rule that this Next.js version may not match older conventions.

- [ ] **Step 2: Capture baseline**

  Run:

  ```bash
  npx jest --no-coverage
  npx tsc --noEmit
  ```

  Expected: either all existing tests pass, or failures are recorded before making changes.

- [ ] **Step 3: Keep commits small**

  Commit after each task that reaches passing tests:

  ```bash
  git add <changed-files>
  git commit -m "<type>: <short focused message>"
  ```

---

### Task 1: Execute Map and Vision Core

**Files:**
- Follow: `docs/superpowers/plans/2026-05-16-map-vision-core.md`
- Create: `src/game-core/types/map.ts`
- Create: `src/game-core/map/tile-definitions.ts`
- Create: `src/game-core/map/loader.ts`
- Create: `src/game-core/map/traversal.ts`
- Create: `src/game-core/vision/line-of-sight.ts`
- Create: `src/game-core/vision/compute-vision.ts`
- Create: `src/game-core/vision/vision-event-emitter.ts`
- Create: `src/game-core/agent/vision-interaction-bridge.ts`
- Create: `src/game-core/fixtures/sample-maps.ts`
- Modify: `src/game-core/types/npc.ts`
- Modify: `src/game-core/fixtures/sample-npcs.ts`

- [ ] **Step 1: Implement map type definitions**

  Execute Task 1 from `2026-05-16-map-vision-core.md`. Preserve these public names exactly because later renderer tasks depend on them:

  ```typescript
  export type TileMap
  export type TileType
  export type TileLayer
  export type Direction
  export type VisionConfig
  export type NPCVisionProfile
  export type VisionEvent
  export type VisionResult
  ```

- [ ] **Step 2: Implement tile definitions and sample maps**

  Execute Tasks 2 and 3 from `2026-05-16-map-vision-core.md`. The renderer depends on these `spriteId` values:

  ```typescript
  "tiles:grass"
  "tiles:dirt"
  "tiles:path"
  "tiles:sand"
  "tiles:water"
  "tiles:cliff_face"
  "tiles:stairs"
  ```

- [ ] **Step 3: Implement JSON loader and traversal**

  Execute Tasks 4 and 11 from `2026-05-16-map-vision-core.md`. Keep `canTraverse(map, from, to)` independent from rendering.

- [ ] **Step 4: Implement LOS, computeVision, and event emitter**

  Execute Tasks 5, 6, 7, and 8 from `2026-05-16-map-vision-core.md`. LOS blocks on `transparent: false`; elevation-specific 3D visibility is outside MVP.

- [ ] **Step 5: Implement NPC vision profile and Agent bridge**

  Execute Tasks 9 and 10 from `2026-05-16-map-vision-core.md`. The bridge should call `interactWithNPC` only for `reactionType` values `"exclamation"` and `"alert"`.

- [ ] **Step 6: Verify core**

  Run:

  ```bash
  npx jest tests/game-core/map tests/game-core/vision tests/game-core/agent/vision-interaction-bridge.test.ts --no-coverage
  npx tsc --noEmit
  ```

  Expected: all new core tests pass, and TypeScript reports no errors.

- [ ] **Step 7: Commit**

  ```bash
  git add src/game-core/types/map.ts src/game-core/map src/game-core/vision src/game-core/agent/vision-interaction-bridge.ts src/game-core/fixtures/sample-maps.ts src/game-core/types/npc.ts src/game-core/fixtures/sample-npcs.ts tests/game-core/map tests/game-core/vision tests/game-core/agent/vision-interaction-bridge.test.ts
  git commit -m "feat: add tilemap vision core"
  ```

---

### Task 2: Convert `/dev/terrain` to TileMap Data

**Files:**
- Create: `src/game-core/fixtures/demo-terrain-map.ts`
- Create: `tests/game-core/fixtures/demo-terrain-map.test.ts`
- Modify: `src/app/dev/terrain/page.tsx`

- [ ] **Step 1: Add a TileMap fixture for the terrain preview**

  Create `demoTerrainMap` with the current visual composition: water border, grass island, path strip, a small dirt patch, sand/water edge, one raised area, and one stairs tile.

  Required map properties:

  ```typescript
  export const demoTerrainMap: TileMap = {
    meta: { id: "dev_terrain", name: "Dev Terrain", biome: "village" },
    width: 16,
    height: 12,
    tileSize: 16,
    layers: [
      { name: "ground", tiles: /* 12 rows x 16 columns */ },
      { name: "decoration", tiles: /* 12 rows x 16 columns */ },
      { name: "object", tiles: /* 12 rows x 16 columns */ },
      { name: "overlay", tiles: /* 12 rows x 16 columns */ },
    ],
    elevation: /* 12 rows x 16 columns */,
    spawnPoints: [
      { id: "player_start", x: 7, y: 7, facing: "down", entityType: "player" },
      { id: "npc_rabbit_start", x: 10, y: 6, facing: "left", entityType: "npc", npcId: "npc_rabbit" },
    ],
    transitions: [],
  }
  ```

- [ ] **Step 2: Test fixture validity through the loader**

  Create `tests/game-core/fixtures/demo-terrain-map.test.ts`:

  ```typescript
  import { loadMap } from "@/game-core/map/loader"
  import { demoTerrainMap } from "@/game-core/fixtures/demo-terrain-map"

  describe("demoTerrainMap", () => {
    it("is a valid TileMap", () => {
      expect(loadMap(demoTerrainMap).meta.id).toBe("dev_terrain")
    })

    it("contains player and rabbit spawn points", () => {
      expect(demoTerrainMap.spawnPoints.map((p) => p.id)).toEqual([
        "player_start",
        "npc_rabbit_start",
      ])
    })
  })
  ```

- [ ] **Step 3: Replace string rows in `/dev/terrain`**

  `src/app/dev/terrain/page.tsx` should import `demoTerrainMap` and render that fixture. Remove the local `MAP: string[]` once the renderer helper in Task 4 is available.

- [ ] **Step 4: Verify**

  Run:

  ```bash
  npx jest tests/game-core/fixtures/demo-terrain-map.test.ts --no-coverage
  npx tsc --noEmit
  ```

  Expected: fixture test passes and `/dev/terrain` compiles.

- [ ] **Step 5: Commit**

  ```bash
  git add src/game-core/fixtures/demo-terrain-map.ts tests/game-core/fixtures/demo-terrain-map.test.ts src/app/dev/terrain/page.tsx
  git commit -m "feat: back terrain preview with tilemap fixture"
  ```

---

### Task 3: Generalize Terrain Autotiling

**Files:**
- Modify: `src/game-core/render/autotile.ts`
- Modify: `tests/game-core/render/autotile.test.ts`
- Modify: `src/game-core/render/terrain-tiles.ts`

- [ ] **Step 1: Keep `grassAutotile` stable**

  Existing grass tests must keep passing. Add generic helpers without changing the existing exported `grassAutotile(isGrass, x, y)` behavior.

- [ ] **Step 2: Add 4-way mask helper**

  Add:

  ```typescript
  export type FourWayMask = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15

  export function fourWayMask(
    isSame: (x: number, y: number) => boolean,
    x: number,
    y: number
  ): FourWayMask
  ```

  Bit assignment:

  ```text
  north = 1
  east = 2
  south = 4
  west = 8
  ```

- [ ] **Step 3: Add terrain wrappers**

  Add these exports:

  ```typescript
  export function pathAutotile(isPath: (x: number, y: number) => boolean, x: number, y: number): AutotilePos
  export function dirtAutotile(isDirt: (x: number, y: number) => boolean, x: number, y: number): AutotilePos
  export function sandAutotile(isSand: (x: number, y: number) => boolean, x: number, y: number): AutotilePos
  ```

  MVP atlas choices:

  ```text
  path -> public/assets/sprout-lands/tilesets/paths.png
  dirt -> public/assets/sprout-lands/tilesets/tilled-dirt-v2.png
  sand -> public/assets/sprout-lands/tilesets/tilled-dirt-alt.png
  ```

- [ ] **Step 4: Add tests for masks and terrain wrappers**

  Extend `tests/game-core/render/autotile.test.ts` with:

  ```typescript
  expect(fourWayMask(grid([".G.", "GGG", ".G."]), 1, 1)).toBe(15)
  expect(fourWayMask(grid(["...", ".G.", "..."]), 1, 1)).toBe(0)
  expect(fourWayMask(grid([".G.", ".G.", "..."]), 1, 1)).toBe(1)
  ```

  Also assert that `pathAutotile`, `dirtAutotile`, and `sandAutotile` return defined `{ col, row }` values for masks `0`, `1`, `2`, `4`, `8`, and `15`.

- [ ] **Step 5: Verify**

  Run:

  ```bash
  npx jest tests/game-core/render/autotile.test.ts --no-coverage
  npx tsc --noEmit
  ```

  Expected: old grass tests and new terrain tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add src/game-core/render/autotile.ts src/game-core/render/terrain-tiles.ts tests/game-core/render/autotile.test.ts
  git commit -m "feat: add path dirt sand autotiling"
  ```

---

### Task 4: Add Renderer Types, Atlas, and TileMap Canvas Rendering

**Files:**
- Create: `src/game-core/render/types.ts`
- Modify: `src/game-core/render/terrain-tiles.ts`
- Create: `src/game-core/render/tilemap-renderer.ts`
- Create: `tests/game-core/render/tilemap-renderer.test.ts`
- Modify: `src/app/dev/terrain/page.tsx`

- [ ] **Step 1: Add renderer types**

  Create `src/game-core/render/types.ts`:

  ```typescript
  export const TILE_PX = 16
  export const ELEVATION_STEP_PX = 16
  export const RENDER_SCALE = 4

  export type Camera = { x: number; y: number }
  export type SpriteAtlasEntry = { atlasId: string; sx: number; sy: number; sw: number; sh: number }
  export type SpriteAtlas = Record<string, SpriteAtlasEntry>
  export type RenderEntity = { id: string; spriteId: string; gridX: number; gridY: number; elevation: number; spriteHeightPx: number }
  ```

- [ ] **Step 2: Add MVP atlas entries**

  `terrain-tiles.ts` should export atlas image paths and sprite entries for:

  ```text
  tiles:grass
  tiles:water
  tiles:path
  tiles:dirt
  tiles:sand
  tiles:cliff_face
  tiles:stairs
  entity:player:front
  entity:npc:front
  ```

- [ ] **Step 3: Implement layer rendering**

  `tilemap-renderer.ts` should export:

  ```typescript
  export function gridToScreen(gridX: number, gridY: number, elevation: number, camera: Camera): { x: number; y: number }
  export function tileSpriteIdFor(map: TileMap, layerName: LayerName, x: number, y: number): string | null
  export function renderTileMap(ctx: CanvasRenderingContext2D, input: RenderInput, assets: LoadedSpriteAssets): void
  ```

  Required draw order:

  ```text
  ground
  decoration
  object + entities after Task 6
  overlay
  UI markers after Task 8
  ```

- [ ] **Step 4: Add testable pure helpers**

  `tests/game-core/render/tilemap-renderer.test.ts` should cover:

  ```typescript
  expect(gridToScreen(2, 3, 0, { x: 0, y: 0 })).toEqual({ x: 32, y: 48 })
  expect(gridToScreen(2, 3, 1, { x: 0, y: 0 })).toEqual({ x: 32, y: 32 })
  expect(tileSpriteIdFor(demoTerrainMap, "ground", 0, 0)).toBe("tiles:water")
  ```

- [ ] **Step 5: Wire `/dev/terrain` to the renderer**

  Load images once in `useEffect`, call `renderTileMap`, and keep `ctx.imageSmoothingEnabled = false`.

- [ ] **Step 6: Verify**

  Run:

  ```bash
  npx jest tests/game-core/render/tilemap-renderer.test.ts --no-coverage
  npx tsc --noEmit
  npm run lint
  ```

  Expected: renderer helper tests pass and the app compiles/lints.

- [ ] **Step 7: Commit**

  ```bash
  git add src/game-core/render/types.ts src/game-core/render/terrain-tiles.ts src/game-core/render/tilemap-renderer.ts tests/game-core/render/tilemap-renderer.test.ts src/app/dev/terrain/page.tsx
  git commit -m "feat: render tilemaps on canvas"
  ```

---

### Task 5: Render Hills, Elevation, Cliffs, and Stairs

**Files:**
- Modify: `src/game-core/fixtures/demo-terrain-map.ts`
- Modify: `src/game-core/render/terrain-tiles.ts`
- Modify: `src/game-core/render/tilemap-renderer.ts`
- Modify: `tests/game-core/render/tilemap-renderer.test.ts`

- [ ] **Step 1: Represent raised terrain in the fixture**

  Update `demoTerrainMap.elevation` so a small plateau uses elevation `1`, with `cliff_face` object tiles on exposed boundaries and one `stairs` object tile connecting elevation `0` and `1`.

- [ ] **Step 2: Draw elevated tiles with Y offset**

  Use:

  ```typescript
  screenY = gridY * TILE_PX - elevation * ELEVATION_STEP_PX - camera.y
  ```

- [ ] **Step 3: Draw cliff and stairs sprites**

  Treat `cliff_face` and `stairs` as object-layer tiles. `cliff_face` remains non-walkable and non-transparent through `tile-definitions.ts`; `stairs` remains walkable and transparent.

- [ ] **Step 4: Verify traversal and rendering helpers together**

  Add tests:

  ```typescript
  expect(canTraverse(demoTerrainMap, { x: 6, y: 8 }, { x: 7, y: 8 })).toBe(true)
  expect(gridToScreen(7, 8, 1, { x: 0, y: 0 }).y).toBe(112)
  ```

- [ ] **Step 5: Visual QA**

  Start the dev server:

  ```bash
  npm run dev
  ```

  Open `/dev/terrain`, confirm the plateau is visibly lifted, cliff edges read as vertical faces, stairs connect the two heights, and no canvas text or DOM label overlaps the playfield.

- [ ] **Step 6: Commit**

  ```bash
  git add src/game-core/fixtures/demo-terrain-map.ts src/game-core/render/terrain-tiles.ts src/game-core/render/tilemap-renderer.ts tests/game-core/render/tilemap-renderer.test.ts
  git commit -m "feat: render elevated hills and stairs"
  ```

---

### Task 6: Add Y-sort and Camera

**Files:**
- Create: `src/game-core/render/depth-sort.ts`
- Create: `src/game-core/render/camera.ts`
- Create: `tests/game-core/render/depth-sort.test.ts`
- Create: `tests/game-core/render/camera.test.ts`
- Modify: `src/game-core/render/tilemap-renderer.ts`
- Modify: `src/app/dev/terrain/page.tsx`

- [ ] **Step 1: Implement depth sorting**

  Create:

  ```typescript
  export function depthSortKey(gridY: number, elevation: number): number
  export function sortRenderables<T extends { gridY: number; elevation: number }>(items: T[]): T[]
  ```

  Sort ascending by `gridY * TILE_PX - elevation * ELEVATION_STEP_PX`; when equal, draw higher elevation first.

- [ ] **Step 2: Test Y-sort order**

  Add:

  ```typescript
  expect(depthSortKey(5, 0)).toBe(80)
  expect(depthSortKey(3, 1)).toBe(32)
  expect(sortRenderables([{ gridY: 5, elevation: 0 }, { gridY: 3, elevation: 1 }])[0]).toEqual({ gridY: 3, elevation: 1 })
  ```

- [ ] **Step 3: Implement camera follow and clamp**

  Create:

  ```typescript
  export function cameraForPlayer(
    player: { worldX: number; worldY: number },
    map: TileMap,
    viewport: { width: number; height: number }
  ): Camera
  ```

  Clamp to `0..map.width * TILE_PX - viewport.width` and `0..map.height * TILE_PX - viewport.height`, centering maps smaller than the viewport at `0`.

- [ ] **Step 4: Test camera clamp**

  Add tests for:

  ```text
  player near top-left -> camera x/y 0
  player near bottom-right -> camera clamps to max
  map smaller than viewport -> camera x/y 0
  ```

- [ ] **Step 5: Wire camera into `/dev/terrain`**

  Keep the current preview static if player movement is not implemented yet, but compute camera from the player spawn so the renderer path is correct.

- [ ] **Step 6: Verify**

  Run:

  ```bash
  npx jest tests/game-core/render/depth-sort.test.ts tests/game-core/render/camera.test.ts --no-coverage
  npx tsc --noEmit
  npm run lint
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add src/game-core/render/depth-sort.ts src/game-core/render/camera.ts tests/game-core/render/depth-sort.test.ts tests/game-core/render/camera.test.ts src/game-core/render/tilemap-renderer.ts src/app/dev/terrain/page.tsx
  git commit -m "feat: add y-sort and camera helpers"
  ```

---

### Task 7: Add Character and NPC Rendering MVP

**Files:**
- Modify: `src/game-core/render/terrain-tiles.ts`
- Modify: `src/game-core/render/tilemap-renderer.ts`
- Modify: `src/app/dev/terrain/page.tsx`
- Create: `tests/game-core/render/entities.test.ts`

- [ ] **Step 1: Add front-facing sprite atlas entries**

  Use:

  ```text
  public/assets/sprout-lands/characters/basic-character.png -> entity:player:front
  public/assets/sprout-lands/characters/basic-character.png -> entity:npc:front
  ```

  MVP accepts one front-facing frame for both player and NPC, using different atlas crops only if the sprite sheet has an obvious second front-facing frame.

- [ ] **Step 2: Build render entities from spawn points**

  Add a pure helper:

  ```typescript
  export function entitiesFromSpawns(map: TileMap): RenderEntity[]
  ```

  Expected output includes:

  ```text
  player_start -> entity:player:front
  npc_rabbit_start -> entity:npc:front
  ```

- [ ] **Step 3: Render entities in Stage 3**

  Combine object-layer renderables and entity renderables, sort them through `sortRenderables`, and draw using base-foot anchoring.

- [ ] **Step 4: Verify**

  Run:

  ```bash
  npx jest tests/game-core/render/entities.test.ts tests/game-core/render/depth-sort.test.ts --no-coverage
  npx tsc --noEmit
  ```

  Visual QA on `/dev/terrain`: player and rabbit/NPC stand on tiles, tall sprites anchor at their feet, and objects in front can cover them through Y-sort.

- [ ] **Step 5: Commit**

  ```bash
  git add src/game-core/render/terrain-tiles.ts src/game-core/render/tilemap-renderer.ts src/app/dev/terrain/page.tsx tests/game-core/render/entities.test.ts
  git commit -m "feat: render player and npc sprites"
  ```

---

### Task 8: Add Player Movement and Vision Events to the Game Screen

**Files:**
- Modify: `src/app/dev/terrain/page.tsx`
- Modify: `src/game-core/fixtures/demo-terrain-map.ts`
- Create: `tests/game-core/game-loop/movement.test.ts`

- [ ] **Step 1: Add local player state**

  In `/dev/terrain`, store player grid position and facing direction in React state. Arrow keys or WASD attempt one-tile movement.

- [ ] **Step 2: Gate movement through `canTraverse`**

  Movement uses:

  ```typescript
  if (canTraverse(demoTerrainMap, currentPosition, nextPosition)) {
    setPlayerPosition(nextPosition)
  }
  ```

  Water, cliffs, walls, and non-adjacent moves must fail; stairs between elevation levels must pass.

- [ ] **Step 3: Compute NPC vision after movement**

  On each accepted player move, compute vision for visible NPCs, diff events with `vision-event-emitter`, and store UI markers for DETECTED events.

- [ ] **Step 4: Keep Agent calls off by default in `/dev/terrain`**

  For this dev screen, display an `!` marker on DETECTED. Do not call the network-backed Agent automatically until Task 9. This keeps movement QA deterministic and fast.

- [ ] **Step 5: Verify movement rules**

  Add tests in `tests/game-core/game-loop/movement.test.ts` around a small helper that attempts movement:

  ```typescript
  expect(attemptMove(map, { x: 1, y: 1 }, "right")).toEqual({ moved: true, position: { x: 2, y: 1 } })
  expect(attemptMove(map, { x: 1, y: 1 }, "up")).toEqual({ moved: false, position: { x: 1, y: 1 } })
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/app/dev/terrain/page.tsx src/game-core/fixtures/demo-terrain-map.ts tests/game-core/game-loop/movement.test.ts
  git commit -m "feat: add tile traversal player movement"
  ```

---

### Task 9: Connect Vision Events to Agent Interaction

**Files:**
- Modify: `src/app/dev/terrain/page.tsx`
- Modify: `src/app/api/agent/interact/route.ts` if a lightweight API call path is needed
- Modify: `src/game-core/agent/vision-interaction-bridge.ts` only if UI integration exposes missing dependency seams
- Create: `tests/app/dev/terrain-vision-agent.test.ts` if component-level testing is practical in the current setup

- [ ] **Step 1: Add an explicit dev toggle**

  `/dev/terrain` should keep Agent auto-interaction behind a visible dev-only toggle or a code constant:

  ```typescript
  const ENABLE_AGENT_ON_DETECTION = false
  ```

  The default is false to avoid accidental API calls while testing movement/rendering.

- [ ] **Step 2: Reuse `processVisionEvents`**

  When enabled, pass DETECTED/LOST_SIGHT events into `processVisionEvents` with a resolver for sample NPC profiles and in-memory NPC memory.

- [ ] **Step 3: Display interaction results**

  Store the returned `responseText` in local UI state and render it as a simple speech bubble anchored near the NPC render position.

- [ ] **Step 4: Verify no duplicate calls**

  Use the existing bridge tests to ensure repeated frames do not call `interactWithNPC` multiple times for the same sighting:

  ```bash
  npx jest tests/game-core/agent/vision-interaction-bridge.test.ts --no-coverage
  ```

- [ ] **Step 5: Full verification**

  Run:

  ```bash
  npx jest --no-coverage
  npx tsc --noEmit
  npm run lint
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/app/dev/terrain/page.tsx src/game-core/agent/vision-interaction-bridge.ts tests/app tests/game-core/agent/vision-interaction-bridge.test.ts
  git commit -m "feat: connect vision events to agent interaction"
  ```

---

## Milestones

**Milestone A - Core foundation:** Tasks 0-1. At this point core map, traversal, LOS, vision events, and Agent bridge exist with tests.

**Milestone B - Durable terrain renderer:** Tasks 2-5. `/dev/terrain` is TileMap-backed and renders grass, water, path, dirt, sand, hills, cliff faces, and stairs.

**Milestone C - Game screen MVP:** Tasks 6-8. Camera, Y-sort, player/NPC sprites, movement, and vision markers work in one screen.

**Milestone D - Agent loop:** Task 9. Detection can trigger the NPC Agent path under an explicit dev control.

---

## Verification Matrix

Run after every task:

```bash
npx tsc --noEmit
```

Run after core tasks:

```bash
npx jest tests/game-core/map tests/game-core/vision tests/game-core/agent --no-coverage
```

Run after renderer tasks:

```bash
npx jest tests/game-core/render --no-coverage
npm run lint
```

Run before calling the branch complete:

```bash
npx jest --no-coverage
npx tsc --noEmit
npm run lint
```

Visual QA checkpoints:

- `/dev/terrain` loads without console errors.
- Canvas is nonblank and pixelated, not blurred.
- Path/dirt/sand boundaries connect instead of repeating one isolated tile.
- Elevated tiles render higher by one 16px step.
- Cliff faces and stairs align with elevation transitions.
- Player and NPC foot anchors sit on the intended tile.
- Y-sort lets foreground objects cover characters when their base is lower on screen.
- Camera follows the player and never exposes outside-map void.

---

## Self Review

Spec coverage:

- Path autotiling: Task 3.
- Dirt/sand terrain: Tasks 2-4.
- Hills/elevation rendering: Task 5.
- Y-sort renderer: Task 6 and Task 7.
- Camera follow and clamp: Task 6.
- `2026-05-16-map-vision-core.md` execution: Task 1.
- Hardcoded `/dev/terrain` conversion: Task 2 and Task 4.
- Character/NPC rendering: Task 7.
- Player movement and Agent connection: Task 8 and Task 9.

Type consistency:

- `TileMap`, `TileType`, `LayerName`, `NPCVisionProfile`, `VisionEvent`, and `canTraverse` match the existing map-vision-core plan.
- Renderer constants use `TILE_PX = 16` and `ELEVATION_STEP_PX = 16`, matching the renderer PRD.
- Agent integration uses the existing `interactWithNPC` boundary instead of adding a second conversation path.
