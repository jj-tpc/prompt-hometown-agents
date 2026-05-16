# Map & Vision System PRD

**게임**: Hometown Agents — 동물의 숲 스타일 3/4 탑다운 도트 시뮬레이션  
**작성일**: 2026-05-16 (개정: 3/4 탑다운 + 단차 반영)  
**관련 문서**: `2026-05-15-agent-prd.md`, `2026-05-16-renderer-prd.md`

---

## 1. 개요

### 1.1 목표

동물의 숲 감성의 **3/4 탑다운(Stardew Valley식)** 타일 월드를 구현한다. 플레이어와 NPC는
정사각 타일 그리드 위에서 상하좌우로 이동하며, 절벽·계단이 있는 **다층 지형(elevation)**을
지원한다. NPC는 바라보는 방향으로 시야를 가진다. 맵은 수작업(JSON)과 절차적 생성을 모두
지원한다.

> **3/4 탑다운의 핵심**: 게임 *논리*는 여전히 2D 정사각 그리드다. "3/4"는 **렌더링/투영**
> 개념(스프라이트를 비스듬한 정면이 보이게 그림 + Y-sort 깊이 정렬)으로, 맵·시야·이동
> 로직에는 영향을 주지 않는다. 렌더링은 `2026-05-16-renderer-prd.md`에서 다룬다.

### 1.2 범위

| 영역 | 내용 |
|------|------|
| 맵 시스템 | 타일 정의, 레이어 구조, 맵 데이터 포맷, 청크 |
| 단차 시스템 | 정수 레벨 높이맵, 절벽면·계단, 통행 규칙 |
| 시야 시스템 | NPC 3종 시야 타입, LOS 차단, 감지 이벤트 |
| 맵 생성 | Noise 지형, Auto-tiling, WFC, BSP 마을 레이아웃 |
| Agent 연동 | 감지 이벤트 → `interactWithNPC` 진입점 |

### 1.3 범위 외

- 렌더링 엔진 (3/4 투영, Y-sort, 카메라) → `2026-05-16-renderer-prd.md`
- 멀티플레이어
- 애니메이션 시스템
- 높이 차에 의한 3D 시야("낮은 지형 너머 보기") — 3.5 참고

---

## 2. 핵심 요구사항

| ID | 요구사항 |
|----|----------|
| M1 | 맵은 `TileMap` JSON으로 직렬화/역직렬화할 수 있어야 한다 |
| M2 | 맵은 4개 레이어(ground, decoration, object, overlay)를 지원해야 한다 |
| M3 | 각 타일은 `walkable`과 `transparent` 속성을 가져야 한다 |
| M4 | 대형 맵(256×256 이상)은 16×16 타일 청크 단위로 분할 가능해야 한다 |
| E1 | 맵은 셀별 정수 레벨 높이맵(`elevation`)을 가진다 |
| E2 | 레벨이 다른 인접 셀 간 이동은 `stairs` 타일을 통해서만 허용된다 |
| E3 | `cliff_face` 타일은 통행·시야를 모두 차단한다 |
| V1 | NPC는 Linear / Cone / Radius 세 가지 시야 타입 중 하나를 가진다 |
| V2 | 시야는 `transparent: false` 타일(벽, 건물)에 의해 차단된다 |
| V3 | 감지 이벤트는 `DETECTED` / `LOST_SIGHT` 두 가지를 발행한다 |
| V4 | `DETECTED` 이벤트는 Agent System의 `interactWithNPC`와 연결된다 |
| G1 | 절차적 지형 생성은 Simplex Noise + biome 임계값 방식을 사용한다 |
| G2 | Auto-tiling은 4방향 bitmask(16-tile) 방식을 기본으로 한다 |
| G3 | 마을 레이아웃은 BSP(Binary Space Partitioning)로 구역을 분할하여 건물을 배치한다 |
| G4 | 수작업 맵과 절차적 맵 모두 동일한 `TileMap` 타입을 출력해야 한다 |

---

## 3. 맵 시스템 설계

### 3.1 좌표계

게임 논리는 **정사각 그리드**다. 3/4 탑다운은 이 그리드를 화면에 그릴 때의 투영 방식일
뿐, 좌표계는 일반 탑다운과 동일하다.

```
(0,0) ──────────── x (east)
  │
  │  [tile][tile][tile]
  │  [tile][tile][tile]
  │
  y (south)
```

