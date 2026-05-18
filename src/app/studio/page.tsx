"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PromptOverrides } from "@/game-core/agent/prompt-overrides"
import {
  loadPromptOverrides,
  savePromptOverrides,
} from "@/game-core/agent/prompt-overrides-storage"
import { clearAllNPCHistory } from "@/game-core/storage/npc-memory"
import { WORLD_NPC_CHARACTER_PROMPTS } from "@/game-core/game-loop/world-dialogue"
import {
  loadNpcCharacterPrompt,
  saveNpcCharacterPrompt,
  clearNpcCharacterPrompt,
} from "@/game-core/storage/npc-character-prompt-storage"

type FieldKey = "interact" | "validate" | "personality" | "decision" | "worldKnowledge"
type TabKey = "interact" | "pipeline" | "world" | "npcs" | "settings"

const FIELD_KEYS: FieldKey[] = ["interact", "validate", "personality", "decision", "worldKnowledge"]

const FIELD_META: Record<FieldKey, { label: string; hint: string }> = {
  interact: {
    label: "응답 시스템 프롬프트",
    hint: "NPC가 유저와 대화할 때 사용하는 메인 시스템 프롬프트입니다.",
  },
  validate: {
    label: "검증 (validate)",
    hint: "요청이 게임 세계에서 실행 가능한지 판별합니다.",
  },
  personality: {
    label: "성격 (personality)",
    hint: "요청이 NPC의 성격·관계와 어울리는지 판별합니다.",
  },
  decision: {
    label: "결정 (decision)",
    hint: "검증·성격 결과를 종합해 최종 수락/거절을 결정합니다.",
  },
  worldKnowledge: {
    label: "세계지식",
    hint: "원본 파일이 없는 신규 항목입니다. 응답 프롬프트에 세계관 컨텍스트로 주입됩니다.",
  },
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "interact", label: "응답 프롬프트" },
  { key: "pipeline", label: "검증 파이프라인" },
  { key: "world", label: "세계지식" },
  { key: "npcs", label: "NPC 프롬프트" },
  { key: "settings", label: "설정" },
]

type DefaultsApi = {
  interact: string
  validate: string
  personality: string
  decision: string
}

// /dev/world?embed=1 의 고정 콘텐츠 크기 (스테이지 1280x832 + 검은 패딩 20px).
// 게임 화면은 이 픽셀 기준으로 고정 렌더되고, 스크린은 transform scale 로 비례 축소된다.
const GAME_NATIVE_W = 1320
const GAME_NATIVE_H = 872
const GAME_AR = GAME_NATIVE_W / GAME_NATIVE_H
// 게임보이 케이싱 치수. 스크린은 게임 비율에 맞춰지고, 케이싱이 그 크기를 감싼다.
const SCREEN_BEZEL = 16
const CASING_PAD_X = 24
const CASING_PAD_TOP = 20
const CASING_PAD_BOTTOM = 26
const BRAND_MARGIN_V = 12
const LOGO_MARGIN_V = 12
const PANE_MARGIN = 28

