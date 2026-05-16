# Renderer PRD — 3/4 탑다운

**게임**: Hometown Agents — 동물의 숲 스타일 3/4 탑다운 도트 시뮬레이션
**작성일**: 2026-05-16
**관련 문서**: `2026-05-16-map-vision-prd.md`, `2026-05-15-agent-prd.md`

---

## 1. 개요

### 1.1 목표

`TileMap`(레이어 + elevation)과 엔티티(플레이어·NPC·아이템)를 **3/4 탑다운**으로 HTML5
Canvas에 그리는 렌더러를 구현한다. 스타듀밸리·동물의 숲처럼 스프라이트의 비스듬한 정면이
보이고, 절벽·계단의 다층 지형이 자연스럽게 겹쳐 보여야 한다.

### 1.2 핵심 원칙

1. **3/4는 투영이 아니라 아트 스타일 + 깊이 정렬이다.** 좌표 변환은 일반 탑다운과
   동일한 직교 변환(스케일 + 카메라 오프셋)이다. 아이소메트릭 같은 마름모 회전이 없다.
   "3/4스러움"은 ① 스프라이트 아트가 정면을 보여주는 것과 ② Y-sort 깊이 정렬에서 나온다.
2. **렌더러는 게임 상태의 read-only 소비자다.** `TileMap`, 엔티티 목록, 카메라를 입력으로
   받아 그리기만 한다. 맵·시야·이동 로직(`map-vision-prd.md`)은 렌더러와 무관하게 동작한다.
3. **픽셀아트 우선.** 안티앨리어싱 없음, 정수 스케일.

### 1.3 범위

| 영역 | 내용 |
|------|------|
| 투영 | 격자 ↔ 화면 좌표 변환, elevation 픽셀 오프셋 |
| 파이프라인 | 4레이어 렌더 순서 + object/엔티티 Y-sort |
| 깊이 정렬 | sortKey 기반 painter's algorithm |
| Elevation | 단차 픽셀 오프셋, cliff_face 렌더 |
| 스프라이트 | 키 큰 스프라이트(base 앵커), 아틀라스/spriteId 해석 |
| 카메라 | 플레이어 추적 + 맵 경계 clamp |

### 1.3 범위 외

- 애니메이션/트위닝(걷기 프레임, 이동 보간) — 렌더러는 주어진 위치를 그릴 뿐
- 파티클·조명·그림자
- 에셋 파일 자체(타일셋 PNG) — 외부에서 수급
- 절차적 Auto-tiling 스프라이트 결정 — `map-generation` 문서 소관

---

## 2. 핵심 요구사항

| ID | 요구사항 |
|----|----------|
| R1 | 렌더러는 게임 상태(`TileMap`, 엔티티, 카메라)를 읽어 Canvas에 그리며 상태를 수정하지 않는다 |
| R2 | ground → decoration → object/엔티티 → overlay 순서로 그린다 |
| R3 | object 레이어 타일과 모든 엔티티는 하나의 리스트로 합쳐 Y-sort 후 그린다 |
| R4 | elevation N 셀은 화면에서 위로 `N × ELEVATION_STEP_PX` 만큼 올려 그린다 |
| R5 | 스프라이트는 타일보다 클 수 있으며 base(발밑) 기준으로 정렬·배치된다 |
| R6 | 카메라는 플레이어를 추적하고 맵 경계 밖을 보여주지 않도록 clamp된다 |
| R7 | `spriteId`는 `SpriteAtlas`를 통해 아틀라스 이미지의 잘라낼 사각형으로 해석된다 |
| R8 | 픽셀아트 — `imageSmoothingEnabled = false`, 정수 배율 스케일 |
| R9 | 렌더 루프는 `requestAnimationFrame` 기반이며 게임 로직 틱과 분리된다 |

---

## 3. 좌표계와 투영

### 3.1 세 좌표 공간

| 공간 | 단위 | 설명 |
|------|------|------|
| 격자(grid) | 타일 | 게임 로직 좌표 `(gridX, gridY)` + `elevation` |
| 월드(world) | 픽셀 | 격자에 `TILE_PX`를 곱한 절대 픽셀 좌표 |
| 화면(screen) | 픽셀 | 월드에서 카메라 오프셋을 뺀, Canvas에 그릴 좌표 |

### 3.2 상수

```typescript
const TILE_PX = 16             // 타일 1칸의 화면 픽셀 크기
const ELEVATION_STEP_PX = 16   // elevation 1레벨당 위로 올리는 픽셀
const RENDER_SCALE = 3         // 정수 배율 (16px 타일 → 48px로 확대)
```