- 논리 타일 크기: **16×16** (그리드 1칸). 화면 픽셀 크기·스프라이트 높이는 렌더러가 관리
- 이동 단위: 1 타일 (격자 이동)
- 방향: `up(-y)` / `down(+y)` / `left(-x)` / `right(+x)`
- 3번째 축: `elevation`(정수 레벨) — 평면 좌표 (x,y)에 더해 셀의 높이를 표현 (3.5 참고)

### 3.2 타일 타입

```typescript
type TileType =
  // 지형 (Terrain)
  | "void"            // 진입 불가 빈 공간
  | "grass"           // 잔디 (걸을 수 있음)
  | "dirt"            // 흙길
  | "path"            // 정비된 길
  | "sand"            // 모래
  | "water"           // 물 (진입 불가)
  | "shallow_water"   // 얕은 물 (느리게 이동 가능)
  | "mountain"        // 산 (진입 불가)
  // 식생 (Vegetation)
  | "tree"            // 나무 (진입 불가, LOS 차단)
  | "bush"            // 덤불 (진입 불가)
  | "tall_grass"      // 키 큰 풀 (이동 가능, 플레이어 은신)
  // 구조물 (Structure)
  | "wall"            // 벽 (진입 불가, LOS 차단)
  | "fence"           // 울타리 (진입 불가, LOS 통과)
  | "building_floor"  // 건물 바닥 (이동 가능)
  | "building_wall"   // 건물 벽 (진입 불가, LOS 차단)
  | "roof"            // 지붕 (오버레이)
  // 단차 (Elevation)
  | "cliff_face"      // 절벽 수직면 (진입 불가, LOS 차단)
  | "stairs"          // 계단 (이동 가능, 레벨 전환 허용)
  // 인터랙티브 (Interactive)
  | "door"            // 문 (인터랙션으로 진입)
  | "chest"           // 상자
  | "sign"            // 표지판
  | "npc_spawn"       // NPC 스폰 포인트 (메타 타일)
  | "player_spawn"    // 플레이어 스폰 포인트 (메타 타일)
```

### 3.3 타일 정의 (TileDefinition)

```typescript
type TileDefinition = {
  type: TileType
  walkable: boolean       // 이 타일 위를 걸을 수 있는가
  transparent: boolean    // 시야(LOS)를 통과하는가 (false = 차단)
  spriteId: string        // 타일셋의 스프라이트 키 ("tileset_village:0:0" 형식)
  autoTileGroup?: string  // Auto-tiling 그룹 ID (같은 그룹끼리 경계 처리)
}
```

### 3.4 레이어 구조

포켓몬 레드 방식의 **4레이어 구조**. 렌더는 인덱스 0 → 3 순서로 후방 페인팅.

| 인덱스 | 이름 | 내용 | 예시 |
|--------|------|------|------|
| 0 | `ground` | 기본 지형 | 잔디, 물, 모래, 길 |
| 1 | `decoration` | 장식물 | 꽃, 바위, 패턴 |
| 2 | `object` | 충돌/LOS 오브젝트 | 나무, 벽, 건물 |
| 3 | `overlay` | 플레이어 위에 그려짐 | 지붕, 다리 상판 |

```typescript
type LayerName = "ground" | "decoration" | "object" | "overlay"

type TileLayer = {
  name: LayerName
  tiles: (string | null)[][]  // [y][x], null = 빈칸, string = TileDefinition.type
}
```

### 3.5 단차(Elevation) 시스템

3/4 탑다운에서 동물의 숲처럼 절벽·계단이 있는 다층 지형을 표현한다. **진짜 3D가 아니라**
정수 레벨 높이맵 + 통행 규칙 + 렌더링 오프셋으로 처리한다.

**높이맵**: `TileMap.elevation`은 `number[][]`(`[y][x]`)로 각 셀의 지면 높이를 정수 레벨
(0,1,2,…)로 담는다. 레이어 타일 배열과 동일한 width/height. 평지 맵은 전부 0.

**관련 타일 타입**:
- `cliff_face` — 레벨이 떨어지는 경계에 그려지는 수직 절벽면. `walkable: false`,
  `transparent: false`(LOS 차단). `object` 레이어에 배치.
- `stairs` — 레벨 간 합법적 이동을 허용하는 전환 타일. `walkable: true`,
  `transparent: true`. `object` 레이어에 배치.

**통행 규칙** — 인접한 두 셀 A, B 사이 이동 가능 조건:

| 조건 | 이동 |
|------|------|
| A 또는 B가 `walkable: false` | ❌ |
| `elevation[A] === elevation[B]` | ✅ |
| `|elevation 차| === 1` 이고 A 또는 B가 `stairs` 타일 | ✅ |
| `|elevation 차| >= 2` | ❌ |

```typescript
// 인접한 두 셀 사이 이동 가능 여부 (단차/계단 고려)
function canTraverse(
  map: TileMap,
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean
```

**시야와 단차** (MVP 단순화): `cliff_face`가 `transparent: false`이므로 기존
`hasLineOfSight`가 절벽을 그대로 차단한다. 높이 차에 의한 "낮은 지형 너머 보기" 같은
3D 시야는 MVP 범위 밖이며, 시야 코드(`computeVision`/`hasLineOfSight`)는 단차 도입
후에도 **변경 없이 유지**된다.

### 3.6 맵 데이터 포맷 (TileMap)

```typescript
type Direction = "up" | "down" | "left" | "right"

type SpawnPoint = {
  id: string
  x: number       // 타일 좌표
  y: number
  facing: Direction
  entityType: "player" | "npc"
  npcId?: string  // entityType === "npc" 일 때 NPCProfile.id
}

type MapTransition = {
  x: number           // 이 좌표를 밟으면
  y: number
  targetMapId: string // 이 맵으로
  targetX: number
  targetY: number
  facing: Direction
}

type MapMetadata = {
  id: string
  name: string
  biome: "village" | "forest" | "beach" | "mountain" | "cave" | "indoor"
  weather?: "clear" | "rain" | "snow"
  musicId?: string
}

type TileMap = {
  meta: MapMetadata
  width: number             // 타일 단위
  height: number
  tileSize: 16              // 논리 타일 크기 (고정)
  layers: TileLayer[]       // 항상 4개, LayerName 순서 보장
  elevation: number[][]     // [y][x] 셀별 정수 레벨 (평지는 전부 0)
  spawnPoints: SpawnPoint[]
  transitions: MapTransition[]
}
```

### 3.7 청크 시스템

256×256 타일 이상의 대형 맵에서 메모리를 절약하기 위해 16×16 타일 단위 청크로 분할.

```typescript
type ChunkCoord = { chunkX: number; chunkY: number }  // 청크 좌표 (타일 ÷ 16)

type MapChunk = {
  coord: ChunkCoord
  layers: TileLayer[]       // 이 청크 범위의 16×16 타일
  isLoaded: boolean
}
```

**로딩 규칙**: 플레이어 현재 청크 기준 반경 2 청크(5×5 = 80×80 타일)만 메모리에 유지.

---

## 4. NPC 시야 시스템

### 4.1 시야 타입 3종

#### Type A: Linear (포켓몬 레드 방식) ★ 기본값

NPC가 바라보는 방향으로 직선 `range` 타일만큼 감지. 포켓몬 트레이너의 눈맞춤 방식.

```
NPC(▲) facing UP, range 4:
    [감지]
    [감지]
    [감지]
    [감지]
    [NPC ▲]
```

```typescript
type LinearVision = {
  type: "linear"
  range: number       // 타일 수 (기본 4)
  facing: Direction   // 현재 NPC 방향과 동기화
}
```

#### Type B: Cone (부채꼴)

방향 기준 좌우 `halfAngle`도 범위로 `range` 타일 내 감지. 경비병 순찰 방식.

```
NPC(▲) facing UP, range 3, halfAngle 45°:
      [감지]
    [감지][감지][감지]
  [감지][감지][감지][감지][감지]
          [NPC ▲]
```

```typescript
type ConeVision = {
  type: "cone"
  range: number
  halfAngle: number   // 도(degree). 45 = 90도 부채꼴
  facing: Direction
}
```

#### Type C: Radius (원형)

방향 무관, 반경 `range` 타일 내 모든 방향 감지. 동물, 마법사 등에 활용.

```typescript
type RadiusVision = {
  type: "radius"
  range: number
}
```

### 4.2 VisionConfig 통합 타입

```typescript
type VisionConfig = LinearVision | ConeVision | RadiusVision

type NPCVisionProfile = {
  visionConfig: VisionConfig
  proximityRange?: number   // 시야 타입 무관, 이 반경 내 진입 시 무조건 감지 (기본 1)
  reactionType: "exclamation" | "alert" | "approach" | "ignore"
  // exclamation: ! 말풍선 → 대화 시작
  // alert: ! 말풍선 → NPC가 플레이어 위치로 이동 후 대화
  // approach: 조용히 플레이어 위치로 이동
  // ignore: 감지해도 행동 변화 없음 (동물, 배경 NPC)
}
```