export default function StudioPage() {
  const [defaults, setDefaults] = useState<Record<FieldKey, string> | null>(null)
  const [drafts, setDrafts] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>)
  const [saved, setSaved] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>)
  const [tab, setTab] = useState<TabKey>("interact")
  const [error, setError] = useState<string | null>(null)
  const [historyMsg, setHistoryMsg] = useState<string | null>(null)

  const [selectedNpcKey, setSelectedNpcKey] = useState<string>(
    WORLD_NPC_CHARACTER_PROMPTS[0]?.characterPromptKey ?? ""
  )
  const [npcDefaults, setNpcDefaults] = useState<Record<string, string>>({})
  const [npcDrafts, setNpcDrafts] = useState<Record<string, string>>({})
  const [npcSaved, setNpcSaved] = useState<Record<string, string>>({})

  const paneRef = useRef<HTMLDivElement>(null)
  const brandRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const [screen, setScreen] = useState({ w: GAME_NATIVE_W, h: GAME_NATIVE_H })

  useEffect(() => {
    const pane = paneRef.current
    if (!pane) return
    const update = () => {
      const brandH = brandRef.current?.offsetHeight ?? 20
      const logoH = logoRef.current?.offsetHeight ?? 32
      const chromeW = 2 * CASING_PAD_X + 2 * SCREEN_BEZEL
      const chromeH =
        CASING_PAD_TOP +
        brandH +
        BRAND_MARGIN_V +
        2 * SCREEN_BEZEL +
        LOGO_MARGIN_V +
        logoH +
        CASING_PAD_BOTTOM
      const availW = pane.clientWidth - 2 * PANE_MARGIN - chromeW
      const availH = pane.clientHeight - 2 * PANE_MARGIN - chromeH
      const h = Math.max(80, Math.min(availH, availW / GAME_AR))
      setScreen({ w: h * GAME_AR, h })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(pane)
    return () => observer.disconnect()
  }, [])

  const gameScale = screen.w / GAME_NATIVE_W

  useEffect(() => {
    let cancelled = false
    fetch("/api/prompts")
      .then((res) => {
        if (!res.ok) throw new Error(`기본 프롬프트 로드 실패 (${res.status})`)
        return res.json() as Promise<DefaultsApi>
      })
      .then((api) => {
        if (cancelled) return
        const def: Record<FieldKey, string> = {
          interact: api.interact,
          validate: api.validate,
          personality: api.personality,
          decision: api.decision,
          worldKnowledge: "",
        }
        const overrides = loadPromptOverrides()
        const initial = {} as Record<FieldKey, string>
        for (const key of FIELD_KEYS) {
          initial[key] = overrides[key] ?? def[key]
        }
        setDefaults(def)
        setSaved(initial)
        setDrafts({ ...initial })
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const entries = WORLD_NPC_CHARACTER_PROMPTS
    if (entries.length === 0) return

    Promise.all(
      entries.map((entry) =>
        fetch(`/api/prompts/npc/${entry.characterPromptKey}`)
          .then((res) => res.json() as Promise<{ content: string }>)
          .then((data) => ({ key: entry.characterPromptKey, content: data.content }))
          .catch(() => ({ key: entry.characterPromptKey, content: "" }))
      )
    ).then((results) => {
      const defaults: Record<string, string> = {}
      const saved: Record<string, string> = {}
      const drafts: Record<string, string> = {}
      for (const { key, content } of results) {
        defaults[key] = content
        const override = loadNpcCharacterPrompt(key)
        saved[key] = override ?? content
        drafts[key] = override ?? content
      }
      setNpcDefaults(defaults)
      setNpcSaved(saved)
      setNpcDrafts(drafts)
    })
  }, [])

  // saved 맵을 localStorage 오버라이드로 환산한다. 기본값과 같은 필드는 제외(원본 파일 사용).
  const persist = useCallback(
    (savedMap: Record<FieldKey, string>) => {
      if (!defaults) return
      const overrides: PromptOverrides = {}
      for (const key of FIELD_KEYS) {
        if (savedMap[key] !== defaults[key]) overrides[key] = savedMap[key]
      }
      savePromptOverrides(overrides)
    },
    [defaults]
  )

  const handleSave = useCallback(
    (key: FieldKey) => {
      const next = { ...saved, [key]: drafts[key] }
      setSaved(next)
      persist(next)
    },
    [saved, drafts, persist]
  )

  const handleCancel = useCallback(
    (key: FieldKey) => {
      setDrafts((prev) => ({ ...prev, [key]: saved[key] }))
    },
    [saved]
  )

  const handleReset = useCallback(
    (key: FieldKey) => {
      if (!defaults) return
      setDrafts((prev) => ({ ...prev, [key]: defaults[key] }))
      const next = { ...saved, [key]: defaults[key] }
      setSaved(next)
      persist(next)
    },
    [defaults, saved, persist]
  )

  const handleResetAll = useCallback(() => {
    if (!defaults) return
    const next = { ...defaults }
    setDrafts({ ...next })
    setSaved(next)
    savePromptOverrides({})
  }, [defaults])

  const handleClearHistory = useCallback(() => {
    const count = clearAllNPCHistory()
    setHistoryMsg(
      count > 0
        ? `${count}명의 NPC 대화 히스토리를 비웠습니다.`
        : "비울 NPC 대화 기록이 없습니다."
    )
  }, [])

  const handleNpcSave = useCallback(
    (key: string) => {
      const value = npcDrafts[key] ?? ""
      saveNpcCharacterPrompt(key, value)
      setNpcSaved((prev) => ({ ...prev, [key]: value }))
    },
    [npcDrafts]
  )

  const handleNpcReset = useCallback(
    (key: string) => {
      const defaultValue = npcDefaults[key] ?? ""
      clearNpcCharacterPrompt(key)
      setNpcDrafts((prev) => ({ ...prev, [key]: defaultValue }))
      setNpcSaved((prev) => ({ ...prev, [key]: defaultValue }))
    },
    [npcDefaults]
  )

  const overrideStatus = useMemo(() => {
    if (!defaults) return []
    return FIELD_KEYS.map((key) => ({
      key,
      label: FIELD_META[key].label,
      overridden: saved[key] !== defaults[key],
    }))
  }, [defaults, saved])

  return (
    <div style={styles.root}>
      <section style={styles.leftPane}>
        <header style={styles.header}>
          <h1 style={styles.title}>프롬프트 스튜디오</h1>
          <p style={styles.subtitle}>
            여기서 수정한 내용은 원본 .txt 파일을 건드리지 않고, 요청 시점에 적용됩니다.
          </p>
        </header>

        <nav style={styles.tabBar}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{ ...styles.tab, ...(tab === t.key ? styles.tabActive : {}) }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div style={styles.tabBody}>
          {error && <div style={styles.errorBox}>{error}</div>}
          {!defaults && !error && <div style={styles.loading}>기본 프롬프트 로드 중…</div>}

          {defaults && tab === "interact" && (
            <PromptEditor
              fieldKey="interact"
              draft={drafts.interact}
              saved={saved.interact}
              defaultValue={defaults.interact}
              onChange={(v) => setDrafts((p) => ({ ...p, interact: v }))}
              onSave={() => handleSave("interact")}
              onCancel={() => handleCancel("interact")}
              onReset={() => handleReset("interact")}
            />
          )}

          {defaults && tab === "pipeline" && (
            <div style={styles.stack}>
              <p style={styles.pipelineNote}>
                검증 파이프라인은 3단계입니다. 각 단계 프롬프트를 개별적으로 수정·저장하세요.
              </p>
              {(["validate", "personality", "decision"] as FieldKey[]).map((key) => (
                <PromptEditor
                  key={key}
                  fieldKey={key}
                  draft={drafts[key]}
                  saved={saved[key]}
                  defaultValue={defaults[key]}
                  onChange={(v) => setDrafts((p) => ({ ...p, [key]: v }))}
                  onSave={() => handleSave(key)}
                  onCancel={() => handleCancel(key)}
                  onReset={() => handleReset(key)}
                />
              ))}
            </div>
          )}

          {defaults && tab === "world" && (
            <PromptEditor
              fieldKey="worldKnowledge"
              draft={drafts.worldKnowledge}
              saved={saved.worldKnowledge}
              defaultValue={defaults.worldKnowledge}
              onChange={(v) => setDrafts((p) => ({ ...p, worldKnowledge: v }))}
              onSave={() => handleSave("worldKnowledge")}
              onCancel={() => handleCancel("worldKnowledge")}
              onReset={() => handleReset("worldKnowledge")}
            />
          )}

          {tab === "npcs" && (
            <div style={styles.npcTab}>
              <div style={styles.npcList}>
                {WORLD_NPC_CHARACTER_PROMPTS.map((entry) => {
                  const isSelected = entry.characterPromptKey === selectedNpcKey
                  const isOverridden = npcSaved[entry.characterPromptKey] !== npcDefaults[entry.characterPromptKey]
                  return (
                    <button
                      key={entry.characterPromptKey}
                      onClick={() => setSelectedNpcKey(entry.characterPromptKey)}
                      style={{
                        ...styles.npcListItem,
                        ...(isSelected ? styles.npcListItemActive : {}),
                      }}
                    >
                      <span style={styles.npcListName}>{entry.name}</span>
                      {isOverridden && <span style={styles.flagOverride}>수정됨</span>}
                    </button>
                  )
                })}
              </div>
              <div style={styles.npcEditor}>
                {selectedNpcKey && (
                  <NpcCharacterEditor
                    npcKey={selectedNpcKey}
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
                  />
                )}
              </div>
            </div>
          )}

          {defaults && tab === "settings" && (
            <div style={styles.stack}>
              <h2 style={styles.sectionTitle}>오버라이드 상태</h2>
              <ul style={styles.statusList}>
                {overrideStatus.map((s) => (
                  <li key={s.key} style={styles.statusItem}>
                    <span>{s.label}</span>
                    <span style={s.overridden ? styles.badgeOn : styles.badgeOff}>
                      {s.overridden ? "수정됨" : "원본"}
                    </span>
                  </li>
                ))}
              </ul>
              <button onClick={handleResetAll} style={styles.dangerBtn}>
                모든 프롬프트 원본으로 초기화
              </button>
              <p style={styles.settingsNote}>
                초기화하면 저장된 모든 웹 수정 내용이 삭제되고 원본 .txt 파일 기준으로 돌아갑니다.
              </p>

              <h2 style={styles.sectionTitle}>NPC 대화 히스토리</h2>
              <button onClick={handleClearHistory} style={styles.dangerBtn}>
                모든 NPC 대화 히스토리 초기화
              </button>
              {historyMsg && <p style={styles.historyMsg}>{historyMsg}</p>}
              <p style={styles.settingsNote}>
                모든 NPC의 대화 기록을 비웁니다. 다음 대화부터 NPC가 이전 대화를 기억하지 못합니다.
                (관계도 점수 등 나머지 기억은 유지됩니다.)
              </p>
            </div>
          )}
        </div>
      </section>

      <section ref={paneRef} style={styles.rightPane}>
        <div style={styles.gbCasing}>
          <div ref={brandRef} style={styles.gbBrandRow}>
            <span style={styles.gbPowerDot} />
            <span style={styles.gbPowerLabel}>POWER</span>
            <span style={styles.gbDotMatrix}>DOT MATRIX WITH STEREO SOUND</span>
          </div>
          <div
            style={{
              ...styles.gbScreenFrame,
              width: screen.w + 2 * SCREEN_BEZEL,
              height: screen.h + 2 * SCREEN_BEZEL,
            }}
          >
            <div style={{ width: screen.w, height: screen.h, overflow: "hidden" }}>
              <iframe
                src="/dev/world?embed=1"
                title="게임"
                scrolling="no"
                style={{
                  ...styles.iframe,
                  width: GAME_NATIVE_W,
                  height: GAME_NATIVE_H,
                  transform: `scale(${gameScale})`,
                  transformOrigin: "top left",
                }}
              />
            </div>
          </div>
          <div ref={logoRef} style={styles.gbLogoRow}>
            <span style={styles.gbLogoMain}>Hometown</span>
            <span style={styles.gbLogoSub}>AGENT BOY</span>
          </div>
        </div>
      </section>
    </div>
  )
}

function PromptEditor(props: {
  fieldKey: FieldKey
  draft: string
  saved: string
  defaultValue: string
  onChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
  onReset: () => void
}) {
  const { fieldKey, draft, saved, defaultValue, onChange, onSave, onCancel, onReset } = props
  const meta = FIELD_META[fieldKey]
  const dirty = draft !== saved
  const overridden = saved !== defaultValue

  return (
    <div style={styles.editor}>
      <div style={styles.editorHead}>
        <div>
          <h3 style={styles.editorTitle}>{meta.label}</h3>
          <p style={styles.editorHint}>{meta.hint}</p>
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
        style={styles.textarea}
        placeholder={fieldKey === "worldKnowledge" ? "게임 세계관·설정·로어를 자유롭게 작성하세요." : ""}
      />
      <div style={styles.btnRow}>
        <button onClick={onSave} disabled={!dirty} style={styles.primaryBtn}>
          저장
        </button>
        <button onClick={onCancel} disabled={!dirty} style={styles.secondaryBtn}>
          취소
        </button>
        <button onClick={onReset} style={styles.ghostBtn}>
          원본으로 리셋
        </button>
      </div>
    </div>
  )
}

function NpcCharacterEditor(props: {
  npcKey: string
  npcName: string
  draft: string
  saved: string
  defaultValue: string
  onChange: (value: string) => void
  onSave: () => void
  onReset: () => void
}) {
  const { npcName, draft, saved, defaultValue, onChange, onSave, onReset } = props
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
        style={{ ...styles.textarea, minHeight: 280 }}
        placeholder="당신은 [이름]입니다. 배경, 성격, 습관 등을 자유롭게 작성하세요."
      />
      <div style={styles.btnRow}>
        <button onClick={onSave} disabled={!dirty} style={styles.primaryBtn}>
          저장
        </button>
        <button onClick={onReset} style={styles.ghostBtn}>
          원본으로 리셋
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    width: "100vw",
    height: "100vh",
    margin: 0,
    background: "#0f1116",
    color: "#e6e6ea",
    fontFamily: "system-ui, sans-serif",
  },
  leftPane: {
    width: "50%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #2a2d36",
    boxSizing: "border-box",
  },
  rightPane: {
    width: "50%",
    height: "100%",
    background: "#1a1c22",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  },
  gbCasing: {
    display: "flex",
    flexDirection: "column",
    padding: `${CASING_PAD_TOP}px ${CASING_PAD_X}px ${CASING_PAD_BOTTOM}px`,
    background: "linear-gradient(150deg, #d4d0c7 0%, #bfbab0 55%, #aca79c 100%)",
    borderRadius: "16px 16px 78px 16px",
    boxShadow:
      "0 20px 44px rgba(0,0,0,0.55), inset 0 2px 3px rgba(255,255,255,0.65), inset 0 -4px 8px rgba(0,0,0,0.28)",
  },
  gbBrandRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    margin: "2px 0 10px",
    paddingLeft: 8,
  },
  gbPowerDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    background: "#c0392b",
    boxShadow: "0 0 5px rgba(231,76,60,0.85)",
  },
  gbPowerLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: "#5a5750",
    letterSpacing: 1.5,
  },
  gbDotMatrix: {
    marginLeft: "auto",
    fontSize: 10,
    fontWeight: 700,
    color: "#46466a",
    letterSpacing: 0.6,
    fontFamily: "Georgia, 'Times New Roman', serif",
  },
  gbScreenFrame: {
    display: "flex",
    boxSizing: "border-box",
    padding: SCREEN_BEZEL,
    background: "#2c2c33",
    borderRadius: "10px 10px 26px 10px",
    overflow: "hidden",
    boxShadow: "inset 0 4px 12px rgba(0,0,0,0.7)",
  },
  iframe: {
    border: 0,
    display: "block",
    background: "#000",
  },
  gbLogoRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 7,
    marginTop: 12,
    paddingLeft: 8,
  },
  gbLogoMain: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontStyle: "italic",
    fontWeight: 800,
    fontSize: 24,
    color: "#33307f",
    letterSpacing: 0.3,
  },
  gbLogoSub: {
    fontWeight: 800,
    fontSize: 12,
    color: "#4a4843",
    letterSpacing: 1.5,
  },
  header: { padding: "16px 20px 8px" },
  title: { margin: 0, fontSize: 18, fontWeight: 600 },
  subtitle: { margin: "4px 0 0", fontSize: 12, color: "#8b8f9c" },
  tabBar: {
    display: "flex",
    gap: 4,
    padding: "8px 20px 0",
    borderBottom: "1px solid #2a2d36",
  },
  tab: {
    padding: "8px 14px",
    fontSize: 13,
    background: "transparent",
    color: "#8b8f9c",
    border: "none",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
  },
  tabActive: { color: "#e6e6ea", borderBottom: "2px solid #6c8cff" },
  tabBody: { flex: 1, overflowY: "auto", padding: 20 },
  loading: { color: "#8b8f9c", fontSize: 13 },
  errorBox: {
    background: "#3a1d1d",
    color: "#ff9b9b",
    padding: 12,
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 12,
  },
  stack: { display: "flex", flexDirection: "column", gap: 20 },
  pipelineNote: { margin: 0, fontSize: 12, color: "#8b8f9c" },
  editor: {
    background: "#171a22",
    border: "1px solid #2a2d36",
    borderRadius: 8,
    padding: 14,
  },
  editorHead: { display: "flex", justifyContent: "space-between", gap: 12 },
  editorTitle: { margin: 0, fontSize: 14, fontWeight: 600 },
  editorHint: { margin: "3px 0 0", fontSize: 11, color: "#8b8f9c" },
  editorFlags: { display: "flex", gap: 6, flexShrink: 0 },
  flagDirty: {
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 4,
    background: "#4a3a1d",
    color: "#ffd27a",
  },
  flagOverride: {
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 4,
    background: "#1d3a2d",
    color: "#7affb0",
  },
  textarea: {
    width: "100%",
    minHeight: 220,
    marginTop: 10,
    padding: 10,
    fontSize: 12,
    fontFamily: "ui-monospace, monospace",
    lineHeight: 1.5,
    color: "#e6e6ea",
    background: "#0f1116",
    border: "1px solid #2a2d36",
    borderRadius: 6,
    resize: "vertical",
    boxSizing: "border-box",
  },
  btnRow: { display: "flex", gap: 8, marginTop: 10 },
  primaryBtn: {
    padding: "7px 14px",
    fontSize: 12,
    background: "#6c8cff",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "7px 14px",
    fontSize: 12,
    background: "#2a2d36",
    color: "#e6e6ea",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  ghostBtn: {
    padding: "7px 14px",
    fontSize: 12,
    background: "transparent",
    color: "#8b8f9c",
    border: "1px solid #2a2d36",
    borderRadius: 6,
    cursor: "pointer",
  },
  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 600 },
  statusList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 },
  statusItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 12px",
    background: "#171a22",
    border: "1px solid #2a2d36",
    borderRadius: 6,
    fontSize: 13,
  },
  badgeOn: { fontSize: 11, color: "#7affb0" },
  badgeOff: { fontSize: 11, color: "#8b8f9c" },
  dangerBtn: {
    alignSelf: "flex-start",
    padding: "8px 14px",
    fontSize: 12,
    background: "#3a1d1d",
    color: "#ff9b9b",
    border: "1px solid #5a2d2d",
    borderRadius: 6,
    cursor: "pointer",
  },
  settingsNote: { margin: 0, fontSize: 11, color: "#8b8f9c" },
  historyMsg: { margin: 0, fontSize: 12, color: "#7affb0" },
  npcTab: {
    display: "flex",
    gap: 12,
    height: "100%",
  },
  npcList: {
    width: 180,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    overflowY: "auto" as const,
  },
  npcListItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 10px",
    background: "transparent",
    color: "#8b8f9c",
    border: "1px solid transparent",
    borderRadius: 6,
    cursor: "pointer",
    textAlign: "left" as const,
    fontSize: 12,
    gap: 6,
  },
  npcListItemActive: {
    background: "#171a22",
    color: "#e6e6ea",
    border: "1px solid #2a2d36",
  },
  npcListName: {
    flex: 1,
  },
  npcEditor: {
    flex: 1,
    minWidth: 0,
  },
}
