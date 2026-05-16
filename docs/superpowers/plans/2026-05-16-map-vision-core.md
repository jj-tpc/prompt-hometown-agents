# Map & Vision Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PRD Phase 1-3.5 + Phase 8 구현 — 타일 맵 타입 정의, LOS 알고리즘, 시야 계산, JSON 맵 로더, 단차 통행 규칙, Agent 연동까지. (3/4 탑다운 + elevation 반영)

**Architecture:** `src/game-core/types/map.ts`에 모든 타입 정의 → `src/game-core/map/`에 타일 상수 + 로더 → `src/game-core/vision/`에 LOS + computeVision + 이벤트 에미터 → `src/game-core/types/npc.ts`에 `visionProfile` 필드 추가 → `src/game-core/agent/vision-interaction-bridge.ts`에서 시야 이벤트를 `interactWithNPC`로 연결. 모든 테스트는 `tests/game-core/` 아래 소스 미러링 구조.

**Tech Stack:** TypeScript, Jest + ts-jest, `@/` 경로 alias

**PRD 범위:** Phase 1(타입) + Phase 2(LOS + 이벤트) + Phase 3(JSON 로더) + Phase 3.5(단차 통행) + Phase 8(Agent 연동). Phase 4-7(절차적 생성)과 Phase 9(렌더러)는 별도 플랜.

---

## 파일 구조

```
생성:
  src/game-core/types/map.ts               ← 모든 맵/시야 타입
  src/game-core/map/tile-definitions.ts    ← TileType별 walkable/transparent 상수
  src/game-core/map/loader.ts              ← TileMap JSON 로더 + 유효성 검사
  src/game-core/map/traversal.ts           ← canTraverse (단차/계단 통행 규칙)
  src/game-core/vision/line-of-sight.ts   ← Bresenham LOS + isTileTransparent
  src/game-core/vision/compute-vision.ts  ← Linear/Cone/Radius 시야 + proximityRange
  src/game-core/vision/vision-event-emitter.ts ← prev/curr diff → VisionEvent[]
  src/game-core/agent/vision-interaction-bridge.ts ← VisionEvent → interactWithNPC
  src/game-core/fixtures/sample-maps.ts   ← 테스트용 TileMap 픽스처
  tests/game-core/map/tile-definitions.test.ts
  tests/game-core/map/loader.test.ts
  tests/game-core/map/traversal.test.ts
  tests/game-core/vision/line-of-sight.test.ts
  tests/game-core/vision/compute-vision.test.ts
  tests/game-core/vision/vision-event-emitter.test.ts
  tests/game-core/agent/vision-interaction-bridge.test.ts

수정:
  src/game-core/fixtures/sample-npcs.ts   ← visionProfile 추가
  src/game-core/types/npc.ts              ← visionProfile?: NPCVisionProfile 추가
```

---

## Task 1: Map & Vision 타입 정의

**Files:**
- Create: `src/game-core/types/map.ts`

- [ ] **Step 1: 파일 생성**

```typescript
// src/game-core/types/map.ts

export type Direction = "up" | "down" | "left" | "right"

export type TileType =
  | "void"
  | "grass"
  | "dirt"
  | "path"
  | "sand"
  | "water"
  | "shallow_water"
  | "mountain"
  | "tree"
  | "bush"
  | "tall_grass"
  | "wall"
  | "fence"
  | "building_floor"
  | "building_wall"
  | "roof"
  | "cliff_face"
  | "stairs"
  | "door"
  | "chest"
  | "sign"
  | "npc_spawn"
  | "player_spawn"

export type LayerName = "ground" | "decoration" | "object" | "overlay"

export type TileDefinition = {
  type: TileType
  walkable: boolean
  transparent: boolean
  spriteId: string
  autoTileGroup?: string
}

export type TileLayer = {
  name: LayerName
  tiles: (TileType | null)[][]  // [y][x]
}

export type SpawnPoint = {
  id: string
  x: number
  y: number
  facing: Direction
  entityType: "player" | "npc"
  npcId?: string
}

export type MapTransition = {
  x: number
  y: number
  targetMapId: string
  targetX: number
  targetY: number
  facing: Direction
}

export type MapMetadata = {
  id: string
  name: string
  biome: "village" | "forest" | "beach" | "mountain" | "cave" | "indoor"
  weather?: "clear" | "rain" | "snow"
  musicId?: string
}

export type TileMap = {
  meta: MapMetadata
  width: number
  height: number
  tileSize: 16
  layers: TileLayer[]
  elevation: number[][]  // [y][x] 셀별 정수 레벨 (평지는 전부 0)
  spawnPoints: SpawnPoint[]
  transitions: MapTransition[]
}

// --- Vision ---

export type LinearVision = {
  type: "linear"
  range: number
  facing: Direction
}

export type ConeVision = {
  type: "cone"
  range: number
  halfAngle: number
  facing: Direction
}

export type RadiusVision = {
  type: "radius"
  range: number
}

export type VisionConfig = LinearVision | ConeVision | RadiusVision

export type NPCVisionProfile = {
  visionConfig: VisionConfig
  proximityRange?: number
  reactionType: "exclamation" | "alert" | "approach" | "ignore"
}

export type VisionEventType = "DETECTED" | "LOST_SIGHT"

export type VisionEvent = {
  type: VisionEventType
  npcId: string
  targetId: string
  targetPosition: { x: number; y: number }
  distance: number
  timestamp: number
}

export type VisionResult = {
  detectedEntities: Array<{
    entityId: string
    entityType: "player" | "npc" | "item"
    position: { x: number; y: number }
    distance: number
    hasLOS: boolean
  }>
  visibleTilePositions: Array<{ x: number; y: number }>
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/game-core/types/map.ts
git commit -m "feat: add map and vision type definitions"
```

---

## Task 2: 타일 정의 상수

**Files:**
- Create: `src/game-core/map/tile-definitions.ts`
- Create: `tests/game-core/map/tile-definitions.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// tests/game-core/map/tile-definitions.test.ts
import { TILE_DEFINITIONS } from "@/game-core/map/tile-definitions"
import type { TileType } from "@/game-core/types/map"

const ALL_TILE_TYPES: TileType[] = [
  "void", "grass", "dirt", "path", "sand", "water", "shallow_water", "mountain",
  "tree", "bush", "tall_grass",
  "wall", "fence", "building_floor", "building_wall", "roof",
  "cliff_face", "stairs",
  "door", "chest", "sign", "npc_spawn", "player_spawn",
]

describe("TILE_DEFINITIONS", () => {
  it("모든 TileType에 대한 정의가 존재한다", () => {
    for (const type of ALL_TILE_TYPES) {
      expect(TILE_DEFINITIONS[type]).toBeDefined()
      expect(TILE_DEFINITIONS[type].type).toBe(type)
    }
  })

  it("걸을 수 없는 타일이 올바르게 정의된다", () => {
    expect(TILE_DEFINITIONS["void"].walkable).toBe(false)
    expect(TILE_DEFINITIONS["water"].walkable).toBe(false)
    expect(TILE_DEFINITIONS["mountain"].walkable).toBe(false)
    expect(TILE_DEFINITIONS["tree"].walkable).toBe(false)
    expect(TILE_DEFINITIONS["wall"].walkable).toBe(false)
    expect(TILE_DEFINITIONS["building_wall"].walkable).toBe(false)
    expect(TILE_DEFINITIONS["cliff_face"].walkable).toBe(false)
  })

  it("걸을 수 있는 타일이 올바르게 정의된다", () => {
    expect(TILE_DEFINITIONS["grass"].walkable).toBe(true)
    expect(TILE_DEFINITIONS["path"].walkable).toBe(true)
    expect(TILE_DEFINITIONS["building_floor"].walkable).toBe(true)
    expect(TILE_DEFINITIONS["tall_grass"].walkable).toBe(true)
    expect(TILE_DEFINITIONS["shallow_water"].walkable).toBe(true)
    expect(TILE_DEFINITIONS["stairs"].walkable).toBe(true)
  })

  it("시야를 차단하는 타일이 올바르게 정의된다 (transparent=false)", () => {
    expect(TILE_DEFINITIONS["void"].transparent).toBe(false)
    expect(TILE_DEFINITIONS["wall"].transparent).toBe(false)
    expect(TILE_DEFINITIONS["building_wall"].transparent).toBe(false)
    expect(TILE_DEFINITIONS["tree"].transparent).toBe(false)
    expect(TILE_DEFINITIONS["mountain"].transparent).toBe(false)
    expect(TILE_DEFINITIONS["cliff_face"].transparent).toBe(false)
  })

  it("시야를 통과하는 타일이 올바르게 정의된다 (transparent=true)", () => {
    expect(TILE_DEFINITIONS["grass"].transparent).toBe(true)
    expect(TILE_DEFINITIONS["water"].transparent).toBe(true)
    expect(TILE_DEFINITIONS["fence"].transparent).toBe(true)
    expect(TILE_DEFINITIONS["tall_grass"].transparent).toBe(true)
    expect(TILE_DEFINITIONS["building_floor"].transparent).toBe(true)
    expect(TILE_DEFINITIONS["stairs"].transparent).toBe(true)
  })

  it("모든 정의의 spriteId가 비어있지 않다", () => {
    for (const type of ALL_TILE_TYPES) {
      expect(TILE_DEFINITIONS[type].spriteId.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest tests/game-core/map/tile-definitions.test.ts --no-coverage`
Expected: FAIL — "Cannot find module '@/game-core/map/tile-definitions'"

- [ ] **Step 3: 구현 작성**

