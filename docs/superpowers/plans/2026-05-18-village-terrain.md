# Village Terrain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 200×200 random terrain with a 100×100 hand-crafted village map featuring cross-roads, building platforms (rendered as hills via elevation=1), dirt yards, a fenced sheep pen, and 14 meaningful NPC spawn positions. Update NPC waypoints in `world-dialogue.ts` to match the new map.

**Architecture:** `generateVillageTerrain()` returns a `TileMap` with the same interface as `generateRandomTerrain()`. Building "footprints" are grass tiles at elevation=1 — the existing tilemap renderer autotiles these as hills, creating visual height without new sprites. Fence tiles require one addition to `terrain-tiles.ts` (ATLAS_IMAGES + SPRITE_ATLAS entry pointing to `fences.png` which is already in `public/`). The world page simply swaps the terrain generator.

**Tech Stack:** TypeScript, existing tilemap renderer (no new dependencies)

---

## Village Layout Reference

```
Map: 100×100 tiles, water border 2 tiles, center at (50, 50)

Roads (path, 3 tiles wide):
  N-S: x=48..50, y=2..97
  E-W: y=48..50, x=2..97

Building platforms (grass + elevation=1, rendered as hills):
  Inn:          x=38..46, y=33..41
  Town Hall:    x=52..59, y=38..45
  Blacksmith:   x=59..65, y=32..40
  Market:       x=39..47, y=53..60
  Noble Villa:  x=61..72, y=62..73
  Farmhouse:    x=66..73, y=47..53

Dirt yards (ground=dirt, elevation=0):
  Inn yard:         x=36..48, y=31..43
  Blacksmith yard:  x=57..67, y=30..42
  Market yard:      x=37..49, y=51..62

Sheep pen fences (object layer):
  Boundary: x=31..37, y=34..41
  Top:    y=34 for x=31..37
  Bottom: y=41 for x=31..37
  Left:   x=31 for y=35..40
  Right:  x=37 for y=35..40

Spawn points (all elevation=0):
  player:   (50, 52)
  npc_1:    (46, 47)   라미
  npc_2:    (54, 51)   도윤
  npc_3:    (48, 56)   하린
  npc_4:    (56, 46)   무진
  npc_5:    (42, 49)   카엔 (guard, on E-W road)
  npc_6:    (47, 43)   마리 (innkeeper, south of inn)
  npc_7:    (60, 66)   시릴 (noble, west of villa)
  npc_8:    (48, 55)   탄 (vendor, on N-S road south of crossroads)
  npc_9:    (53, 58)   나리 (veg vendor)
  npc_10:   (50, 45)   베아 (on N-S road, north of crossroads)
  npc_11:   (65, 50)   루카 (on E-W road, west of farmhouse)
  npc_12:   (34, 38)   모모 (sheep, inside pen)
  npc_13:   (58, 37)   브렌 (blacksmith yard, west of smithy)
```

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/game-core/render/terrain-tiles.ts` |
| Create | `src/game-core/map/village-terrain.ts` |
| Create | `tests/game-core/map/village-terrain.test.ts` |
| Modify | `src/app/dev/world/page.tsx` |
| Modify | `src/game-core/game-loop/world-dialogue.ts` |

---

### Task 1: Enable Fence Tile Rendering

**Files:**
- Modify: `src/game-core/render/terrain-tiles.ts`
- Create: `tests/game-core/render/terrain-tiles-fence.test.ts`

The `fence` tile type is defined in `tile-definitions.ts` with `spriteId: "tiles:fence"` but `"tiles:fence"` is missing from `SPRITE_ATLAS`. The asset `public/assets/sprout-lands/tilesets/fences.png` exists.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/game-core/render/terrain-tiles-fence.test.ts
import { ATLAS_IMAGES, SPRITE_ATLAS } from "@/game-core/render/terrain-tiles"

describe("fence sprite", () => {
  it("ATLAS_IMAGES에 fence 항목이 있어야 함", () => {
    expect((ATLAS_IMAGES as Record<string, string>)["fence"]).toBeDefined()
  })

  it("SPRITE_ATLAS에 tiles:fence 항목이 있어야 함", () => {
    expect(SPRITE_ATLAS["tiles:fence"]).toBeDefined()
  })

  it("tiles:fence가 fence atlas를 가리켜야 함", () => {
    expect(SPRITE_ATLAS["tiles:fence"]?.atlasId).toBe("fence")
  })
})
```