### 3.3 격자 → 화면 변환

3/4 탑다운의 변환은 **선형**이다. elevation은 화면 Y를 위로 끌어올린다.

```
screenX = gridX × TILE_PX − camera.x
screenY = gridY × TILE_PX − elevation × ELEVATION_STEP_PX − camera.y
```

```typescript
function gridToScreen(
  gridX: number,
  gridY: number,
  elevation: number,
  camera: Camera
): { x: number; y: number } {
  return {
    x: gridX * TILE_PX - camera.x,
    y: gridY * TILE_PX - elevation * ELEVATION_STEP_PX - camera.y,
  }
}
```

> **주의**: 위 결과는 해당 셀 *base 타일*의 좌상단이다. 키 큰 스프라이트의 실제 그리기
> 위치는 5.3에서 base 앵커로 보정한다.

---

## 4. 렌더 파이프라인

한 프레임은 **5단계**로 그린다. 뒤 → 앞 순서.

```
Stage 1  ground 레이어     — 바닥(잔디/길/물). 평면, 정렬 불필요
Stage 2  decoration 레이어 — 꽃/패턴. 평면, 정렬 불필요
Stage 3  object + 엔티티   — 나무/벽/cliff_face + NPC/플레이어/아이템
                            → 하나의 리스트로 합쳐 Y-sort 후 그림 (핵심)
Stage 4  overlay 레이어    — 지붕 등 플레이어 위에 덮이는 것
Stage 5  UI               — 말풍선, "!" 마커, 시야 하이라이트
```

- **Stage 1–2 (ground/decoration)**: 같은 레이어 안에서는 깊이 정렬이 필요 없다. elevation
  오프셋만 적용해 행 순서대로 그린다. 단, elevation이 낮은 셀부터 그려 높은 셀이 위를
  덮도록 한다(같은 레이어 내 elevation 오름차순).
- **Stage 3**: 이 단계만 Y-sort가 필요하다 (5장).
- **Stage 4 (overlay)**: 무조건 Stage 3 위에 그린다. 건물 지붕은 플레이어가 안에 있을 때
  반투명 처리할 수 있다(선택).
- **Stage 5 (UI)**: 카메라 영향을 받지 않는 것(HUD)과 받는 것(말풍선)이 섞인다. 말풍선은
  대상 엔티티의 화면 좌표 위에 그린다.

---

## 5. Y-sort 깊이 정렬 (핵심)

3/4 탑다운에서 "겹침"이 자연스러우려면 **화면 아래쪽(=카메라에 가까운 것)을 나중에**
그려야 한다. NPC가 나무 아래쪽에 서면 나무가 NPC를 가리고, 위쪽에 서면 NPC가 나무를 가린다.

### 5.1 sortKey

각 renderable의 정렬 키는 **base(발밑)의 월드 Y**다. elevation은 키를 위로 끌어올린다.

```typescript
function depthSortKey(gridY: number, elevation: number): number {
  return gridY * TILE_PX - elevation * ELEVATION_STEP_PX
}
```

- sortKey **오름차순**으로 그린다 (작을수록 먼저 = 뒤).
- 동점 처리: elevation이 **높은 쪽을 먼저**(뒤에) 그린다. 높은 지형은 카메라에서 멀다.

**검증 예시** (`TILE_PX = ELEVATION_STEP_PX = 16`):

| 객체 | gridY | elevation | sortKey | 결과 |
|------|-------|-----------|---------|------|
| A (평지 나무) | 5 | 0 | 80 | 나중에 그림(앞) |
| B (절벽 위 NPC) | 3 | 1 | 32 | 먼저 그림(뒤) |
| C (평지 NPC) | 3 | 0 | 48 | B와 A 사이 |

→ 그리는 순서 B(32) → C(48) → A(80). 절벽 위 B가 가장 뒤, 화면 맨 아래 A가 가장 앞.

### 5.2 Stage 3 알고리즘

```
renderables = []
for each object 레이어 타일 (x, y)에 타일이 있으면:
    renderables.push({ spriteId, gridX:x, gridY:y, elevation: map.elevation[y][x], spriteHeightPx })
for each 엔티티 (player, npc, item):
    renderables.push({ spriteId, gridX, gridY, elevation, spriteHeightPx })

renderables.sort((a, b) =>
    depthSortKey(a.gridY, a.elevation) − depthSortKey(b.gridY, b.elevation)
    || b.elevation − a.elevation        // 동점: 높은 elevation 먼저
)

for r of renderables: drawRenderable(r, camera)
```