```typescript
// src/game-core/map/tile-definitions.ts
import type { TileDefinition, TileType } from "@/game-core/types/map"

export const TILE_DEFINITIONS: Record<TileType, TileDefinition> = {
  void:           { type: "void",           walkable: false, transparent: false, spriteId: "tiles:void" },
  grass:          { type: "grass",          walkable: true,  transparent: true,  spriteId: "tiles:grass" },
  dirt:           { type: "dirt",           walkable: true,  transparent: true,  spriteId: "tiles:dirt" },
  path:           { type: "path",           walkable: true,  transparent: true,  spriteId: "tiles:path" },
  sand:           { type: "sand",           walkable: true,  transparent: true,  spriteId: "tiles:sand" },
  water:          { type: "water",          walkable: false, transparent: true,  spriteId: "tiles:water" },
  shallow_water:  { type: "shallow_water",  walkable: true,  transparent: true,  spriteId: "tiles:shallow_water" },
  mountain:       { type: "mountain",       walkable: false, transparent: false, spriteId: "tiles:mountain" },
  tree:           { type: "tree",           walkable: false, transparent: false, spriteId: "tiles:tree" },
  bush:           { type: "bush",           walkable: false, transparent: true,  spriteId: "tiles:bush" },
  tall_grass:     { type: "tall_grass",     walkable: true,  transparent: true,  spriteId: "tiles:tall_grass" },
  wall:           { type: "wall",           walkable: false, transparent: false, spriteId: "tiles:wall" },
  fence:          { type: "fence",          walkable: false, transparent: true,  spriteId: "tiles:fence" },
  building_floor: { type: "building_floor", walkable: true,  transparent: true,  spriteId: "tiles:building_floor" },
  building_wall:  { type: "building_wall",  walkable: false, transparent: false, spriteId: "tiles:building_wall" },
  roof:           { type: "roof",           walkable: false, transparent: true,  spriteId: "tiles:roof" },
  cliff_face:     { type: "cliff_face",     walkable: false, transparent: false, spriteId: "tiles:cliff_face" },
  stairs:         { type: "stairs",         walkable: true,  transparent: true,  spriteId: "tiles:stairs" },
  door:           { type: "door",           walkable: true,  transparent: true,  spriteId: "tiles:door" },
  chest:          { type: "chest",          walkable: false, transparent: true,  spriteId: "tiles:chest" },
  sign:           { type: "sign",           walkable: false, transparent: true,  spriteId: "tiles:sign" },
  npc_spawn:      { type: "npc_spawn",      walkable: true,  transparent: true,  spriteId: "tiles:npc_spawn" },
  player_spawn:   { type: "player_spawn",   walkable: true,  transparent: true,  spriteId: "tiles:player_spawn" },
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest tests/game-core/map/tile-definitions.test.ts --no-coverage`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/game-core/map/tile-definitions.ts tests/game-core/map/tile-definitions.test.ts
git commit -m "feat: add tile definitions with walkable/transparent properties"
```

---

## Task 3: 샘플 맵 픽스처

**Files:**
- Create: `src/game-core/fixtures/sample-maps.ts`

이 픽스처는 Task 5~7, 11 테스트에서 공유한다. 세 가지 맵을 제공한다:
- `sampleOpenMap()`: 8×8 전체 잔디, 벽 없음, 전부 레벨 0 — LOS 통과 테스트용
- `sampleWalledMap()`: 8×8, x=4 열에 wall (y=1~y=6), 전부 레벨 0 — LOS 차단 테스트용
- `sampleElevatedMap()`: 8×8, x≤3 레벨 0 / x≥4 레벨 1, x=4 열은 cliff_face(단 (4,4)는 stairs) — 단차 통행 테스트용

```
sampleOpenMap() 레이아웃 (8×8):
Ground:  모두 grass
Object:  모두 null
플레이어 스폰: (1,3) 오른쪽 방향
NPC 스폰: (6,3) 왼쪽 방향

sampleWalledMap() 레이아웃 (8×8):
Ground:  모두 grass
Object:  x=4, y=1~6에 wall
플레이어 스폰: (1,3) 오른쪽 방향
NPC 스폰: (6,3) 왼쪽 방향

시각화 (object layer, . = null):
y\x  0  1  2  3  4  5  6  7
0    .  .  .  .  .  .  .  .
1    .  .  .  .  W  .  .  .   ← wall at x=4
2    .  .  .  .  W  .  .  .
3    P  .  .  .  W  .  N  .   ← 플레이어(1,3), NPC(6,3) 사이에 벽
4    .  .  .  .  W  .  .  .
5    .  .  .  .  W  .  .  .
6    .  .  .  .  W  .  .  .
7    .  .  .  .  .  .  .  .
```

- [ ] **Step 1: 파일 생성**

```typescript
// src/game-core/fixtures/sample-maps.ts
import type { TileMap, TileLayer, TileType } from "@/game-core/types/map"

function makeGroundLayer(width: number, height: number, fill: TileType = "grass"): TileLayer {
  return {
    name: "ground",
    tiles: Array.from({ length: height }, () => Array(width).fill(fill) as TileType[]),
  }
}

function makeEmptyLayer(width: number, height: number, name: TileLayer["name"]): TileLayer {
  return {
    name,
    tiles: Array.from({ length: height }, () => Array(width).fill(null)),
  }
}

function makeFlatElevation(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => Array(width).fill(0))
}

export function sampleOpenMap(): TileMap {
  return {
    meta: { id: "open_test", name: "Open Test Map", biome: "village" },
    width: 8,
    height: 8,
    tileSize: 16,
    layers: [
      makeGroundLayer(8, 8),
      makeEmptyLayer(8, 8, "decoration"),
      makeEmptyLayer(8, 8, "object"),
      makeEmptyLayer(8, 8, "overlay"),
    ],
    elevation: makeFlatElevation(8, 8),
    spawnPoints: [
      { id: "player_start", x: 1, y: 3, facing: "right", entityType: "player" },
      { id: "npc_spawn", x: 6, y: 3, facing: "left", entityType: "npc", npcId: "npc_rabbit" },
    ],
    transitions: [],
  }
}

export function sampleWalledMap(): TileMap {
  // wall column at x=4, rows 1-6
  const objectTiles: (TileType | null)[][] = Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => (x === 4 && y >= 1 && y <= 6 ? "wall" : null))
  )

  return {
    meta: { id: "walled_test", name: "Walled Test Map", biome: "village" },
    width: 8,
    height: 8,
    tileSize: 16,
    layers: [
      makeGroundLayer(8, 8),
      makeEmptyLayer(8, 8, "decoration"),
      { name: "object", tiles: objectTiles },
      makeEmptyLayer(8, 8, "overlay"),
    ],
    elevation: makeFlatElevation(8, 8),
    spawnPoints: [
      { id: "player_start", x: 1, y: 3, facing: "right", entityType: "player" },
      { id: "npc_spawn", x: 6, y: 3, facing: "left", entityType: "npc", npcId: "npc_rabbit" },
    ],
    transitions: [],
  }
}

export function sampleElevatedMap(): TileMap {
  // x 0-3 = 레벨 0, x 4-7 = 레벨 1.
  // 경계 x=4 열은 cliff_face, 단 (4,4)는 stairs로 두 레벨을 연결한다.
  const elevation: number[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (_, x) => (x <= 3 ? 0 : 1))
  )
  const objectTiles: (TileType | null)[][] = Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => {
      if (x !== 4) return null
      return y === 4 ? "stairs" : "cliff_face"
    })
  )

  return {
    meta: { id: "elevated_test", name: "Elevated Test Map", biome: "mountain" },
    width: 8,
    height: 8,
    tileSize: 16,
    layers: [
      makeGroundLayer(8, 8),
      makeEmptyLayer(8, 8, "decoration"),
      { name: "object", tiles: objectTiles },
      makeEmptyLayer(8, 8, "overlay"),
    ],
    elevation,
    spawnPoints: [
      { id: "player_start", x: 1, y: 1, facing: "right", entityType: "player" },
    ],
    transitions: [],
  }
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/game-core/fixtures/sample-maps.ts
git commit -m "feat: add sample map fixtures for vision tests"
```

---

## Task 4: JSON 맵 로더

**Files:**
- Create: `src/game-core/map/loader.ts`
- Create: `tests/game-core/map/loader.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// tests/game-core/map/loader.test.ts
import { loadMap } from "@/game-core/map/loader"
import { sampleOpenMap } from "@/game-core/fixtures/sample-maps"

const VALID_JSON = sampleOpenMap()