Run: `npx vitest run tests/game-core/render/terrain-tiles-fence.test.ts`
Expected: FAIL

- [ ] **Step 2: Add fence to `terrain-tiles.ts`**

In `src/game-core/render/terrain-tiles.ts`, find `export const ATLAS_IMAGES = {` and add the `fence` entry as the last item before `} as const`:

```typescript
export const ATLAS_IMAGES = {
  grass: "/assets/sprout-lands/tilesets/grass.png",
  water: "/assets/sprout-lands/tilesets/water.png",
  path: "/assets/sprout-lands/tilesets/paths.png",
  dirt: "/assets/sprout-lands/tilesets/tilled-dirt-v2.png",
  sand: "/assets/sprout-lands/tilesets/tilled-dirt-alt.png",
  hills: "/assets/sprout-lands/tilesets/hills.png",
  character: "/assets/sprout-lands/characters/basic-character.png",
  fence: "/assets/sprout-lands/tilesets/fences.png",
} as const
```

In `SPRITE_ATLAS`, after the `"tiles:cliff_face"` entry, add:

```typescript
"tiles:fence": { atlasId: "fence", sx: 0, sy: 0, sw: 16, sh: 16 },
```

- [ ] **Step 3: Run test — expect PASS**

```
npx vitest run tests/game-core/render/terrain-tiles-fence.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 4: Commit**

```bash
git add src/game-core/render/terrain-tiles.ts tests/game-core/render/terrain-tiles-fence.test.ts
git commit -m "feat: add fence tile to sprite atlas"
```

---

### Task 2: Create Village Terrain Generator

**Files:**
- Create: `src/game-core/map/village-terrain.ts`
- Create: `tests/game-core/map/village-terrain.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/game-core/map/village-terrain.test.ts
import { generateVillageTerrain } from "@/game-core/map/village-terrain"

describe("generateVillageTerrain", () => {
  const map = generateVillageTerrain()

  it("맵 크기가 100×100", () => {
    expect(map.width).toBe(100)
    expect(map.height).toBe(100)
  })

  it("물 테두리: 상단 2행은 water", () => {
    expect(map.layers[0].tiles[0][50]).toBe("water")
    expect(map.layers[0].tiles[1][50]).toBe("water")
    expect(map.layers[0].tiles[2][50]).not.toBe("water")
  })

  it("물 테두리: 좌측 2열은 water", () => {
    expect(map.layers[0].tiles[50][0]).toBe("water")
    expect(map.layers[0].tiles[50][1]).toBe("water")
    expect(map.layers[0].tiles[50][2]).not.toBe("water")
  })

  it("N-S 도로: x=49, y=50은 path", () => {
    expect(map.layers[0].tiles[50][49]).toBe("path")
  })

  it("E-W 도로: x=50, y=49은 path", () => {
    expect(map.layers[0].tiles[49][50]).toBe("path")
  })

  it("여관 위치 elevation=1", () => {
    // Inn: x=38..46, y=33..41 → 내부 (42, 37)
    expect(map.elevation[37][42]).toBe(1)
  })

  it("도로 위치 elevation=0", () => {
    expect(map.elevation[49][49]).toBe(0)
  })

  it("object layer에 fence 타일 존재 (양 우리 상단, y=34, x=34)", () => {
    const objectLayer = map.layers.find((l) => l.name === "object")!
    expect(objectLayer.tiles[34][34]).toBe("fence")
  })

  it("스폰 포인트 14개 (플레이어 1 + NPC 13)", () => {
    expect(map.spawnPoints).toHaveLength(14)
  })

  it("플레이어 스폰 위치", () => {
    const player = map.spawnPoints.find((s) => s.entityType === "player")!
    expect(player.x).toBe(50)
    expect(player.y).toBe(52)
  })

  it("npc_5 스폰 위치 (경비 카엔)", () => {
    const npc5 = map.spawnPoints.find((s) => s.id === "npc_5")!
    expect(npc5.x).toBe(42)
    expect(npc5.y).toBe(49)
  })

  it("npc_12 스폰 위치 (양 모모, 우리 안)", () => {
    const npc12 = map.spawnPoints.find((s) => s.id === "npc_12")!
    expect(npc12.x).toBe(34)
    expect(npc12.y).toBe(38)
  })

  it("모든 NPC 스폰은 elevation=0", () => {
    const npcSpawns = map.spawnPoints.filter((s) => s.entityType === "npc")
    for (const sp of npcSpawns) {
      expect(map.elevation[sp.y][sp.x]).toBe(0)
    }
  })
})
```

Run: `npx vitest run tests/game-core/map/village-terrain.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement `village-terrain.ts`**

