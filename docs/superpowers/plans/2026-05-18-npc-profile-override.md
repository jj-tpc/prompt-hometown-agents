# NPC Profile Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow editing of NPC personality / dislikeds / speechStyle fields in the Prompt Studio, persisting overrides to localStorage and merging them into the API request at interaction time.

**Architecture:** Follow the exact same localStorage-override pattern already used for NPC character prompts (`npc-character-prompt-storage.ts`). A new storage module holds `NpcProfileOverride` (JSON, keyed by `npcId`). The Studio's "NPC 프롬프트" tab gets a profile-fields section added below the existing character-background textarea. The world page loads the override and merges it into `resolvedProfile` before the API call.

**Tech Stack:** TypeScript, React (client component), localStorage, vitest

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/game-core/storage/npc-profile-override-storage.ts` |
| Create | `tests/game-core/storage/npc-profile-override-storage.test.ts` |
| Modify | `src/app/studio/page.tsx` |
| Modify | `src/app/dev/world/page.tsx` |

---

### Task 1: Storage Module

**Files:**
- Create: `src/game-core/storage/npc-profile-override-storage.ts`
- Create: `tests/game-core/storage/npc-profile-override-storage.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/game-core/storage/npc-profile-override-storage.test.ts
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
    saveNpcProfileOverride("npc_6", { personality: "친절함", dislikeds: "무례함", speechStyle: "경어" })
    expect(JSON.parse(mockStorage["hometown:npc-profile-override:npc_6"])).toEqual({
      personality: "친절함",
      dislikeds: "무례함",
      speechStyle: "경어",
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
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

```
npx vitest run tests/game-core/storage/npc-profile-override-storage.test.ts
```
Expected: FAIL — `Cannot find module '@/game-core/storage/npc-profile-override-storage'`

- [ ] **Step 3: Implement the storage module**

```typescript
// src/game-core/storage/npc-profile-override-storage.ts
const KEY = (npcId: string) => `hometown:npc-profile-override:${npcId}`

export type NpcProfileOverride = {
  personality?: string  // comma-separated
  dislikeds?: string    // comma-separated
  speechStyle?: string
}

export function loadNpcProfileOverride(npcId: string): NpcProfileOverride | null {
  if (typeof localStorage === "undefined") return null
  const raw = localStorage.getItem(KEY(npcId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as NpcProfileOverride
  } catch {
    return null
  }
}

export function saveNpcProfileOverride(npcId: string, override: NpcProfileOverride): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(KEY(npcId), JSON.stringify(override))
}

export function clearNpcProfileOverride(npcId: string): void {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(KEY(npcId))
}
```

- [ ] **Step 4: Run test — expect PASS**

```
npx vitest run tests/game-core/storage/npc-profile-override-storage.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/game-core/storage/npc-profile-override-storage.ts tests/game-core/storage/npc-profile-override-storage.test.ts
git commit -m "feat: add npc-profile-override-storage module"
```

---

### Task 2: Studio — Profile Editing UI

**Files:**
- Modify: `src/app/studio/page.tsx`

Context: `src/app/studio/page.tsx` already has an "NPC 프롬프트" tab showing NPCs from `WORLD_NPC_CHARACTER_PROMPTS`. Each entry has `{ npcId, characterPromptKey, name }`. Currently `selectedNpcKey` is `characterPromptKey` (e.g., `"npc_guard"`). Profile overrides must be keyed by `npcId` (e.g., `"npc_5"`).

The `NpcCharacterEditor` component at the bottom of the file needs to be extended with a profile section. Do NOT change the existing character-background textarea — add the profile section BELOW it, separated by a section heading.

- [ ] **Step 1: Write a test to verify profile storage round-trip (manual verification step)**

No automated test exists for the React component. Verify manually after implementation that:
1. Opening "NPC 프롬프트" tab shows profile fields below character background
2. Editing a field and clicking 저장 persists to localStorage under `hometown:npc-profile-override:{npcId}`
3. Clicking 원본으로 리셋 clears localStorage and restores blueprint values

- [ ] **Step 2: Add imports and types to `src/app/studio/page.tsx`**

At the top of the file, add after the existing imports:
```typescript
import {
  loadNpcProfileOverride,
  saveNpcProfileOverride,
  clearNpcProfileOverride,
  type NpcProfileOverride,
} from "@/game-core/storage/npc-profile-override-storage"
import { resolveWorldNPCProfile } from "@/game-core/game-loop/world-dialogue"
```

Add after the existing `type TabKey` line:
```typescript
type NpcProfileDraft = {
  personality: string  // comma-separated
  dislikeds: string    // comma-separated
  speechStyle: string
}
```

- [ ] **Step 3: Add profile state and derived `selectedNpcEntry` to `StudioPage`**

Inside `StudioPage`, after the existing `npcSaved` state declaration, add:
```typescript
const [npcProfileDrafts, setNpcProfileDrafts] = useState<Record<string, NpcProfileDraft>>({})
const [npcProfileSaved, setNpcProfileSaved] = useState<Record<string, NpcProfileDraft>>({})
const [npcProfileDefaults, setNpcProfileDefaults] = useState<Record<string, NpcProfileDraft>>({})

const selectedNpcEntry = useMemo(
  () => WORLD_NPC_CHARACTER_PROMPTS.find((e) => e.characterPromptKey === selectedNpcKey),
  [selectedNpcKey]
)
```

- [ ] **Step 4: Load profile defaults in the NPC useEffect**

In the existing NPC useEffect (the one that fetches `/api/prompts/npc/...`), after `setNpcDrafts(drafts)`, add profile loading. Replace the entire NPC useEffect with:

```typescript
useEffect(() => {
  let cancelled = false
  const entries = WORLD_NPC_CHARACTER_PROMPTS
  if (entries.length === 0) return

  Promise.all(
    entries.map((entry) =>
      fetch(`/api/prompts/npc/${entry.characterPromptKey}`)
        .then((res) => res.json() as Promise<{ content: string }>)
        .then((data) => ({ key: entry.characterPromptKey, npcId: entry.npcId, content: data.content }))
        .catch(() => ({ key: entry.characterPromptKey, npcId: entry.npcId, content: "" }))
    )
  ).then((results) => {
    if (cancelled) return
    const charDefaults: Record<string, string> = {}
    const charSaved: Record<string, string> = {}
    const charDrafts: Record<string, string> = {}
    const profileDefaults: Record<string, NpcProfileDraft> = {}
    const profileSaved: Record<string, NpcProfileDraft> = {}
    const profileDrafts: Record<string, NpcProfileDraft> = {}

    for (const { key, npcId, content } of results) {
      charDefaults[key] = content
      const override = loadNpcCharacterPrompt(key)
      charSaved[key] = override ?? content
      charDrafts[key] = override ?? content

      const bp = resolveWorldNPCProfile(npcId)
      const def: NpcProfileDraft = {
        personality: bp.personality.join(", "),
        dislikeds: bp.dislikeds.join(", "),
        speechStyle: bp.speechStyle,
      }
      profileDefaults[npcId] = def
      const saved = loadNpcProfileOverride(npcId)
      const merged: NpcProfileDraft = {
        personality: saved?.personality ?? def.personality,
        dislikeds: saved?.dislikeds ?? def.dislikeds,
        speechStyle: saved?.speechStyle ?? def.speechStyle,
      }
      profileSaved[npcId] = merged
      profileDrafts[npcId] = { ...merged }
    }

    setNpcDefaults(charDefaults)
    setNpcSaved(charSaved)
    setNpcDrafts(charDrafts)
    setNpcProfileDefaults(profileDefaults)
    setNpcProfileSaved(profileSaved)
    setNpcProfileDrafts(profileDrafts)
  })

  return () => { cancelled = true }
}, [])
```

- [ ] **Step 5: Add `handleNpcProfileSave` and `handleNpcProfileReset` handlers**

After the existing `handleNpcReset` callback, add:

```typescript
const handleNpcProfileSave = useCallback(
  (npcId: string) => {
    if (!(npcId in npcProfileDrafts)) return
    const draft = npcProfileDrafts[npcId]
    const override: NpcProfileOverride = {
      personality: draft.personality || undefined,
      dislikeds: draft.dislikeds || undefined,
      speechStyle: draft.speechStyle || undefined,
    }
    saveNpcProfileOverride(npcId, override)
    setNpcProfileSaved((prev) => ({ ...prev, [npcId]: draft }))
  },
  [npcProfileDrafts]
)

const handleNpcProfileReset = useCallback(
  (npcId: string) => {
    const def = npcProfileDefaults[npcId]
    if (!def) return
    clearNpcProfileOverride(npcId)
    setNpcProfileDrafts((prev) => ({ ...prev, [npcId]: def }))
    setNpcProfileSaved((prev) => ({ ...prev, [npcId]: def }))
  },
  [npcProfileDefaults]
)
```

- [ ] **Step 6: Pass profile props to `NpcCharacterEditor` in JSX**

Find the `<NpcCharacterEditor` JSX block (inside `tab === "npcs"`). Replace it with:

```tsx
<NpcCharacterEditor
  npcKey={selectedNpcKey}
  npcId={selectedNpcEntry?.npcId}
  npcName={
    WORLD_NPC_CHARACTER_PROMPTS.find(
      (e) => e.characterPromptKey === selectedNpcKey
    )?.name ?? selectedNpcKey
  }
  draft={npcDrafts[selectedNpcKey] ?? ""}
  saved={npcSaved[selectedNpcKey] ?? ""}
  defaultValue={npcDefaults[selectedNpcKey] ?? ""}
  onChange={(v) =>
    setNpcDrafts((prev) => ({ ...prev, [selectedNpcKey]: v }))
  }
  onSave={() => handleNpcSave(selectedNpcKey)}
  onReset={() => handleNpcReset(selectedNpcKey)}
  profileDraft={selectedNpcEntry ? npcProfileDrafts[selectedNpcEntry.npcId] : undefined}
  onProfileChange={(field, value) => {
    if (!selectedNpcEntry) return
    setNpcProfileDrafts((prev) => ({
      ...prev,
      [selectedNpcEntry.npcId]: { ...(prev[selectedNpcEntry.npcId] ?? { personality: "", dislikeds: "", speechStyle: "" }), [field]: value },
    }))
  }}
  onProfileSave={() => { if (selectedNpcEntry) handleNpcProfileSave(selectedNpcEntry.npcId) }}
  onProfileReset={() => { if (selectedNpcEntry) handleNpcProfileReset(selectedNpcEntry.npcId) }}
  profileDirty={
    selectedNpcEntry
      ? JSON.stringify(npcProfileDrafts[selectedNpcEntry.npcId]) !==
        JSON.stringify(npcProfileSaved[selectedNpcEntry.npcId])
      : false
  }
  profileOverridden={
    selectedNpcEntry
      ? JSON.stringify(npcProfileSaved[selectedNpcEntry.npcId]) !==
        JSON.stringify(npcProfileDefaults[selectedNpcEntry.npcId])
      : false
  }
/>
```

- [ ] **Step 7: Update `NpcCharacterEditor` function signature and add profile section**

Replace the entire `NpcCharacterEditor` function with:

```typescript
function NpcCharacterEditor(props: {
  npcKey: string
  npcId: string | undefined
  npcName: string
  draft: string
  saved: string
  defaultValue: string
  onChange: (value: string) => void
  onSave: () => void
  onReset: () => void
  profileDraft: NpcProfileDraft | undefined
  onProfileChange: (field: keyof NpcProfileDraft, value: string) => void
  onProfileSave: () => void
  onProfileReset: () => void
  profileDirty: boolean
  profileOverridden: boolean
}) {
  const {
    npcName, draft, saved, defaultValue, onChange, onSave, onReset,
    profileDraft, onProfileChange, onProfileSave, onProfileReset,
    profileDirty, profileOverridden,
  } = props
  const dirty = draft !== saved
  const overridden = saved !== defaultValue

  return (
    <div style={styles.editor}>
      <div style={styles.editorHead}>
        <div>
          <h3 style={styles.editorTitle}>{npcName}</h3>
          <p style={styles.editorHint}>
            이 NPC만의 배경·설정·성격을 자유롭게 작성하세요. 응답 프롬프트에 캐릭터 컨텍스트로 주입됩니다.
          </p>
        </div>
        <div style={styles.editorFlags}>
          {dirty && <span style={styles.flagDirty}>저장 안 됨</span>}
          {overridden && <span style={styles.flagOverride}>수정됨</span>}
        </div>
      </div>
      <textarea
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        style={{ ...styles.textarea, minHeight: 200 }}
        placeholder="당신은 [이름]입니다. 배경, 성격, 습관 등을 자유롭게 작성하세요."
      />
      <div style={styles.btnRow}>
        <button onClick={onSave} disabled={!dirty} style={styles.primaryBtn}>저장</button>
        <button onClick={onReset} style={styles.ghostBtn}>원본으로 리셋</button>
      </div>

      {profileDraft && (
        <div style={{ marginTop: 18 }}>
          <div style={styles.editorHead}>
            <div>
              <h3 style={{ ...styles.editorTitle, fontSize: 13 }}>캐릭터 설정</h3>
              <p style={styles.editorHint}>성격·기피·말투를 쉼표로 구분해 입력하세요. 검증 파이프라인에 반영됩니다.</p>
            </div>
            <div style={styles.editorFlags}>
              {profileDirty && <span style={styles.flagDirty}>저장 안 됨</span>}
              {profileOverridden && <span style={styles.flagOverride}>수정됨</span>}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <label style={styles.profileLabel}>
              성격 (personality)
              <input
                value={profileDraft.personality}
                onChange={(e) => onProfileChange("personality", e.target.value)}
                spellCheck={false}
                style={styles.profileInput}
                placeholder="상냥함, 호기심 많음"
              />
            </label>
            <label style={styles.profileLabel}>
              기피 (dislikeds)
              <input
                value={profileDraft.dislikeds}
                onChange={(e) => onProfileChange("dislikeds", e.target.value)}
                spellCheck={false}
                style={styles.profileInput}
                placeholder="무리한 부탁, 거친 말투"
              />
            </label>
            <label style={styles.profileLabel}>
              말투 (speechStyle)
              <input
                value={profileDraft.speechStyle}
                onChange={(e) => onProfileChange("speechStyle", e.target.value)}
                spellCheck={false}
                style={styles.profileInput}
                placeholder="친근한 반말, 짧고 따뜻한 문장"
              />
            </label>
          </div>
          <div style={{ ...styles.btnRow, marginTop: 8 }}>
            <button onClick={onProfileSave} disabled={!profileDirty} style={styles.primaryBtn}>저장</button>
            <button onClick={onProfileReset} style={styles.ghostBtn}>원본으로 리셋</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Add missing styles to the `styles` object**

Add these entries to the `styles` record (before the closing `}`):

```typescript
profileLabel: {
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
  fontSize: 11,
  color: "#8b8f9c",
},
profileInput: {
  padding: "6px 8px",
  fontSize: 12,
  fontFamily: "ui-monospace, monospace",
  color: "#e6e6ea",
  background: "#0f1116",
  border: "1px solid #2a2d36",
  borderRadius: 4,
  outline: "none",
},
```

- [ ] **Step 9: Type-check**

```
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 10: Commit**

```bash
git add src/app/studio/page.tsx
git commit -m "feat: add NPC profile field editing in Studio NPC tab"
```

---

### Task 3: World Page — Merge Profile Override

**Files:**
- Modify: `src/app/dev/world/page.tsx`

Context: In `sendDialogueMessage`, after `const resolvedProfile = resolveWorldNPCProfile(npcId)`, add loading of profile override and merging it before the API call. The `npcId` here is already the raw NPC id (e.g., `"npc_5"`).

- [ ] **Step 1: Add import**

At the top of `src/app/dev/world/page.tsx`, add after the `loadNpcCharacterPrompt` import:

```typescript
import {
  loadNpcProfileOverride,
} from "@/game-core/storage/npc-profile-override-storage"
```

- [ ] **Step 2: Merge profile override in `sendDialogueMessage`**

Find this block in `sendDialogueMessage`:
```typescript
const resolvedProfile = resolveWorldNPCProfile(npcId)
const characterPromptOverride = resolvedProfile.characterPromptKey
  ? loadNpcCharacterPrompt(resolvedProfile.characterPromptKey) ?? undefined
  : undefined
```

Replace with:
```typescript
const resolvedProfile = resolveWorldNPCProfile(npcId)
const profileOverride = loadNpcProfileOverride(npcId)
const mergedProfile = profileOverride
  ? {
      ...resolvedProfile,
      personality: profileOverride.personality
        ? profileOverride.personality.split(",").map((s) => s.trim()).filter(Boolean)
        : resolvedProfile.personality,
      dislikeds: profileOverride.dislikeds
        ? profileOverride.dislikeds.split(",").map((s) => s.trim()).filter(Boolean)
        : resolvedProfile.dislikeds,
      speechStyle: profileOverride.speechStyle ?? resolvedProfile.speechStyle,
    }
  : resolvedProfile
const characterPromptOverride = resolvedProfile.characterPromptKey
  ? loadNpcCharacterPrompt(resolvedProfile.characterPromptKey) ?? undefined
  : undefined
```

Then find the `body: JSON.stringify({` block and replace `npcProfile: resolvedProfile` with `npcProfile: mergedProfile`:

```typescript
body: JSON.stringify({
  npcProfile: mergedProfile,
  npcMemory: loadNPCMemory(npcId),
  userMessage,
  gameState: WORLD_DIALOGUE_STATE,
  promptOverrides: loadPromptOverrides(),
  characterPromptOverride,
}),
```

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Run all tests**

```
npx vitest run
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/dev/world/page.tsx
git commit -m "feat: merge npc profile override into interact API call"
```