describe("loadMap", () => {
  // 유효한 맵을 깊은 복제(JSON round-trip)해 한 필드씩 손상시켜 검증한다
  function clone() {
    return JSON.parse(JSON.stringify(VALID_JSON))
  }

  it("유효한 TileMap JSON을 올바르게 파싱한다", () => {
    const result = loadMap(VALID_JSON)
    expect(result.meta.id).toBe("open_test")
    expect(result.width).toBe(8)
    expect(result.height).toBe(8)
    expect(result.tileSize).toBe(16)
    expect(result.layers).toHaveLength(4)
    expect(result.layers[0].name).toBe("ground")
    expect(result.layers[3].name).toBe("overlay")
    expect(result.spawnPoints).toHaveLength(2)
    expect(result.transitions).toHaveLength(0)
  })

  it("null 입력에 대해 에러를 던진다", () => {
    expect(() => loadMap(null)).toThrow("Invalid TileMap: not an object")
  })

  it("문자열 입력에 대해 에러를 던진다", () => {
    expect(() => loadMap("invalid")).toThrow("Invalid TileMap: not an object")
  })

  it("필수 최상위 필드 누락 시 에러를 던진다", () => {
    expect(() => loadMap({ meta: { id: "x" } })).toThrow(
      "Invalid TileMap: missing required fields"
    )
  })

  it("width가 양의 정수가 아니면 에러를 던진다", () => {
    const bad = clone()
    bad.width = 0
    expect(() => loadMap(bad)).toThrow("Invalid TileMap: width must be a positive integer")
  })

  it("tileSize가 16이 아니면 에러를 던진다", () => {
    const bad = clone()
    bad.tileSize = 32
    expect(() => loadMap(bad)).toThrow("Invalid TileMap: tileSize must be 16")
  })

  it("biome이 허용 목록에 없으면 에러를 던진다", () => {
    const bad = clone()
    bad.meta.biome = "space_station"
    expect(() => loadMap(bad)).toThrow("Invalid TileMap: meta.biome")
  })

  it("layers가 배열이 아니면 에러를 던진다", () => {
    const bad = clone()
    bad.layers = "bad"
    expect(() => loadMap(bad)).toThrow("Invalid TileMap: layers must be an array")
  })

  it("layers 개수가 4가 아니면 에러를 던진다", () => {
    const bad = clone()
    bad.layers.pop()
    expect(() => loadMap(bad)).toThrow(
      "Invalid TileMap: layers must contain exactly 4 layers"
    )
  })

  it("layer 이름 순서가 틀리면 에러를 던진다", () => {
    const bad = clone()
    bad.layers[0].name = "object"
    expect(() => loadMap(bad)).toThrow('Invalid TileMap: layer[0].name must be "ground"')
  })

  it("layer row 길이가 width와 다르면 에러를 던진다", () => {
    const bad = clone()
    bad.layers[0].tiles[0] = bad.layers[0].tiles[0].slice(0, 5)  // 8 → 5
    expect(() => loadMap(bad)).toThrow("must have 8 columns")
  })

  it("알 수 없는 TileType이 있으면 에러를 던진다", () => {
    const bad = clone()
    bad.layers[0].tiles[2][2] = "lava"  // TILE_DEFINITIONS에 없는 타입
    expect(() => loadMap(bad)).toThrow("is not a valid TileType")
  })

  it("spawnPoint 좌표가 맵 밖이면 에러를 던진다", () => {
    const bad = clone()
    bad.spawnPoints[0].x = 99
    expect(() => loadMap(bad)).toThrow("is out of bounds")
  })

  it("elevation 행 개수가 height와 다르면 에러를 던진다", () => {
    const bad = clone()
    bad.elevation.pop()  // 8 → 7 rows
    expect(() => loadMap(bad)).toThrow("Invalid TileMap: elevation must have 8 rows")
  })

  it("elevation에 음수 레벨이 있으면 에러를 던진다", () => {
    const bad = clone()
    bad.elevation[2][2] = -1
    expect(() => loadMap(bad)).toThrow("must be a non-negative integer")
  })

  it("JSON.parse를 거친 문자열도 처리한다", () => {
    const result = loadMap(JSON.parse(JSON.stringify(VALID_JSON)))
    expect(result.meta.id).toBe("open_test")
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest tests/game-core/map/loader.test.ts --no-coverage`
Expected: FAIL — "Cannot find module '@/game-core/map/loader'"

- [ ] **Step 3: 구현 작성**

`loadMap`은 신뢰할 수 없는 JSON을 그대로 `as TileMap`으로 캐스팅하면 안 된다. 잘못된
맵이 로딩을 통과하면 이후 `isTileTransparent`/vision 코드에서 크래시하거나 잘못된
충돌/LOS 동작을 일으킨다. 따라서 TileMap 계약 전체를 런타임 검증한다.

```typescript
// src/game-core/map/loader.ts
import { TILE_DEFINITIONS } from "@/game-core/map/tile-definitions"
import type { TileMap, LayerName, MapMetadata } from "@/game-core/types/map"

const LAYER_ORDER: LayerName[] = ["ground", "decoration", "object", "overlay"]
const VALID_BIOMES: MapMetadata["biome"][] = [
  "village", "forest", "beach", "mountain", "cave", "indoor",
]

function fail(message: string): never {
  throw new Error(`Invalid TileMap: ${message}`)
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0
}

function inBounds(x: unknown, y: unknown, width: number, height: number): boolean {
  return (
    typeof x === "number" && typeof y === "number" &&
    x >= 0 && x < width && y >= 0 && y < height
  )
}

export function loadMap(json: unknown): TileMap {
  if (typeof json !== "object" || json === null) fail("not an object")
  const data = json as Record<string, unknown>

  if (
    !data.meta ||
    data.width === undefined ||
    data.height === undefined ||
    data.layers === undefined ||
    data.elevation === undefined
  ) {
    fail("missing required fields (meta, width, height, layers, elevation)")
  }

  // 치수
  if (!isPositiveInt(data.width)) fail("width must be a positive integer")
  if (!isPositiveInt(data.height)) fail("height must be a positive integer")
  const width = data.width
  const height = data.height

  // tileSize
  if (data.tileSize !== 16) fail("tileSize must be 16")

  // meta
  if (typeof data.meta !== "object" || data.meta === null) fail("meta must be an object")
  const meta = data.meta as Record<string, unknown>
  if (typeof meta.id !== "string" || meta.id.length === 0) {
    fail("meta.id must be a non-empty string")
  }
  if (typeof meta.name !== "string") fail("meta.name must be a string")
  if (
    typeof meta.biome !== "string" ||
    !VALID_BIOMES.includes(meta.biome as MapMetadata["biome"])
  ) {
    fail(`meta.biome must be one of: ${VALID_BIOMES.join(", ")}`)
  }

  // layers: 정확히 4개, 순서 고정, 직사각형, 알려진 TileType만 허용
  if (!Array.isArray(data.layers)) fail("layers must be an array")
  if (data.layers.length !== 4) fail("layers must contain exactly 4 layers")
  data.layers.forEach((layer: unknown, i: number) => {
    if (typeof layer !== "object" || layer === null) fail(`layer[${i}] must be an object`)
    const l = layer as Record<string, unknown>
    if (l.name !== LAYER_ORDER[i]) fail(`layer[${i}].name must be "${LAYER_ORDER[i]}"`)
    if (!Array.isArray(l.tiles) || l.tiles.length !== height) {
      fail(`layer "${LAYER_ORDER[i]}" must have ${height} rows`)
    }
    l.tiles.forEach((row: unknown, y: number) => {
      if (!Array.isArray(row) || row.length !== width) {
        fail(`layer "${LAYER_ORDER[i]}" row ${y} must have ${width} columns`)
      }
      row.forEach((tile: unknown, x: number) => {
        if (tile === null) return
        if (typeof tile !== "string" || !(tile in TILE_DEFINITIONS)) {
          fail(`layer "${LAYER_ORDER[i]}" tile at (${x},${y}) is not a valid TileType`)
        }
      })
    })
  })

  // elevation: height개 행 × width개 열, 각 값은 0 이상 정수
  if (!Array.isArray(data.elevation) || data.elevation.length !== height) {
    fail(`elevation must have ${height} rows`)
  }
  data.elevation.forEach((row: unknown, y: number) => {
    if (!Array.isArray(row) || row.length !== width) {
      fail(`elevation row ${y} must have ${width} columns`)
    }
    row.forEach((lvl: unknown, x: number) => {
      if (typeof lvl !== "number" || !Number.isInteger(lvl) || lvl < 0) {
        fail(`elevation at (${x},${y}) must be a non-negative integer`)
      }
    })
  })

  // spawnPoints / transitions: 배열이며 좌표가 맵 범위 안
  if (!Array.isArray(data.spawnPoints)) fail("spawnPoints must be an array")
  if (!Array.isArray(data.transitions)) fail("transitions must be an array")
  data.spawnPoints.forEach((sp: unknown) => {
    const s = sp as Record<string, unknown>
    if (!inBounds(s.x, s.y, width, height)) {
      fail(`spawnPoint "${String(s.id)}" is out of bounds`)
    }
  })
  data.transitions.forEach((tr: unknown, i: number) => {
    const t = tr as Record<string, unknown>
    if (!inBounds(t.x, t.y, width, height)) {
      fail(`transition[${i}] coordinate is out of bounds`)
    }
  })

  return json as TileMap
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest tests/game-core/map/loader.test.ts --no-coverage`
Expected: PASS (17 tests)

- [ ] **Step 5: 전체 테스트 회귀 확인**

Run: `npx jest --no-coverage`
Expected: 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/game-core/map/loader.ts tests/game-core/map/loader.test.ts
git commit -m "feat: add JSON map loader with validation"
```

---

## Task 5: Bresenham Line of Sight

**Files:**
- Create: `src/game-core/vision/line-of-sight.ts`
- Create: `tests/game-core/vision/line-of-sight.test.ts`

**알고리즘**: Bresenham's line algorithm. `from`에서 `to`까지 타일을 순서대로 열거하면서, 중간 타일 중 `transparent: false`인 것이 있으면 `false` 반환. 목표 타일 자체는 검사하지 않는다(엔티티가 서 있는 자리는 벽이 아님).

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// tests/game-core/vision/line-of-sight.test.ts
import { hasLineOfSight } from "@/game-core/vision/line-of-sight"
import { sampleOpenMap, sampleWalledMap } from "@/game-core/fixtures/sample-maps"

describe("hasLineOfSight", () => {
  describe("sampleOpenMap (벽 없음)", () => {
    const map = sampleOpenMap()

    it("같은 위치는 항상 true", () => {
      expect(hasLineOfSight(map, { x: 3, y: 3 }, { x: 3, y: 3 })).toBe(true)
    })

    it("수평 직선 경로 — 차단 없음 → true", () => {
      // (6,3) → (1,3): 중간에 (5,3)(4,3)(3,3)(2,3) 모두 grass(transparent)
      expect(hasLineOfSight(map, { x: 6, y: 3 }, { x: 1, y: 3 })).toBe(true)
    })

    it("수직 직선 경로 — 차단 없음 → true", () => {
      expect(hasLineOfSight(map, { x: 3, y: 0 }, { x: 3, y: 7 })).toBe(true)
    })

    it("대각선 경로 — 차단 없음 → true", () => {
      expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 7, y: 7 })).toBe(true)
    })

    it("인접한 타일 → true", () => {
      expect(hasLineOfSight(map, { x: 3, y: 3 }, { x: 4, y: 3 })).toBe(true)
    })

    it("가파른 비-45도 경사 — 차단 없음 → true (회귀: 무한 루프 방지)", () => {
      // (0,0) → (2,5): dx=2, dy=5. y-step에서 dx를 더해야 종료된다
      expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 2, y: 5 })).toBe(true)
    })

    it("완만한 비-45도 경사 — 차단 없음 → true (회귀: 무한 루프 방지)", () => {
      // (0,0) → (7,2): dx=7, dy=2
      expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 7, y: 2 })).toBe(true)
    })

    it("모든 in-bounds 끝점 쌍에 대해 루프가 종료된다 (종료성 보장)", () => {
      // 8×8 맵의 모든 좌표쌍을 호출 — 무한 루프가 있으면 이 테스트가 멈춘다
      for (let x0 = 0; x0 < 8; x0++) {
        for (let y0 = 0; y0 < 8; y0++) {
          for (let x1 = 0; x1 < 8; x1++) {
            for (let y1 = 0; y1 < 8; y1++) {
              expect(typeof hasLineOfSight(map, { x: x0, y: y0 }, { x: x1, y: y1 })).toBe(
                "boolean"
              )
            }
          }
        }
      }
    })
  })

  describe("sampleWalledMap (x=4 열에 wall)", () => {
    const map = sampleWalledMap()

    it("벽을 가로지르는 수평 경로 → false", () => {
      // (6,3) → (1,3): x=4 에 wall → false
      expect(hasLineOfSight(map, { x: 6, y: 3 }, { x: 1, y: 3 })).toBe(false)
    })

    it("벽 앞까지만의 경로 → true", () => {
      // (6,3) → (5,3): 중간 타일 없음 (인접) → true
      expect(hasLineOfSight(map, { x: 6, y: 3 }, { x: 5, y: 3 })).toBe(true)
    })

    it("벽을 지나치지 않는 수직 경로 → true", () => {
      // (2,0) → (2,7): x=2는 벽 없음 → true
      expect(hasLineOfSight(map, { x: 2, y: 0 }, { x: 2, y: 7 })).toBe(true)
    })

    it("y=0 행은 벽 없음 — 수평 통과 → true", () => {
      // (6,0) → (1,0): y=0에는 wall 없음 → true
      expect(hasLineOfSight(map, { x: 6, y: 0 }, { x: 1, y: 0 })).toBe(true)
    })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest tests/game-core/vision/line-of-sight.test.ts --no-coverage`
Expected: FAIL — "Cannot find module '@/game-core/vision/line-of-sight'"

- [ ] **Step 3: 구현 작성**

```typescript
// src/game-core/vision/line-of-sight.ts
import { TILE_DEFINITIONS } from "@/game-core/map/tile-definitions"
import type { TileMap } from "@/game-core/types/map"

export function isTileTransparent(map: TileMap, x: number, y: number): boolean {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return false

  for (const layer of map.layers) {
    if (layer.name === "overlay") continue
    const tileType = layer.tiles[y]?.[x]
    if (tileType == null) continue
    const def = TILE_DEFINITIONS[tileType]
    if (!def.transparent) return false
  }
  return true
}

export function hasLineOfSight(
  map: TileMap,
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean {
  if (from.x === to.x && from.y === to.y) return true

  let x = from.x
  let y = from.y
  const dx = Math.abs(to.x - x)
  const dy = Math.abs(to.y - y)
  const sx = x < to.x ? 1 : -1
  const sy = y < to.y ? 1 : -1
  let err = dx - dy

  while (x !== to.x || y !== to.y) {
    const e2 = 2 * err
    // 표준 Bresenham: x를 step하면 err에서 dy를 빼고, y를 step하면 err에 dx를 더한다.
    // (y-step에서 dy를 더하면 비-45도 기울기에서 x가 목표를 지나쳐 무한 루프가 된다)
    if (e2 > -dy) { err -= dy; x += sx }
    if (e2 < dx) { err += dx; y += sy }

    if (x === to.x && y === to.y) break  // 목표 도달, 목표 타일 자체는 검사 안 함

    if (!isTileTransparent(map, x, y)) return false
  }

  return true
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest tests/game-core/vision/line-of-sight.test.ts --no-coverage`
Expected: PASS (12 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/game-core/vision/line-of-sight.ts tests/game-core/vision/line-of-sight.test.ts
git commit -m "feat: add Bresenham line-of-sight algorithm"
```

---

## Task 6: Compute Vision — Linear

**Files:**
- Create: `src/game-core/vision/compute-vision.ts`
- Create: `tests/game-core/vision/compute-vision.test.ts`

Linear(포켓몬 방식)만 먼저 구현한다. Cone/Radius는 Task 7에서 추가한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// tests/game-core/vision/compute-vision.test.ts
import { computeVision } from "@/game-core/vision/compute-vision"
import { sampleOpenMap, sampleWalledMap } from "@/game-core/fixtures/sample-maps"
import type { NPCVisionProfile } from "@/game-core/types/map"

const PLAYER = { id: "player", type: "player" as const, position: { x: 1, y: 3 } }
const NPC_POS = { x: 6, y: 3 }

describe("computeVision — Linear", () => {
  // proximityRange를 0으로 둬서 순수하게 시야 콘만 검증한다 (proximity는 별도 describe에서 검증).
  const visionLeft: NPCVisionProfile = {
    visionConfig: { type: "linear", range: 5, facing: "left" },
    proximityRange: 0,
    reactionType: "exclamation",
  }
  const visionRight: NPCVisionProfile = {
    visionConfig: { type: "linear", range: 5, facing: "right" },
    proximityRange: 0,
    reactionType: "exclamation",
  }

  it("오픈맵: facing 방향 range 내 엔티티 감지", () => {
    const result = computeVision(NPC_POS, visionLeft, sampleOpenMap(), [PLAYER])
    expect(result.detectedEntities).toHaveLength(1)
    expect(result.detectedEntities[0].entityId).toBe("player")
    expect(result.detectedEntities[0].distance).toBe(5)
    expect(result.detectedEntities[0].hasLOS).toBe(true)
  })

  it("오픈맵: range 초과 엔티티는 감지 안 됨 (distance 6)", () => {
    const farPlayer = { id: "player", type: "player" as const, position: { x: 0, y: 3 } }
    const result = computeVision(NPC_POS, visionLeft, sampleOpenMap(), [farPlayer])
    expect(result.detectedEntities).toHaveLength(0)
  })

  it("오픈맵: facing 방향이 다른 엔티티는 감지 안 됨", () => {
    // NPC는 left를 보는데 플레이어는 NPC 위쪽에 있음
    const abovePlayer = { id: "player", type: "player" as const, position: { x: 6, y: 0 } }
    const result = computeVision(NPC_POS, visionLeft, sampleOpenMap(), [abovePlayer])
    expect(result.detectedEntities).toHaveLength(0)
  })

  it("오픈맵: 반대 방향(right)으로 바라보면 left 플레이어 감지 안 됨", () => {
    const result = computeVision(NPC_POS, visionRight, sampleOpenMap(), [PLAYER])
    expect(result.detectedEntities).toHaveLength(0)
  })

  it("벽이 있는 맵: 벽으로 막힌 플레이어는 감지 안 됨", () => {
    // NPC(6,3) facing left, wall at x=4 → (1,3) 플레이어 감지 불가
    const result = computeVision(NPC_POS, visionLeft, sampleWalledMap(), [PLAYER])
    expect(result.detectedEntities).toHaveLength(0)
  })

  it("벽이 있는 맵: 벽 앞 엔티티는 감지됨", () => {
    // NPC(6,3) facing left, (5,3) 플레이어: 벽 전 → 감지
    const nearPlayer = { id: "player", type: "player" as const, position: { x: 5, y: 3 } }
    const result = computeVision(NPC_POS, visionLeft, sampleWalledMap(), [nearPlayer])
    expect(result.detectedEntities).toHaveLength(1)
    expect(result.detectedEntities[0].distance).toBe(1)
  })

  it("visibleTilePositions에 시야 범위 타일이 포함된다 (벽 전까지)", () => {
    // sampleWalledMap: NPC(6,3) facing left → (5,3) 보임, (4,3)은 wall → stop
    const result = computeVision(NPC_POS, visionLeft, sampleWalledMap(), [])
    const xs = result.visibleTilePositions.map((p) => p.x)
    expect(xs).toContain(5)
    expect(xs).not.toContain(4)  // wall at x=4 stops vision
    expect(xs).not.toContain(3)
  })

  it("range와 정확히 같은 거리의 엔티티는 감지됨 (inclusive)", () => {
    // NPC(6,3) facing left range 5 → (1,3) distance 5: inclusive
    const result = computeVision(NPC_POS, visionLeft, sampleOpenMap(), [PLAYER])
    expect(result.detectedEntities[0].distance).toBe(5)
  })
})

describe("computeVision — proximityRange", () => {
  // proximityRange: 시야 방향과 무관하게 NPC 주변 Chebyshev 거리 내 엔티티를 무조건 감지
  // (PRD 4.2). 시야 콘과 별개로 동작하므로 Linear 구현만으로도 검증 가능하다.
  it("시야 방향 밖의 인접 엔티티도 감지 (NPC 뒤쪽)", () => {
    // NPC(6,3) facing left인데 엔티티는 오른쪽(뒤) (7,3) — 시야 콘 밖, proximity로 감지
    const behind = { id: "behind", type: "player" as const, position: { x: 7, y: 3 } }
    const vp: NPCVisionProfile = {
      visionConfig: { type: "linear", range: 5, facing: "left" },
      proximityRange: 1,
      reactionType: "exclamation",
    }
    const result = computeVision(NPC_POS, vp, sampleOpenMap(), [behind])
    expect(result.detectedEntities.map((e) => e.entityId)).toContain("behind")
  })

  it("대각선 인접 엔티티도 감지 (Chebyshev 거리)", () => {
    // (7,2): dx=1, dy=1 → Chebyshev 1 → proximityRange 1 내
    const diag = { id: "diag", type: "player" as const, position: { x: 7, y: 2 } }
    const vp: NPCVisionProfile = {
      visionConfig: { type: "linear", range: 5, facing: "left" },
      proximityRange: 1,
      reactionType: "exclamation",
    }
    const result = computeVision(NPC_POS, vp, sampleOpenMap(), [diag])
    expect(result.detectedEntities.map((e) => e.entityId)).toContain("diag")
  })

  it("proximity 범위 밖(2칸) 엔티티는 감지 안 됨", () => {
    // (6,5): dy=2 → Chebyshev 2 > proximityRange 1
    const far = { id: "far", type: "player" as const, position: { x: 6, y: 5 } }
    const vp: NPCVisionProfile = {
      visionConfig: { type: "linear", range: 5, facing: "left" },
      proximityRange: 1,
      reactionType: "exclamation",
    }
    const result = computeVision(NPC_POS, vp, sampleOpenMap(), [far])
    expect(result.detectedEntities).toHaveLength(0)
  })

  it("proximityRange 미지정 시 기본값 1이 적용된다", () => {
    const behind = { id: "behind", type: "player" as const, position: { x: 7, y: 3 } }
    const vp: NPCVisionProfile = {
      visionConfig: { type: "linear", range: 5, facing: "left" },
      reactionType: "exclamation",
      // proximityRange 생략 → 기본 1
    }
    const result = computeVision(NPC_POS, vp, sampleOpenMap(), [behind])
    expect(result.detectedEntities.map((e) => e.entityId)).toContain("behind")
  })

  it("시야와 proximity가 같은 엔티티를 동시 감지해도 중복되지 않는다", () => {
    // (5,3): linear 시야(facing left)로도, proximity로도 감지 대상 → 1개만
    const both = { id: "both", type: "player" as const, position: { x: 5, y: 3 } }
    const vp: NPCVisionProfile = {
      visionConfig: { type: "linear", range: 5, facing: "left" },
      proximityRange: 1,
      reactionType: "exclamation",
    }
    const result = computeVision(NPC_POS, vp, sampleOpenMap(), [both])
    expect(result.detectedEntities.filter((e) => e.entityId === "both")).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest tests/game-core/vision/compute-vision.test.ts --no-coverage`
Expected: FAIL — "Cannot find module '@/game-core/vision/compute-vision'"

- [ ] **Step 3: Linear 구현 작성**

```typescript
// src/game-core/vision/compute-vision.ts
import { hasLineOfSight, isTileTransparent } from "@/game-core/vision/line-of-sight"
import type {
  TileMap, VisionConfig, VisionResult, NPCVisionProfile,
  LinearVision, ConeVision, RadiusVision, Direction,
} from "@/game-core/types/map"

type Entity = {
  id: string
  type: "player" | "npc" | "item"
  position: { x: number; y: number }
}

const DEFAULT_PROXIMITY_RANGE = 1

export function computeVision(
  npcPosition: { x: number; y: number },
  visionProfile: NPCVisionProfile,
  map: TileMap,
  entities: Entity[]
): VisionResult {
  const base = computeByConfig(npcPosition, visionProfile.visionConfig, map, entities)
  const proximityRange = visionProfile.proximityRange ?? DEFAULT_PROXIMITY_RANGE
  return applyProximity(npcPosition, proximityRange, base, entities)
}

function computeByConfig(
  npcPosition: { x: number; y: number },
  visionConfig: VisionConfig,
  map: TileMap,
  entities: Entity[]
): VisionResult {
  switch (visionConfig.type) {
    case "linear":
      return computeLinear(npcPosition, visionConfig, map, entities)
    case "cone":
      return computeCone(npcPosition, visionConfig, map, entities)
    case "radius":
      return computeRadius(npcPosition, visionConfig, map, entities)
  }
}

// proximityRange: 시야 방향/타입과 무관하게 NPC 주변 Chebyshev 거리 내 엔티티를 무조건 감지한다.
// (PRD 4.2: "시야 타입 무관, 이 반경 내 진입 시 무조건 감지"). 벽 LOS는 검사하지 않는다.
// 이미 시야 콘으로 감지된 엔티티는 중복 추가하지 않는다.
function applyProximity(
  npcPos: { x: number; y: number },
  proximityRange: number,
  base: VisionResult,
  entities: Entity[]
): VisionResult {
  const detected = [...base.detectedEntities]
  const seen = new Set(detected.map((e) => e.entityId))

  for (const entity of entities) {
    if (seen.has(entity.id)) continue
    const dx = entity.position.x - npcPos.x
    const dy = entity.position.y - npcPos.y
    const chebyshev = Math.max(Math.abs(dx), Math.abs(dy))
    if (chebyshev === 0 || chebyshev > proximityRange) continue

    detected.push({
      entityId: entity.id,
      entityType: entity.type,
      position: entity.position,
      distance: Math.sqrt(dx * dx + dy * dy),
      hasLOS: true,
    })
    seen.add(entity.id)
  }

  return { detectedEntities: detected, visibleTilePositions: base.visibleTilePositions }
}

function directionDelta(facing: Direction): { dx: number; dy: number } {
  switch (facing) {
    case "right": return { dx: 1, dy: 0 }
    case "left":  return { dx: -1, dy: 0 }
    case "down":  return { dx: 0, dy: 1 }
    case "up":    return { dx: 0, dy: -1 }
  }
}

function computeLinear(
  npcPos: { x: number; y: number },
  config: LinearVision,
  map: TileMap,
  entities: Entity[]
): VisionResult {
  const { range, facing } = config
  const { dx, dy } = directionDelta(facing)
  const detectedEntities: VisionResult["detectedEntities"] = []
  const visibleTilePositions: VisionResult["visibleTilePositions"] = []

  for (let i = 1; i <= range; i++) {
    const tx = npcPos.x + dx * i
    const ty = npcPos.y + dy * i

    if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) break
    if (!isTileTransparent(map, tx, ty)) break  // 벽 → 시야 중단

    visibleTilePositions.push({ x: tx, y: ty })

    for (const entity of entities) {
      if (entity.position.x === tx && entity.position.y === ty) {
        detectedEntities.push({
          entityId: entity.id,
          entityType: entity.type,
          position: entity.position,
          distance: i,
          hasLOS: true,  // Linear은 경로를 직접 걸어왔으므로 LOS 보장
        })
      }
    }
  }

  return { detectedEntities, visibleTilePositions }
}

function computeCone(
  npcPos: { x: number; y: number },
  config: ConeVision,
  map: TileMap,
  entities: Entity[]
): VisionResult {
  // Task 7에서 구현
  return { detectedEntities: [], visibleTilePositions: [] }
}

function computeRadius(
  npcPos: { x: number; y: number },
  config: RadiusVision,
  map: TileMap,
  entities: Entity[]
): VisionResult {
  // Task 7에서 구현
  return { detectedEntities: [], visibleTilePositions: [] }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest tests/game-core/vision/compute-vision.test.ts --no-coverage`
Expected: PASS (13 tests — Linear 8 + proximityRange 5)

- [ ] **Step 5: 커밋**

```bash
git add src/game-core/vision/compute-vision.ts tests/game-core/vision/compute-vision.test.ts
git commit -m "feat: add computeVision with Linear type"
```

---

## Task 7: Compute Vision — Cone + Radius

**Files:**
- Modify: `src/game-core/vision/compute-vision.ts`
- Modify: `tests/game-core/vision/compute-vision.test.ts`

- [ ] **Step 1: Cone + Radius 테스트 추가**

기존 `tests/game-core/vision/compute-vision.test.ts` 파일 **끝에** 다음 블록을 추가한다:

```typescript
// ─── 기존 파일 끝에 추가 ───

describe("computeVision — Cone", () => {
  // NPC at (4,4), facing up, halfAngle=45, range=4
  // up 방향 = 화면 위쪽(y 감소)
  // 정면 위: (4,2) angle=0° (facing에서 0° 차이)
  // 오른쪽 위 45°: (5,3) dx=1,dy=-1 → angle 315°(-45°), diff from up(-90°) = 45° → 경계값 포함
  // 완전 오른쪽: (7,4) dx=3,dy=0 → angle 0°, diff from up(-90°) = 90° > 45° → 제외
  const CONE_NPC = { x: 4, y: 4 }
  // proximityRange 0으로 시야 콘만 격리 검증 (파일 상단에서 NPCVisionProfile import)
  const coneUp: NPCVisionProfile = {
    visionConfig: { type: "cone", range: 4, halfAngle: 45, facing: "up" },
    proximityRange: 0,
    reactionType: "exclamation",
  }

  it("정면 위 엔티티 감지", () => {
    const entity = { id: "e1", type: "player" as const, position: { x: 4, y: 2 } }
    const result = computeVision(CONE_NPC, coneUp, sampleOpenMap(), [entity])
    expect(result.detectedEntities.map((e) => e.entityId)).toContain("e1")
  })

  it("cone 각도 밖 엔티티는 감지 안 됨 (right 방향)", () => {
    const entity = { id: "e2", type: "player" as const, position: { x: 7, y: 4 } }
    const result = computeVision(CONE_NPC, coneUp, sampleOpenMap(), [entity])
    expect(result.detectedEntities).toHaveLength(0)
  })

  it("range 초과 엔티티는 감지 안 됨", () => {
    const entity = { id: "e3", type: "player" as const, position: { x: 4, y: 0 } }  // dist=4 OK, 하지만 (4,-1)은 out
    // dist = 4 → range=4, 감지됨 (range inclusive 확인용)
    const result = computeVision(CONE_NPC, coneUp, sampleOpenMap(), [entity])
    // (4,0): dy=-4, dx=0 → angle -90°, diff from up(-90°) = 0° → in cone, dist=4 → DETECTED
    expect(result.detectedEntities).toHaveLength(1)
  })

  it("cone 내 엔티티지만 LOS 차단 시 감지 안 됨", () => {
    // sampleWalledMap: wall at x=4, y=1..6
    // NPC(4,4) facing up: 정면이 (4,3),(4,2),(4,1) — 하지만 (4,1)은 wall!
    // (4,3)에 엔티티 — wall(4,1~4,6)이 LOS 차단하는지 확인
    // wall은 x=4 y=1~6에 있고, NPC도 x=4 → NPC 바로 위 (4,3)은 y=3으로 wall(y=1~6) 포함
    // isTileTransparent(walled, 4, 3) = false (wall) → vision stops at y=3
    const entity = { id: "e4", type: "player" as const, position: { x: 4, y: 2 } }
    const result = computeVision(CONE_NPC, coneUp, sampleWalledMap(), [entity])
    expect(result.detectedEntities).toHaveLength(0)
  })
})

describe("computeVision — Radius", () => {
  const RADIUS_NPC = { x: 4, y: 4 }
  const radius3: NPCVisionProfile = {
    visionConfig: { type: "radius", range: 3 },
    proximityRange: 0,
    reactionType: "exclamation",
  }

  it("range 내 모든 방향 엔티티 감지", () => {
    const above = { id: "above", type: "player" as const, position: { x: 4, y: 2 } }  // dist=2
    const right = { id: "right", type: "player" as const, position: { x: 6, y: 4 } }  // dist=2
    const below = { id: "below", type: "player" as const, position: { x: 4, y: 6 } }  // dist=2
    const result = computeVision(RADIUS_NPC, radius3, sampleOpenMap(), [above, right, below])
    const ids = result.detectedEntities.map((e) => e.entityId)
    expect(ids).toContain("above")
    expect(ids).toContain("right")
    expect(ids).toContain("below")
  })

  it("range 초과 엔티티는 감지 안 됨", () => {
    const farEntity = { id: "far", type: "player" as const, position: { x: 0, y: 0 } }
    // dist = √(16+16) ≈ 5.66 > 3
    const result = computeVision(RADIUS_NPC, radius3, sampleOpenMap(), [farEntity])
    expect(result.detectedEntities).toHaveLength(0)
  })

  it("range 내지만 LOS 차단 시 감지 안 됨", () => {
    // NPC(4,4) radius 3, sampleWalledMap wall at x=4 y=1~6
    // (4,1) 엔티티: dist=3, but wall at (4,3),(4,2) → LOS false
    const entity = { id: "blocked", type: "player" as const, position: { x: 4, y: 1 } }
    const result = computeVision(RADIUS_NPC, radius3, sampleWalledMap(), [entity])
    expect(result.detectedEntities).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 추가된 테스트 실패 확인**

Run: `npx jest tests/game-core/vision/compute-vision.test.ts --no-coverage`
Expected: Cone/Radius 섹션 FAIL (stub이 빈 배열 반환 중)

- [ ] **Step 3: Cone 구현으로 교체**

`src/game-core/vision/compute-vision.ts`의 `computeCone` stub을 다음으로 교체한다:

```typescript
function directionToAngleDeg(facing: Direction): number {
  switch (facing) {
    case "right": return 0
    case "down":  return 90
    case "left":  return 180
    case "up":    return -90
  }
}

function angleDiffDeg(a: number, b: number): number {
  let diff = a - b
  while (diff > 180) diff -= 360
  while (diff < -180) diff += 360
  return Math.abs(diff)
}

function computeCone(
  npcPos: { x: number; y: number },
  config: ConeVision,
  map: TileMap,
  entities: Entity[]
): VisionResult {
  const { range, halfAngle, facing } = config
  const facingAngle = directionToAngleDeg(facing)
  const detectedEntities: VisionResult["detectedEntities"] = []
  const visibleTilePositions: VisionResult["visibleTilePositions"] = []

  const minX = Math.max(0, npcPos.x - range)
  const maxX = Math.min(map.width - 1, npcPos.x + range)
  const minY = Math.max(0, npcPos.y - range)
  const maxY = Math.min(map.height - 1, npcPos.y + range)

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (tx === npcPos.x && ty === npcPos.y) continue

      const dist = Math.sqrt((tx - npcPos.x) ** 2 + (ty - npcPos.y) ** 2)
      if (dist > range) continue

      const tileAngle = Math.atan2(ty - npcPos.y, tx - npcPos.x) * (180 / Math.PI)
      if (angleDiffDeg(tileAngle, facingAngle) > halfAngle) continue

      if (!hasLineOfSight(map, npcPos, { x: tx, y: ty })) continue

      visibleTilePositions.push({ x: tx, y: ty })

      for (const entity of entities) {
        if (entity.position.x === tx && entity.position.y === ty) {
          detectedEntities.push({
            entityId: entity.id,
            entityType: entity.type,
            position: entity.position,
            distance: dist,
            hasLOS: true,
          })
        }
      }
    }
  }

  return { detectedEntities, visibleTilePositions }
}
```

- [ ] **Step 4: Radius 구현으로 교체**

`src/game-core/vision/compute-vision.ts`의 `computeRadius` stub을 다음으로 교체한다:

```typescript
function computeRadius(
  npcPos: { x: number; y: number },
  config: RadiusVision,
  map: TileMap,
  entities: Entity[]
): VisionResult {
  const { range } = config
  const detectedEntities: VisionResult["detectedEntities"] = []
  const visibleTilePositions: VisionResult["visibleTilePositions"] = []

  const minX = Math.max(0, npcPos.x - range)
  const maxX = Math.min(map.width - 1, npcPos.x + range)
  const minY = Math.max(0, npcPos.y - range)
  const maxY = Math.min(map.height - 1, npcPos.y + range)

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (tx === npcPos.x && ty === npcPos.y) continue

      const dist = Math.sqrt((tx - npcPos.x) ** 2 + (ty - npcPos.y) ** 2)
      if (dist > range) continue

      if (!hasLineOfSight(map, npcPos, { x: tx, y: ty })) continue

      visibleTilePositions.push({ x: tx, y: ty })

      for (const entity of entities) {
        if (entity.position.x === tx && entity.position.y === ty) {
          detectedEntities.push({
            entityId: entity.id,
            entityType: entity.type,
            position: entity.position,
            distance: dist,
            hasLOS: true,
          })
        }
      }
    }
  }

  return { detectedEntities, visibleTilePositions }
}
```

- [ ] **Step 5: 전체 compute-vision 통과 확인**

Run: `npx jest tests/game-core/vision/compute-vision.test.ts --no-coverage`
Expected: PASS (20 tests — Linear 8 + proximityRange 5 + Cone 4 + Radius 3)

- [ ] **Step 6: 커밋**

```bash
git add src/game-core/vision/compute-vision.ts tests/game-core/vision/compute-vision.test.ts
git commit -m "feat: add Cone and Radius vision types to computeVision"
```

---

## Task 8: Vision Event Emitter

**Files:**
- Create: `src/game-core/vision/vision-event-emitter.ts`
- Create: `tests/game-core/vision/vision-event-emitter.test.ts`

이전 VisionResult와 현재 VisionResult를 비교해 `DETECTED` / `LOST_SIGHT` 이벤트 배열을 반환한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// tests/game-core/vision/vision-event-emitter.test.ts
import { diffVisionResults } from "@/game-core/vision/vision-event-emitter"
import type { VisionResult } from "@/game-core/types/map"

function makeResult(entityIds: string[]): VisionResult {
  return {
    detectedEntities: entityIds.map((id) => ({
      entityId: id,
      entityType: "player" as const,
      position: { x: 1, y: 1 },
      distance: 3,
      hasLOS: true,
    })),
    visibleTilePositions: [],
  }
}

describe("diffVisionResults", () => {
  it("이전에 없던 엔티티 → DETECTED 이벤트 발행", () => {
    const events = diffVisionResults("npc_1", makeResult([]), makeResult(["player"]), 100)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe("DETECTED")
    expect(events[0].targetId).toBe("player")
    expect(events[0].npcId).toBe("npc_1")
    expect(events[0].timestamp).toBe(100)
  })

  it("이전에 있던 엔티티가 사라짐 → LOST_SIGHT 이벤트 발행", () => {
    const events = diffVisionResults("npc_1", makeResult(["player"]), makeResult([]), 200)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe("LOST_SIGHT")
    expect(events[0].targetId).toBe("player")
    expect(events[0].timestamp).toBe(200)
  })

  it("변화 없음 → 이벤트 없음", () => {
    const events = diffVisionResults("npc_1", makeResult(["player"]), makeResult(["player"]), 100)
    expect(events).toHaveLength(0)
  })

  it("prev/curr 모두 빔 → 이벤트 없음", () => {
    const events = diffVisionResults("npc_1", makeResult([]), makeResult([]), 100)
    expect(events).toHaveLength(0)
  })

  it("여러 엔티티 동시 감지 → DETECTED 다수 발행", () => {
    const events = diffVisionResults(
      "npc_1",
      makeResult([]),
      makeResult(["player", "enemy"]),
      300
    )
    expect(events).toHaveLength(2)
    expect(events.every((e) => e.type === "DETECTED")).toBe(true)
    const ids = events.map((e) => e.targetId)
    expect(ids).toContain("player")
    expect(ids).toContain("enemy")
  })

  it("일부 감지 유지, 일부 소실 → LOST_SIGHT만 소실된 것에 발행", () => {
    const events = diffVisionResults(
      "npc_1",
      makeResult(["player", "enemy"]),
      makeResult(["player"]),
      400
    )
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe("LOST_SIGHT")
    expect(events[0].targetId).toBe("enemy")
  })

  it("VisionEvent에 targetPosition과 distance가 포함된다", () => {
    const events = diffVisionResults("npc_1", makeResult([]), makeResult(["player"]), 100)
    expect(events[0].targetPosition).toEqual({ x: 1, y: 1 })
    expect(events[0].distance).toBe(3)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest tests/game-core/vision/vision-event-emitter.test.ts --no-coverage`
Expected: FAIL — "Cannot find module '@/game-core/vision/vision-event-emitter'"

- [ ] **Step 3: 구현 작성**

```typescript
// src/game-core/vision/vision-event-emitter.ts
import type { VisionResult, VisionEvent } from "@/game-core/types/map"

export function diffVisionResults(
  npcId: string,
  prev: VisionResult,
  curr: VisionResult,
  timestamp: number
): VisionEvent[] {
  const events: VisionEvent[] = []

  const prevIds = new Set(prev.detectedEntities.map((e) => e.entityId))
  const currMap = new Map(curr.detectedEntities.map((e) => [e.entityId, e]))

  for (const entity of curr.detectedEntities) {
    if (!prevIds.has(entity.entityId)) {
      events.push({
        type: "DETECTED",
        npcId,
        targetId: entity.entityId,
        targetPosition: entity.position,
        distance: entity.distance,
        timestamp,
      })
    }
  }

  for (const entity of prev.detectedEntities) {
    if (!currMap.has(entity.entityId)) {
      events.push({
        type: "LOST_SIGHT",
        npcId,
        targetId: entity.entityId,
        targetPosition: entity.position,
        distance: entity.distance,
        timestamp,
      })
    }
  }

  return events
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest tests/game-core/vision/vision-event-emitter.test.ts --no-coverage`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/game-core/vision/vision-event-emitter.ts tests/game-core/vision/vision-event-emitter.test.ts
git commit -m "feat: add vision event emitter (DETECTED/LOST_SIGHT diff)"
```

---

## Task 9: NPCProfile 확장 + 샘플 NPC 업데이트

**Files:**
- Modify: `src/game-core/types/npc.ts`
- Modify: `src/game-core/fixtures/sample-npcs.ts`

기존 테스트가 모두 통과하는지 확인하면서 진행한다. `visionProfile`은 optional이므로 하위 호환된다.

- [ ] **Step 1: `types/npc.ts`에 visionProfile 추가**

기존 파일의 `NPCProfile` 타입에 한 줄 추가:

```typescript
// src/game-core/types/npc.ts
import type { NPCVisionProfile } from "@/game-core/types/map"  // 이 줄 파일 상단에 추가

export type NPCProfile = {
  id: string
  name: string
  personality: string[]
  dislikeds: string[]
  speechStyle: string
  waypoints: { x: number; y: number; label: string }[]
  habits: {
    action: string
    location: string
    gameHour: number
    duration: number
  }[]
  visionProfile?: NPCVisionProfile  // 이 줄 추가
}

// ConversationEntry, NPCMemory는 변경 없음
```

- [ ] **Step 2: `fixtures/sample-npcs.ts`에 visionProfile 추가**

기존 RABBIT, BLACKSMITH에 `visionProfile` 추가:

```typescript
// RABBIT: 겁쟁이라 좁은 시야. 낚시터 방향(아래)을 주시
export const RABBIT: NPCProfile = {
  id: "npc_rabbit",
  name: "토끼",
  personality: ["겁쟁이", "친절함", "호기심 많음"],
  dislikeds: ["위험한 장소", "폭력적인 요청", "낯선 사람의 갑작스러운 부탁"],
  speechStyle: "반말, 수줍음, 짧고 귀여운 문장, 말끝에 '~' 사용",
  waypoints: [
    { x: 5, y: 5, label: "낚시터" },
    { x: 12, y: 3, label: "광장" },
    { x: 2, y: 10, label: "집" },
  ],
  habits: [
    { action: "낚시하기", location: "낚시터", gameHour: 7, duration: 60 },
    { action: "광장에서 쉬기", location: "광장", gameHour: 14, duration: 30 },
  ],
  visionProfile: {
    visionConfig: { type: "linear", range: 4, facing: "down" },
    proximityRange: 1,
    reactionType: "exclamation",
  },
}

// BLACKSMITH: 작업에 집중, 주변 원형 시야만
export const BLACKSMITH: NPCProfile = {
  id: "npc_blacksmith",
  name: "대장장이 고르",
  personality: ["고집스러움", "자부심 강함", "일 중독"],
  dislikeds: ["게으른 요청", "싼 값에 일 시키려는 것", "작업 중 방해"],
  speechStyle: "반말, 퉁명스러움, 짧고 직설적인 문장",
  waypoints: [
    { x: 8, y: 8, label: "대장간" },
    { x: 12, y: 3, label: "광장" },
  ],
  habits: [
    { action: "철 두드리기", location: "대장간", gameHour: 6, duration: 120 },
    { action: "철 두드리기", location: "대장간", gameHour: 15, duration: 90 },
  ],
  visionProfile: {
    visionConfig: { type: "radius", range: 2 },
    proximityRange: 1,
    reactionType: "ignore",
  },
}
```

- [ ] **Step 3: 전체 테스트 통과 확인**

Run: `npx jest --no-coverage`
Expected: 모든 테스트 PASS (기존 테스트 회귀 없음)

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add src/game-core/types/npc.ts src/game-core/fixtures/sample-npcs.ts
git commit -m "feat: add visionProfile to NPCProfile and sample NPCs"
```

---

## Task 10: 시야 → Agent 연동 브릿지 (Phase 8 핵심)

**Files:**
- Create: `src/game-core/agent/vision-interaction-bridge.ts`
- Create: `tests/game-core/agent/vision-interaction-bridge.test.ts`

Task 1~9는 시야 이벤트를 *발행*만 한다. 이 태스크는 `VisionEvent`를 소비해 실제로
`interactWithNPC`를 호출하는 게임 루프 경계 핸들러를 만든다. PRD R-V4("DETECTED →
interactWithNPC 연결")의 실구현이다.

**동작 규칙:**
- `DETECTED` + `reactionType` `exclamation`/`alert` → `interactWithNPC` 호출
- `DETECTED` + `reactionType` `ignore`/`approach` → 호출 안 함
- 같은 `(npcId, targetId)` 쌍은 한 sighting당 1회만 호출 (매 프레임 중복 방지)
- `LOST_SIGHT` → 해당 쌍의 상태 제거 → 재진입 시 새 상호작용 가능

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// tests/game-core/agent/vision-interaction-bridge.test.ts
import {
  processVisionEvents,
  createSightingState,
} from "@/game-core/agent/vision-interaction-bridge"
import type { VisionEvent } from "@/game-core/types/map"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"
import type { GameState } from "@/game-core/types/game"

jest.mock("@/game-core/agent/interact", () => ({
  interactWithNPC: jest.fn(async () => ({
    responseText: "앗! 누구세요~?",
    memoryUpdate: { timestamp: 0, speaker: "npc", message: "앗!", type: "chat" },
  })),
}))

import { interactWithNPC } from "@/game-core/agent/interact"
const mockInteract = interactWithNPC as jest.Mock

type Reaction = "exclamation" | "alert" | "approach" | "ignore"

function makeNPC(reactionType: Reaction): NPCProfile {
  return {
    id: "npc_test",
    name: "테스트",
    personality: ["친절함"],
    dislikeds: [],
    speechStyle: "반말",
    waypoints: [],
    habits: [],
    visionProfile: {
      visionConfig: { type: "linear", range: 4, facing: "down" },
      proximityRange: 1,
      reactionType,
    },
  }
}

const emptyMemory: NPCMemory = {
  npcId: "npc_test",
  conversationHistory: [],
  relationshipScore: 0,
}

const gameState: GameState = {
  clock: { currentMinute: 600, day: 1 },
  availableItems: [],
  availableLocations: [],
  npcPositions: {},
}

function detectedEvent(): VisionEvent {
  return {
    type: "DETECTED",
    npcId: "npc_test",
    targetId: "player",
    targetPosition: { x: 3, y: 3 },
    distance: 2,
    timestamp: 600,
  }
}

function lostEvent(): VisionEvent {
  return { ...detectedEvent(), type: "LOST_SIGHT" }
}

beforeEach(() => mockInteract.mockClear())

describe("processVisionEvents", () => {
  it("DETECTED + reactionType exclamation → interactWithNPC 1회 호출", async () => {
    const deps = {
      resolveNPC: () => ({ profile: makeNPC("exclamation"), memory: emptyMemory }),
      gameState,
    }
    await processVisionEvents([detectedEvent()], createSightingState(), deps)
    expect(mockInteract).toHaveBeenCalledTimes(1)
  })

  it("DETECTED + reactionType alert → interactWithNPC 호출", async () => {
    const deps = {
      resolveNPC: () => ({ profile: makeNPC("alert"), memory: emptyMemory }),
      gameState,
    }
    await processVisionEvents([detectedEvent()], createSightingState(), deps)
    expect(mockInteract).toHaveBeenCalledTimes(1)
  })

  it("DETECTED + reactionType ignore → interactWithNPC 호출 안 함", async () => {
    const deps = {
      resolveNPC: () => ({ profile: makeNPC("ignore"), memory: emptyMemory }),
      gameState,
    }
    await processVisionEvents([detectedEvent()], createSightingState(), deps)
    expect(mockInteract).not.toHaveBeenCalled()
  })

  it("DETECTED + reactionType approach → interactWithNPC 호출 안 함", async () => {
    const deps = {
      resolveNPC: () => ({ profile: makeNPC("approach"), memory: emptyMemory }),
      gameState,
    }
    await processVisionEvents([detectedEvent()], createSightingState(), deps)
    expect(mockInteract).not.toHaveBeenCalled()
  })

  it("같은 sighting에서 DETECTED가 매 프레임 반복돼도 1회만 호출", async () => {
    const state = createSightingState()
    const deps = {
      resolveNPC: () => ({ profile: makeNPC("exclamation"), memory: emptyMemory }),
      gameState,
    }
    await processVisionEvents([detectedEvent()], state, deps)
    await processVisionEvents([detectedEvent()], state, deps)
    await processVisionEvents([detectedEvent()], state, deps)
    expect(mockInteract).toHaveBeenCalledTimes(1)
  })

  it("LOST_SIGHT 후 재진입(DETECTED) 시 새 상호작용 발생", async () => {
    const state = createSightingState()
    const deps = {
      resolveNPC: () => ({ profile: makeNPC("exclamation"), memory: emptyMemory }),
      gameState,
    }
    await processVisionEvents([detectedEvent()], state, deps)  // 1회
    await processVisionEvents([lostEvent()], state, deps)       // 상태 리셋
    await processVisionEvents([detectedEvent()], state, deps)  // 다시 1회
    expect(mockInteract).toHaveBeenCalledTimes(2)
  })

  it("resolveNPC가 null 반환 시 호출 안 함 (크래시 없음)", async () => {
    const deps = { resolveNPC: () => null, gameState }
    await processVisionEvents([detectedEvent()], createSightingState(), deps)
    expect(mockInteract).not.toHaveBeenCalled()
  })

  it("상호작용 결과를 반환한다", async () => {
    const deps = {
      resolveNPC: () => ({ profile: makeNPC("exclamation"), memory: emptyMemory }),
      gameState,
    }
    const interactions = await processVisionEvents(
      [detectedEvent()],
      createSightingState(),
      deps
    )
    expect(interactions).toHaveLength(1)
    expect(interactions[0].npcId).toBe("npc_test")
    expect(interactions[0].targetId).toBe("player")
    expect(interactions[0].result.responseText).toBe("앗! 누구세요~?")
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest tests/game-core/agent/vision-interaction-bridge.test.ts --no-coverage`
Expected: FAIL — "Cannot find module '@/game-core/agent/vision-interaction-bridge'"

- [ ] **Step 3: 구현 작성**

```typescript
// src/game-core/agent/vision-interaction-bridge.ts
import { interactWithNPC, type InteractResult } from "@/game-core/agent/interact"
import type { VisionEvent } from "@/game-core/types/map"
import type { NPCProfile, NPCMemory } from "@/game-core/types/npc"
import type { GameState } from "@/game-core/types/game"

// 이미 상호작용을 트리거한 (npcId, targetId) 쌍을 기억해 매 프레임 재호출을 막는다.
// LOST_SIGHT가 오면 해당 쌍을 제거 → 재진입 시 새 상호작용 가능.
export type SightingState = Set<string>

export function createSightingState(): SightingState {
  return new Set<string>()
}

function pairKey(npcId: string, targetId: string): string {
  return `${npcId}::${targetId}`
}

export type SightingDeps = {
  // npcId로 NPC 프로필과 메모리를 조회한다. 없으면 null.
  resolveNPC: (npcId: string) => { profile: NPCProfile; memory: NPCMemory } | null
  gameState: GameState
}

export type SightingInteraction = {
  npcId: string
  targetId: string
  result: InteractResult
}

export async function processVisionEvents(
  events: VisionEvent[],
  state: SightingState,
  deps: SightingDeps
): Promise<SightingInteraction[]> {
  const interactions: SightingInteraction[] = []

  for (const event of events) {
    const key = pairKey(event.npcId, event.targetId)

    if (event.type === "LOST_SIGHT") {
      state.delete(key)  // 시야에서 사라짐 → 다음 재진입은 새 sighting
      continue
    }

    // event.type === "DETECTED"
    if (state.has(key)) continue  // 이번 sighting에서 이미 상호작용함

    const resolved = deps.resolveNPC(event.npcId)
    if (!resolved) continue

    const reaction = resolved.profile.visionProfile?.reactionType
    if (reaction !== "exclamation" && reaction !== "alert") continue  // ignore/approach는 대화 없음

    state.add(key)  // await 전에 등록 → 중복 트리거 방지
    const result = await interactWithNPC({
      npcProfile: resolved.profile,
      npcMemory: resolved.memory,
      userMessage: "(NPC가 당신을 발견했습니다)",
      gameState: deps.gameState,
      gameTimestamp: event.timestamp,
    })
    interactions.push({ npcId: event.npcId, targetId: event.targetId, result })
  }

  return interactions
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest tests/game-core/agent/vision-interaction-bridge.test.ts --no-coverage`
Expected: PASS (8 tests)

- [ ] **Step 5: 전체 테스트 회귀 확인**

Run: `npx jest --no-coverage`
Expected: 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/game-core/agent/vision-interaction-bridge.ts tests/game-core/agent/vision-interaction-bridge.test.ts
git commit -m "feat: bridge vision DETECTED events to interactWithNPC"
```

---

## Task 11: 단차 통행 규칙 (canTraverse)

**Files:**
- Create: `src/game-core/map/traversal.ts`
- Create: `tests/game-core/map/traversal.test.ts`

3/4 탑다운의 다층 지형(elevation)에서 이동 가능 여부를 판정한다. PRD 3.5 통행 규칙의
구현이다. 시야와 무관하므로 Task 1~3만 선행되면 된다.

**규칙 요약:**
- 4방향 인접 셀만 (대각선·원거리 불가)
- 두 셀 모두 `walkable`
- 같은 레벨이면 OK
- 레벨 차 1이면 한쪽이 `stairs` 타일일 때만 OK
- 레벨 차 2 이상은 불가

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// tests/game-core/map/traversal.test.ts
import { canTraverse, isCellWalkable } from "@/game-core/map/traversal"
import {
  sampleOpenMap,
  sampleWalledMap,
  sampleElevatedMap,
} from "@/game-core/fixtures/sample-maps"

describe("isCellWalkable", () => {
  it("잔디 셀은 walkable", () => {
    expect(isCellWalkable(sampleOpenMap(), 3, 3)).toBe(true)
  })

  it("wall이 있는 셀은 walkable 아님", () => {
    expect(isCellWalkable(sampleWalledMap(), 4, 3)).toBe(false)
  })

  it("cliff_face 셀은 walkable 아님", () => {
    expect(isCellWalkable(sampleElevatedMap(), 4, 1)).toBe(false)
  })

  it("stairs 셀은 walkable", () => {
    expect(isCellWalkable(sampleElevatedMap(), 4, 4)).toBe(true)
  })

  it("맵 밖 좌표는 walkable 아님", () => {
    expect(isCellWalkable(sampleOpenMap(), -1, 0)).toBe(false)
  })
})

describe("canTraverse", () => {
  it("같은 레벨의 인접 walkable 셀 → 이동 가능", () => {
    expect(canTraverse(sampleOpenMap(), { x: 1, y: 3 }, { x: 2, y: 3 })).toBe(true)
  })

  it("wall 셀로는 이동 불가", () => {
    expect(canTraverse(sampleWalledMap(), { x: 3, y: 3 }, { x: 4, y: 3 })).toBe(false)
  })

  it("같은 레벨 1끼리 이동 가능 (elevated 맵 우측)", () => {
    expect(canTraverse(sampleElevatedMap(), { x: 5, y: 1 }, { x: 6, y: 1 })).toBe(true)
  })

  it("cliff_face로 막힌 레벨 경계는 이동 불가", () => {
    // (3,1) 레벨0 → (4,1) 레벨1 + cliff_face
    expect(canTraverse(sampleElevatedMap(), { x: 3, y: 1 }, { x: 4, y: 1 })).toBe(false)
  })

  it("stairs를 통하면 레벨 1 차이를 넘을 수 있다", () => {
    // (3,4) 레벨0 → (4,4) 레벨1 + stairs
    expect(canTraverse(sampleElevatedMap(), { x: 3, y: 4 }, { x: 4, y: 4 })).toBe(true)
  })

  it("stairs 통행은 양방향이다", () => {
    expect(canTraverse(sampleElevatedMap(), { x: 4, y: 4 }, { x: 3, y: 4 })).toBe(true)
  })

  it("2레벨 이상 차이는 계단으로도 이동 불가", () => {
    const map = sampleElevatedMap()
    map.elevation[1][2] = 2  // (2,1)을 레벨 2로 → (1,1)[레벨0]과 차이 2
    expect(canTraverse(map, { x: 1, y: 1 }, { x: 2, y: 1 })).toBe(false)
  })

  it("인접하지 않은 셀은 이동 불가", () => {
    expect(canTraverse(sampleOpenMap(), { x: 1, y: 3 }, { x: 3, y: 3 })).toBe(false)
  })

  it("대각선 이동은 불가 (4방향만)", () => {
    expect(canTraverse(sampleOpenMap(), { x: 1, y: 3 }, { x: 2, y: 4 })).toBe(false)
  })

  it("맵 밖으로는 이동 불가", () => {
    expect(canTraverse(sampleOpenMap(), { x: 0, y: 0 }, { x: -1, y: 0 })).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest tests/game-core/map/traversal.test.ts --no-coverage`
Expected: FAIL — "Cannot find module '@/game-core/map/traversal'"

- [ ] **Step 3: 구현 작성**

```typescript
// src/game-core/map/traversal.ts
import { TILE_DEFINITIONS } from "@/game-core/map/tile-definitions"
import type { TileMap } from "@/game-core/types/map"

// 셀 안의 모든 레이어(overlay 제외)를 검사 — walkable: false 타일이 하나라도 있으면 막힌 셀.
export function isCellWalkable(map: TileMap, x: number, y: number): boolean {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return false
  for (const layer of map.layers) {
    if (layer.name === "overlay") continue
    const tile = layer.tiles[y]?.[x]
    if (tile == null) continue
    if (!TILE_DEFINITIONS[tile].walkable) return false
  }
  return true
}

function isStairs(map: TileMap, x: number, y: number): boolean {
  const objectLayer = map.layers.find((l) => l.name === "object")
  return objectLayer?.tiles[y]?.[x] === "stairs"
}

// 인접한 두 셀 사이 이동 가능 여부 — walkable + 단차 규칙(계단)을 함께 검사.
export function canTraverse(
  map: TileMap,
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean {
  // 4방향 인접만 허용 (대각선·원거리 불가)
  const manhattan = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
  if (manhattan !== 1) return false

  // 두 셀 모두 walkable이어야 함 (isCellWalkable이 맵 범위도 검사)
  if (!isCellWalkable(map, from.x, from.y)) return false
  if (!isCellWalkable(map, to.x, to.y)) return false

  // 단차 규칙
  const elevFrom = map.elevation[from.y][from.x]
  const elevTo = map.elevation[to.y][to.x]
  const diff = Math.abs(elevFrom - elevTo)

  if (diff === 0) return true
  if (diff === 1) {
    // 레벨 차 1 → 한쪽이 stairs 타일이어야 통행 가능
    return isStairs(map, from.x, from.y) || isStairs(map, to.x, to.y)
  }
  return false  // 2레벨 이상 차이는 계단으로도 불가
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest tests/game-core/map/traversal.test.ts --no-coverage`
Expected: PASS (15 tests)

- [ ] **Step 5: 전체 테스트 회귀 확인**

Run: `npx jest --no-coverage`
Expected: 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/game-core/map/traversal.ts tests/game-core/map/traversal.test.ts
git commit -m "feat: add elevation-aware traversal (canTraverse)"
```

---

## 완료 체크리스트

플랜 완료 시 아래 모두 통과해야 한다:

```bash
npx jest --no-coverage
# Expected: 전체 테스트 PASS

npx tsc --noEmit
# Expected: 에러 없음
```

**생성된 파일 목록:**
- `src/game-core/types/map.ts`
- `src/game-core/map/tile-definitions.ts`
- `src/game-core/map/loader.ts`
- `src/game-core/map/traversal.ts`
- `src/game-core/vision/line-of-sight.ts`
- `src/game-core/vision/compute-vision.ts`
- `src/game-core/vision/vision-event-emitter.ts`
- `src/game-core/agent/vision-interaction-bridge.ts`
- `src/game-core/fixtures/sample-maps.ts`
- `tests/game-core/map/tile-definitions.test.ts`
- `tests/game-core/map/loader.test.ts`
- `tests/game-core/map/traversal.test.ts`
- `tests/game-core/vision/line-of-sight.test.ts`
- `tests/game-core/vision/compute-vision.test.ts`
- `tests/game-core/vision/vision-event-emitter.test.ts`
- `tests/game-core/agent/vision-interaction-bridge.test.ts`

**수정된 파일:**
- `src/game-core/types/npc.ts`
- `src/game-core/fixtures/sample-npcs.ts`

---

## 다음 플랜

**Phase 9 — 3/4 렌더러** (`2026-05-16-renderer-prd.md` 기반 별도 플랜):
- 3/4 투영, Y-sort 깊이 정렬
- elevation 픽셀 오프셋 + cliff_face 렌더
- 키 큰 스프라이트, 카메라

**Phase 4-7 — 절차적 생성** (`2026-05-16-map-generation-procedural.md` 별도 플랜):
- Simplex Noise 지형 생성 (+ elevation 높이맵 생성)
- Auto-tiling (4방향 bitmask)
- BSP 마을 레이아웃
- WFC (Wave Function Collapse)