```typescript
// src/game-core/map/village-terrain.ts
import type { Direction, TileLayer, TileMap, TileType } from "@/game-core/types/map"

function emptyLayer(name: TileLayer["name"], width: number, height: number): TileLayer {
  return {
    name,
    tiles: Array.from({ length: height }, () => Array<TileType | null>(width).fill(null)),
  }
}

export function generateVillageTerrain(): TileMap {
  const width = 100
  const height = 100

  const ground: TileType[][] = Array.from({ length: height }, () =>
    Array<TileType>(width).fill("grass")
  )
  const elevation: number[][] = Array.from({ length: height }, () => Array<number>(width).fill(0))
  const objectTiles: (TileType | null)[][] = Array.from({ length: height }, () =>
    Array<TileType | null>(width).fill(null)
  )

  const fillGround = (tile: TileType, x1: number, y1: number, x2: number, y2: number) => {
    for (let y = y1; y <= y2; y++)
      for (let x = x1; x <= x2; x++)
        if (x >= 0 && x < width && y >= 0 && y < height) ground[y][x] = tile
  }

  const fillElev = (val: number, x1: number, y1: number, x2: number, y2: number) => {
    for (let y = y1; y <= y2; y++)
      for (let x = x1; x <= x2; x++)
        if (x >= 0 && x < width && y >= 0 && y < height) elevation[y][x] = val
  }

  const setObj = (tile: TileType | null, x: number, y: number) => {
    if (x >= 0 && x < width && y >= 0 && y < height) objectTiles[y][x] = tile
  }

  // 1. 물 테두리 (2타일)
  fillGround("water", 0, 0, width - 1, 1)
  fillGround("water", 0, height - 2, width - 1, height - 1)
  fillGround("water", 0, 0, 1, height - 1)
  fillGround("water", width - 2, 0, width - 1, height - 1)

  // 2. 흙 마당 (먼저 깔고, 건물 잔디가 덮어씀)
  fillGround("dirt", 36, 31, 48, 43) // 여관 마당
  fillGround("dirt", 57, 30, 67, 42) // 대장간 마당
  fillGround("dirt", 37, 51, 49, 62) // 시장 마당

  // 3. 건물 플랫폼 (잔디 + elevation=1 → 언덕 오토타일로 렌더링됨)
  fillGround("grass", 38, 33, 46, 41); fillElev(1, 38, 33, 46, 41) // 여관
  fillGround("grass", 52, 38, 59, 45); fillElev(1, 52, 38, 59, 45) // 마을 회관
  fillGround("grass", 59, 32, 65, 40); fillElev(1, 59, 32, 65, 40) // 대장간
  fillGround("grass", 39, 53, 47, 60); fillElev(1, 39, 53, 47, 60) // 시장
  fillGround("grass", 61, 62, 72, 73); fillElev(1, 61, 62, 72, 73) // 귀족 별장
  fillGround("grass", 66, 47, 73, 53); fillElev(1, 66, 47, 73, 53) // 농가

  // 4. 도로 (path, elevation=0 — 건물 위도 덮어씀)
  fillGround("path", 48, 2, 50, 97); fillElev(0, 48, 2, 50, 97) // N-S
  fillGround("path", 2, 48, 97, 50); fillElev(0, 2, 48, 97, 50) // E-W

  // 5. 양 우리 울타리 (object layer, 경계: x=31..37, y=34..41)
  for (let x = 31; x <= 37; x++) {
    setObj("fence", x, 34)
    setObj("fence", x, 41)
  }
  for (let y = 35; y <= 40; y++) {
    setObj("fence", 31, y)
    setObj("fence", 37, y)
  }

  // 6. 스폰 포인트
  const spawnPoints = [
    { id: "player_start", x: 50, y: 52, facing: "down"  as Direction, entityType: "player" as const },
    { id: "npc_1",  x: 46, y: 47, facing: "right" as Direction, entityType: "npc" as const, npcId: "npc_1"  },
    { id: "npc_2",  x: 54, y: 51, facing: "left"  as Direction, entityType: "npc" as const, npcId: "npc_2"  },
    { id: "npc_3",  x: 48, y: 56, facing: "up"    as Direction, entityType: "npc" as const, npcId: "npc_3"  },
    { id: "npc_4",  x: 56, y: 46, facing: "down"  as Direction, entityType: "npc" as const, npcId: "npc_4"  },
    { id: "npc_5",  x: 42, y: 49, facing: "right" as Direction, entityType: "npc" as const, npcId: "npc_5"  },
    { id: "npc_6",  x: 47, y: 43, facing: "down"  as Direction, entityType: "npc" as const, npcId: "npc_6"  },
    { id: "npc_7",  x: 60, y: 66, facing: "right" as Direction, entityType: "npc" as const, npcId: "npc_7"  },
    { id: "npc_8",  x: 48, y: 55, facing: "up"    as Direction, entityType: "npc" as const, npcId: "npc_8"  },
    { id: "npc_9",  x: 53, y: 58, facing: "up"    as Direction, entityType: "npc" as const, npcId: "npc_9"  },
    { id: "npc_10", x: 50, y: 45, facing: "down"  as Direction, entityType: "npc" as const, npcId: "npc_10" },
    { id: "npc_11", x: 65, y: 50, facing: "left"  as Direction, entityType: "npc" as const, npcId: "npc_11" },
    { id: "npc_12", x: 34, y: 38, facing: "down"  as Direction, entityType: "npc" as const, npcId: "npc_12" },
    { id: "npc_13", x: 58, y: 37, facing: "right" as Direction, entityType: "npc" as const, npcId: "npc_13" },
  ]

  // 스폰 타일 잔디+elevation=0 보장
  for (const sp of spawnPoints) {
    if (ground[sp.y]?.[sp.x] === "water") continue
    ground[sp.y][sp.x] = "grass"
    elevation[sp.y][sp.x] = 0
  }

  return {
    meta: { id: "village_world", name: "마을", biome: "village" },
    width,
    height,
    tileSize: 16,
    layers: [
      { name: "ground", tiles: ground },
      emptyLayer("decoration", width, height),
      { name: "object", tiles: objectTiles },
      emptyLayer("overlay", width, height),
    ],
    elevation,
    spawnPoints,
    transitions: [],
  }
}
```