### 5.3 키 큰 스프라이트 (base 앵커)

나무·건물·NPC 스프라이트는 타일(16px)보다 **위로 길다**. 스프라이트는 **발밑(base)**을
기준으로 배치·정렬한다 — 그래야 정렬 키(`gridY`)와 시각적 겹침이 일치한다.

```
spriteHeightPx = 48 인 나무가 (gridX, gridY, elevation)에 있을 때:

  base 타일 좌상단 = gridToScreen(gridX, gridY, elevation, camera)
  그리기 좌상단 Y  = base.y + TILE_PX − spriteHeightPx
  그리기 좌상단 X  = base.x            (스프라이트 폭 = TILE_PX 기준)
```

```typescript
function drawRenderable(r: Renderable, camera: Camera, atlas: SpriteAtlas, ctx: CanvasRenderingContext2D): void {
  const base = gridToScreen(r.gridX, r.gridY, r.elevation, camera)
  const drawX = base.x
  const drawY = base.y + TILE_PX - r.spriteHeightPx  // base가 타일 바닥에 닿도록 보정
  const sprite = atlas[r.spriteId]
  ctx.drawImage(
    atlasImage(sprite.atlasId),
    sprite.sx, sprite.sy, sprite.sw, sprite.sh,
    drawX * RENDER_SCALE, drawY * RENDER_SCALE,
    sprite.sw * RENDER_SCALE, sprite.sh * RENDER_SCALE
  )
}
```

> 정렬 키는 **base**(`gridY`)를 쓰고 그리기 위치는 **위로 늘인다**. 이 분리가 3/4 겹침의
> 핵심이다. 스프라이트의 *꼭대기*로 정렬하면 키 큰 물체가 잘못 가려진다.

---

## 6. Elevation 렌더링

### 6.1 단차 픽셀 오프셋

`gridToScreen`이 이미 `− elevation × ELEVATION_STEP_PX`를 적용한다. 따라서 높은 셀의
ground/decoration/object 타일은 자동으로 위로 올라가 "솟아오른 땅"처럼 보인다.

### 6.2 cliff_face (절벽면)

elevation이 떨어지는 경계에는 수직 절벽면이 보여야 한다. `map-vision-prd.md`의 데이터
모델은 `cliff_face` 타일을 **object 레이어에 명시적으로 배치**한다(자동 유도 아님).

- `cliff_face` 타일은 Stage 3의 일반 renderable로 취급한다.
- 절벽면 스프라이트는 보통 세로로 길다(`spriteHeightPx = elevation차 × ELEVATION_STEP_PX`
  + 윗면 두께). 키 큰 스프라이트 규칙(5.3)을 그대로 적용한다.
- 절벽면은 자신이 속한 셀의 elevation으로 정렬되므로, 윗 단의 지형/오브젝트보다 앞,
  아랫 단보다 뒤에 그려진다.

### 6.3 계단

`stairs` 타일은 평범한 object 레이어 타일로 렌더한다 — 두 레벨을 잇는 경사 스프라이트.
통행 판정은 렌더러가 아니라 `canTraverse`(map-vision)가 담당한다.

---

## 7. 카메라

```typescript
type Camera = { x: number; y: number }  // 뷰포트 좌상단의 월드 픽셀 좌표
```

- **추적**: 플레이어를 뷰포트 중앙에 둔다.
  `camera.x = playerWorldX − viewportWidth / 2`
- **clamp**: 맵 경계 밖(검은 여백)이 보이지 않도록 제한.
  `camera.x ∈ [0, map.width × TILE_PX − viewportWidth]`
  (맵이 뷰포트보다 작으면 가운데 정렬)
- **부드러운 추적(선택)**: `camera += (target − camera) × lerpFactor`로 지연 추적.

```typescript
function updateCamera(
  player: { worldX: number; worldY: number },
  map: TileMap,
  viewport: { width: number; height: number }
): Camera
```

---

## 8. 스프라이트 아틀라스 / spriteId 해석

`TileDefinition.spriteId`(예: `"tiles:grass"`)와 엔티티 spriteId를 실제 아틀라스 이미지의
잘라낼 사각형으로 매핑한다. **외부에서 받은 타일셋을 코드에 연결하는 지점이다.**

```typescript
type SpriteAtlasEntry = {
  atlasId: string   // 아틀라스 이미지 키 (예: "tileset_sprout")
  sx: number        // 아틀라스 내 잘라낼 x
  sy: number
  sw: number        // 잘라낼 폭
  sh: number        // 잘라낼 높이 (키 큰 스프라이트는 > 16)
}

type SpriteAtlas = Record<string, SpriteAtlasEntry>  // spriteId → entry
```