### 4.3 LOS(Line of Sight) 알고리즘

**Bresenham's Line Algorithm**을 사용해 NPC → 대상 사이의 타일을 열거. 경로 상 `transparent: false` 타일이 하나라도 있으면 시야 차단.

```
NPC ────── 벽 ████ 플레이어
           ↑ 차단: 감지 불가
```

```typescript
// LOS 차단 여부 확인 함수 시그니처
function hasLineOfSight(
  map: TileMap,
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean
// true = 시야 통과 가능, false = 차단됨
```

### 4.4 감지 이벤트

```typescript
type VisionEventType = "DETECTED" | "LOST_SIGHT"

type VisionEvent = {
  type: VisionEventType
  npcId: string
  targetId: string         // 감지된 엔티티 ID ("player" 또는 NPCProfile.id)
  targetPosition: { x: number; y: number }
  distance: number         // 타일 단위
  timestamp: number        // gameState.clock.currentMinute
}
```

**이벤트 발행 규칙**:
- `DETECTED`: 대상이 시야 범위 안으로 진입한 첫 프레임
- `LOST_SIGHT`: 대상이 시야 범위 밖으로 나가거나 LOS가 차단된 첫 프레임
- 매 이동(타일 단위)마다 재계산. 정지 상태에서는 재계산 불필요.

**Agent System 연동**:
```
DETECTED 이벤트 발생
  → reactionType === "exclamation" 또는 "alert"
  → interactWithNPC({ npcProfile, npcMemory, userMessage: "(NPC가 당신을 발견했습니다)", gameState })
```

### 4.5 시야 계산 결과 타입

```typescript
type VisionResult = {
  detectedEntities: Array<{
    entityId: string
    entityType: "player" | "npc" | "item"
    position: { x: number; y: number }
    distance: number
    hasLOS: boolean
  }>
  visibleTilePositions: Array<{ x: number; y: number }>  // 시야 범위 내 타일 (렌더 하이라이트용)
}
```

---

## 5. 맵 생성 방법론

> 현업 게임 개발에서는 **수작업 맵**과 **절차적 생성**을 혼합하는 하이브리드 방식을 사용한다.  
> Stardew Valley: 마을 수작업 + 광산 절차적. 포켓몬: 전체 수작업 + 툴 기반 제작.

### 5.1 수작업 방식 (Tiled Map Editor 호환)

**도구 체인**: Aseprite(스프라이트) → Tiled(맵 편집) → JSON export → `TileMap` 파싱

Tiled가 출력하는 JSON 포맷을 `TileMap`으로 변환하는 파서를 구현한다. 이를 통해 디자이너가 Tiled에서 맵을 제작하면 코드 수정 없이 게임에 바로 로드된다.

```typescript
// 파서 시그니처
function parseTiledJSON(tiledExport: TiledMapFormat): TileMap
```

### 5.2 Noise 기반 지형 생성 (야외 필드)

**Simplex Noise**를 사용해 자연스러운 지형 높이맵을 생성하고, 높이값을 biome으로 변환한다.

```
높이값 (0.0 ~ 1.0)
  0.0 ~ 0.25  → water        (깊은 바다)
  0.25 ~ 0.35 → shallow_water (해안)
  0.35 ~ 0.45 → sand         (해변)
  0.45 ~ 0.70 → grass        (평원)
  0.70 ~ 0.85 → tree         (숲)
  0.85 ~ 1.00 → mountain     (산악)
```

**Multi-octave (fBm: fractal Brownian motion)**: 큰 스케일 노이즈(대륙 형태) + 작은 스케일 노이즈(디테일)를 중첩해 현실감 있는 지형을 만든다.

```typescript
// 지형 생성 시그니처
function generateTerrain(
  width: number,
  height: number,
  seed: number,
  options: {
    scale: number        // 노이즈 스케일 (클수록 큰 지형)
    octaves: number      // 중첩 횟수 (보통 4~6)
    persistence: number  // 고주파 노이즈 감쇠 (0.5 권장)
    lacunarity: number   // 주파수 증가율 (2.0 권장)
  }
): TileLayer  // ground 레이어 반환
```