- [ ] **Step 3: Run tests — expect PASS**

```
npx vitest run tests/game-core/map/village-terrain.test.ts
```
Expected: PASS (13 tests)

- [ ] **Step 4: Commit**

```bash
git add src/game-core/map/village-terrain.ts tests/game-core/map/village-terrain.test.ts
git commit -m "feat: add village terrain generator (100x100)"
```

---

### Task 3: Wire Village Terrain into the World Page

**Files:**
- Modify: `src/app/dev/world/page.tsx`

- [ ] **Step 1: Swap terrain generator**

In `src/app/dev/world/page.tsx`, replace the import:
```typescript
import { generateRandomTerrain } from "@/game-core/map/random-terrain"
```
with:
```typescript
import { generateVillageTerrain } from "@/game-core/map/village-terrain"
```

Replace the constant:
```typescript
const WORLD = loadMap(generateRandomTerrain(200, 200))
```
with:
```typescript
const WORLD = loadMap(generateVillageTerrain())
```

- [ ] **Step 2: Update the h1 heading**

Find:
```tsx
World — 200x200 랜덤 맵 + 추적 카메라 + NPC
```
Replace with:
```tsx
World — 100x100 마을 + 추적 카메라 + NPC
```

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/app/dev/world/page.tsx
git commit -m "feat: switch world page to village terrain (100x100)"
```

---

### Task 4: Update NPC Waypoints for Village Coordinates

**Files:**
- Modify: `src/game-core/game-loop/world-dialogue.ts`

Context: All waypoints currently reference coordinates from the old 200×200 map (center at 100,100). The new village is 100×100 with center at 50,50. Update every NPC's `waypoints` and `habits`, and update `availableLocations` in `makeWorldDialogueGameState`.

- [ ] **Step 1: Run existing world-dialogue tests (baseline)**

```
npx vitest run tests/game-core/game-loop/world-dialogue.test.ts
```
Note the passing count.

- [ ] **Step 2: Update all waypoints in `NPC_BLUEPRINTS`**

Replace each NPC's `waypoints` and `habits` location strings as follows. Only change those two fields per NPC — keep everything else (name, personality, dislikeds, speechStyle, spriteId, characterPromptKey) identical.

```typescript
// npc_1 라미
waypoints: [
  { x: 46, y: 46, label: "여관 앞 풀밭" },
  { x: 50, y: 50, label: "마을 중심" },
],
habits: [{ action: "풀밭 살피기", location: "여관 앞 풀밭", gameHour: 10, duration: 45 }],