- `SpriteAtlas`는 JSON으로 작성/로드한다(타일셋마다 1개).
- 아틀라스 이미지(`atlasId` → `HTMLImageElement`)는 로더가 미리 디코딩해 둔다.
- 누락된 `spriteId`는 눈에 띄는 placeholder(마젠타 사각형)로 렌더해 디자이너가 즉시 인지.

---

## 9. 렌더 루프 & 픽셀아트 설정

```typescript
function initCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.imageSmoothingEnabled = false  // 픽셀아트 — 보간 끔
}

// 게임 로직 틱과 분리. 렌더는 매 프레임, 로직은 자체 틱레이트.
function renderLoop(): void {
  // 1. ctx.clearRect 또는 배경 채움
  // 2. Stage 1~5 (4장)
  // 3. requestAnimationFrame(renderLoop)
}
```

- **로직/렌더 분리**: 게임 루프(이동·시야·Agent)는 자체 틱으로 돌고, 렌더러는 그 시점의
  상태 스냅샷을 매 `requestAnimationFrame`마다 그린다 (R9).
- **정수 스케일**: `RENDER_SCALE`은 정수만. Canvas CSS 크기 = 논리 크기 × `RENDER_SCALE`.
- **컬링(선택)**: 카메라 뷰포트 밖 타일/엔티티는 건너뛴다 (12장 성능).

---

## 10. TypeScript 타입 정의

구현 시 `src/game-core/render/types.ts`에 들어갈 타입.

```typescript
// src/game-core/render/types.ts
import type { TileMap } from "@/game-core/types/map"

export const TILE_PX = 16
export const ELEVATION_STEP_PX = 16
export const RENDER_SCALE = 3

export type Camera = { x: number; y: number }

export type Renderable = {
  spriteId: string
  gridX: number
  gridY: number
  elevation: number
  spriteHeightPx: number  // 16의 배수 권장
}

export type SpriteAtlasEntry = {
  atlasId: string
  sx: number
  sy: number
  sw: number
  sh: number
}

export type SpriteAtlas = Record<string, SpriteAtlasEntry>

export type RenderEntity = {
  id: string
  spriteId: string
  gridX: number
  gridY: number
  elevation: number
  spriteHeightPx: number
}

export type RenderInput = {
  map: TileMap
  entities: RenderEntity[]
  camera: Camera
  viewport: { width: number; height: number }
}
```

---

## 11. 비기능 요구사항

| 항목 | 요구사항 |
|------|----------|
| 프레임레이트 | 64×64 맵 + 엔티티 30개 기준 60fps 유지 |
| Y-sort 비용 | Stage 3 정렬은 프레임당 < 2ms |
| 컬링 | 뷰포트 밖 타일은 그리지 않음 |
| 메모리 | 아틀라스 이미지는 1회 디코딩 후 캐시 |
| 결정성 | 같은 게임 상태 → 같은 화면 (랜덤 없음) |

---

## 12. 구현 우선순위

| 단계 | 내용 | 선행 조건 |
|------|------|----------|
| 1 | 타입 + 상수 + `gridToScreen` | `map-vision` Phase 1 |
| 2 | 스프라이트 아틀라스 로더 + spriteId 해석 | 1 |
| 3 | Stage 1–2 (ground/decoration 평면 렌더) | 1, 2 |
| 4 | Stage 3 Y-sort (object + 엔티티, 키 큰 스프라이트) | 3 |
| 5 | Elevation 오프셋 + cliff_face 렌더 | 4 |
| 6 | 카메라 추적 + clamp | 3 |
| 7 | Stage 4–5 (overlay, UI 말풍선/마커) | 4 |
| 8 | 컬링 최적화 | 4 |

1~5가 MVP(맵·단차가 화면에 보임). 6~8은 플레이 경험 완성.

---

## 13. 열린 질문

- **이동 보간**: 게임 로직은 격자 이동이지만 동물의 숲 느낌엔 부드러운 이동이 어울린다.
  엔티티 `gridX/gridY`를 픽셀 위치로 보간할지, 보간을 게임 레이어가 할지 렌더러가 할지 →
  애니메이션 PRD에서 결정.
- **지붕 반투명**: 플레이어가 건물 안에 들어가면 overlay 지붕을 페이드할지.
- **그림자**: 키 큰 스프라이트 발밑 타원 그림자는 저비용이라 MVP에 넣을 수도 있음.