### 5.3 Auto-tiling (Wang Tiles / Bitmask)

단순히 타일을 배치하면 경계가 딱딱하게 잘린다. Auto-tiling은 **인접 4방향 타일을 감지**해 적절한 경계 스프라이트를 자동 선택한다.

**4방향 Bitmask 방식 (16-tile)**:

```
이웃 타일 방향: 상(N)=1, 우(E)=2, 하(S)=4, 좌(W)=8
같은 타입이면 1, 다르면 0 → 4비트 합산 → 0~15 중 하나

값 0  = 고립 섬 타일
값 15 = 사방이 같은 타입 → 내부 타일
값 6  = E+S 연결 → 왼쪽 위 모서리 타일
...
```

```typescript
// auto-tile 스프라이트 선택 함수 시그니처
function getAutoTileVariant(
  map: TileMap,
  x: number,
  y: number,
  layerName: LayerName,
  tileType: TileType
): string  // spriteId 반환
```

### 5.4 Wave Function Collapse (WFC) — 구조물/던전

**WFC**: 예시 패턴(샘플 맵 조각)에서 타일 인접 규칙을 추출하고, 이를 만족하는 새로운 맵을 생성한다. **던전 방, 마을 골목, 반복 패턴**에 적합.

**원리**:
1. 모든 셀을 "가능한 타일 전체" 상태(superposition)로 초기화
2. 엔트로피가 가장 낮은 셀(가능한 타일 수가 가장 적은 셀)을 선택
3. 해당 셀의 타일을 확률에 따라 collapse (하나로 결정)
4. 이웃 셀에 제약 전파 (불가능한 타일 제거)
5. 모든 셀이 결정될 때까지 2~4 반복

```typescript
type AdjacencyRule = {
  tileType: TileType
  neighbors: {
    up: TileType[]      // 위에 올 수 있는 타일 타입들
    down: TileType[]
    left: TileType[]
    right: TileType[]
  }
}

// WFC 실행 시그니처
function runWFC(
  width: number,
  height: number,
  rules: AdjacencyRule[],
  seed: number
): TileLayer
```

### 5.5 BSP 마을 레이아웃 생성

**BSP(Binary Space Partitioning)**: 공간을 재귀적으로 이분할해 구역을 만들고, 각 구역에 건물을 배치한다.

```
전체 맵
├── 왼쪽 반
│   ├── 왼위 → 주거지구
│   └── 왼아래 → 광장
└── 오른쪽 반
    ├── 오른위 → 상업지구
    └── 오른아래 → 대장간/창고
```

**단계별 절차**:

```
1. BSP 분할  → 구역 리스트 생성
2. 구역 → 건물 배치 (여백 포함, 최소 크기 보장)
3. 건물 사이 도로 생성:
   - 구역 중심점 추출 → MST(Minimum Spanning Tree) 연결
   - MST 엣지 → 직선 path 타일로 채움
4. 건물 내부 채우기 (building_floor + building_wall 테두리)
5. NPC 스폰 포인트 배치 (건물 내부 또는 도로 옆)
```

```typescript
// 마을 생성 시그니처
function generateVillage(
  width: number,
  height: number,
  seed: number,
  options: {
    minRoomSize: number    // 최소 구역 크기 (타일)
    maxDepth: number       // BSP 분할 깊이 (보통 4~5)
    buildingPadding: number // 구역 내 건물 여백
  }
): TileMap
```

### 5.6 하이브리드 워크플로우 (Professional 추천)

현업에서 사용하는 **5단계 파이프라인**:

```
Stage 1: 기반 지형 생성
  Simplex Noise → ground 레이어 (biome 배치)

Stage 2: Auto-tiling 적용
  모든 ground 타일에 bitmask 계산 → 경계 스프라이트 결정

Stage 3: 핵심 구조물 스탬핑
  수작업 제작한 마을/던전 TileMap 조각을
  절차적으로 선택된 위치에 덮어씀 (stamp)
  → 중요한 장소는 수작업으로 품질 보장

Stage 4: 장식 배치
  decoration 레이어에 biome 규칙에 따라
  꽃/바위/버섯 등 랜덤 배치
  (같은 biome 타일 위에만, 일정 밀도 이하로)

Stage 5: 엔티티 배치
  SpawnPoint 생성:
  - 마을 내부 → 수작업 NPC 배치
  - 야외 → biome 규칙 기반 NPC/아이템 랜덤 스폰
```