// npc_2 도윤
waypoints: [
  { x: 55, y: 51, label: "동쪽 길목" },
  { x: 50, y: 50, label: "마을 중심" },
],
habits: [{ action: "길목 확인하기", location: "동쪽 길목", gameHour: 10, duration: 30 }],

// npc_3 하린
waypoints: [
  { x: 47, y: 56, label: "남쪽 공터" },
  { x: 50, y: 50, label: "마을 중심" },
],
habits: [{ action: "마을 기록 정리", location: "남쪽 공터", gameHour: 10, duration: 60 }],

// npc_4 무진
waypoints: [
  { x: 56, y: 45, label: "북동쪽 작업터" },
  { x: 50, y: 50, label: "마을 중심" },
],
habits: [{ action: "도구 손질", location: "북동쪽 작업터", gameHour: 10, duration: 50 }],

// npc_5 카엔 (guard)
waypoints: [
  { x: 42, y: 49, label: "마을 서쪽 입구" },
  { x: 50, y: 50, label: "마을 중심" },
],
habits: [{ action: "순찰", location: "마을 서쪽 입구", gameHour: 8, duration: 120 }],

// npc_6 마리 (innkeeper)
waypoints: [
  { x: 42, y: 38, label: "여관" },
  { x: 50, y: 50, label: "마을 중심" },
],
habits: [{ action: "여관 청소", location: "여관", gameHour: 7, duration: 60 }],

// npc_7 시릴 (noble)
waypoints: [
  { x: 60, y: 67, label: "귀족 별장" },
  { x: 50, y: 50, label: "마을 중심" },
],
habits: [{ action: "별장 정원 산책", location: "귀족 별장", gameHour: 15, duration: 45 }],

// npc_8 탄 (street vendor)
waypoints: [
  { x: 48, y: 55, label: "시장 앞" },
  { x: 50, y: 50, label: "마을 중심" },
],
habits: [{ action: "물건 정리", location: "시장 앞", gameHour: 9, duration: 30 }],

// npc_9 나리 (vegetable vendor)
waypoints: [
  { x: 53, y: 58, label: "채소 가판대" },
  { x: 50, y: 50, label: "마을 중심" },
],
habits: [{ action: "채소 가판대 정리", location: "채소 가판대", gameHour: 6, duration: 90 }],

// npc_10 베아 (townsfolk)
waypoints: [
  { x: 50, y: 45, label: "마을 광장" },
  { x: 50, y: 50, label: "마을 중심" },
],
habits: [{ action: "광장 구경", location: "마을 광장", gameHour: 11, duration: 60 }],

// npc_11 루카 (villager)
waypoints: [
  { x: 67, y: 50, label: "동쪽 농가" },
  { x: 50, y: 50, label: "마을 중심" },
],
habits: [{ action: "밭 돌보기", location: "동쪽 농가", gameHour: 6, duration: 180 }],

// npc_12 모모 (sheep)
waypoints: [
  { x: 34, y: 38, label: "양 우리" },
  { x: 50, y: 50, label: "마을 중심" },
],
habits: [{ action: "풀 뜯기", location: "양 우리", gameHour: 8, duration: 240 }],

// npc_13 브렌 (blacksmith)
waypoints: [
  { x: 58, y: 37, label: "대장간" },
  { x: 50, y: 50, label: "마을 중심" },
],
habits: [{ action: "쇠 두드리기", location: "대장간", gameHour: 6, duration: 150 }],
```

- [ ] **Step 3: Update `availableLocations` in `makeWorldDialogueGameState`**

Find:
```typescript
availableLocations: ["마을 중심", "작은 풀밭", "동쪽 길목", "남쪽 공터", "북동쪽 작업터"],
```
Replace with:
```typescript
availableLocations: [
  "마을 중심", "마을 광장", "여관", "대장간", "시장 앞",
  "채소 가판대", "귀족 별장", "동쪽 농가", "양 우리",
  "마을 서쪽 입구", "동쪽 길목", "남쪽 공터",
],
```

- [ ] **Step 4: Type-check**

```
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 5: Run all tests**

```
npx vitest run
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/game-core/game-loop/world-dialogue.ts
git commit -m "feat: update NPC waypoints for village terrain (100x100)"
```