```typescript
// 하이브리드 맵 생성 시그니처
function generateMap(config: {
  width: number
  height: number
  seed: number
  biome: MapMetadata["biome"]
  stamps?: Array<{           // 수작업 조각 스탬프
    map: TileMap
    x: number
    y: number
  }>
}): TileMap
```

---

## 6. 완전한 TypeScript 타입 정의 (통합)

이 섹션은 구현 시 `src/game-core/types/map.ts`에 들어갈 최종 타입 목록이다.

```typescript
// src/game-core/types/map.ts

export type Direction = "up" | "down" | "left" | "right"

export type TileType =
  | "void" | "grass" | "dirt" | "path" | "sand"
  | "water" | "shallow_water" | "mountain"
  | "tree" | "bush" | "tall_grass"
  | "wall" | "fence" | "building_floor" | "building_wall" | "roof"
  | "cliff_face" | "stairs"
  | "door" | "chest" | "sign" | "npc_spawn" | "player_spawn"

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
  elevation: number[][]  // [y][x] 셀별 정수 레벨
  spawnPoints: SpawnPoint[]
  transitions: MapTransition[]
}

// --- Vision System ---

export type LinearVision = { type: "linear"; range: number; facing: Direction }
export type ConeVision = { type: "cone"; range: number; halfAngle: number; facing: Direction }
export type RadiusVision = { type: "radius"; range: number }
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

// --- Map Generation ---

export type AdjacencyRule = {
  tileType: TileType
  neighbors: {
    up: TileType[]
    down: TileType[]
    left: TileType[]
    right: TileType[]
  }
}

export type MapChunk = {
  coord: { chunkX: number; chunkY: number }
  layers: TileLayer[]
  isLoaded: boolean
}
```

---

## 7. Agent System 연동

기존 `NPCProfile`에 `visionProfile?: NPCVisionProfile`을 추가한다.

```typescript
// src/game-core/types/npc.ts 에 추가
import type { NPCVisionProfile } from "./map"

export type NPCProfile = {
  // ... 기존 필드 유지 ...
  visionProfile?: NPCVisionProfile  // 시야 없는 NPC는 생략 가능
}
```

**이벤트 흐름**:

```
[게임 루프] 플레이어 이동
  → computeVision(npc, map, playerPosition) 호출
  → VisionResult 반환
  → 이전 상태와 비교
    → 신규 감지 → VisionEvent { type: "DETECTED" } 발행
    → 시야 이탈 → VisionEvent { type: "LOST_SIGHT" } 발행
  → "DETECTED" + reactionType "exclamation"/"alert"
    → interactWithNPC({ npcProfile, npcMemory, userMessage: "...", gameState })
```

---

## 8. 비기능 요구사항

| 항목 | 요구사항 |
|------|----------|
| 시야 계산 성능 | NPC 1개당 계산 < 1ms (이동 시에만 재계산) |
| 맵 로딩 | 청크 로드 < 16ms (1프레임 이내) |
| 직렬화 | `TileMap` JSON 크기: 64×64 맵 기준 < 200KB |
| 절차적 생성 | 128×128 맵 생성 < 500ms |
| 메모리 | 활성 청크 최대 25개 (5×5) 유지 |

---

## 9. 구현 우선순위

| 단계 | 내용 | 선행 조건 |
|------|------|----------|
| Phase 1 | 타입 정의 + 타일 상수 (단차 타일 포함) | 없음 |
| Phase 2 | Linear LOS + 감지 이벤트 | Phase 1 |
| Phase 3 | 수작업 JSON 맵 로더 (elevation 검증 포함) | Phase 1 |
| Phase 3.5 | 단차 통행 규칙 (`canTraverse`) | Phase 1 |
| Phase 8 | Agent 연동 | Phase 2 + Agent PRD |
| Phase 9 | 3/4 렌더러 | `renderer-prd.md` |
| Phase 4 | Noise 기반 지형 생성 | Phase 1 |
| Phase 5 | Auto-tiling | Phase 3, 4 |
| Phase 6 | BSP 마을 생성 | Phase 4 |
| Phase 7 | WFC | Phase 5 |

Phase 1~3.5 + 8이 MVP(맵·시야·단차·Agent 연동). Phase 9 렌더러는 화면 출력의 필수
요소이며 별도 PRD에서 다룬다. Phase 4~7은 맵 다양성을 위한 확장.
