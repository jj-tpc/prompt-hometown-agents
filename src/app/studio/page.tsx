"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PromptOverrides } from "@/game-core/agent/prompt-overrides"
import {
  loadPromptOverrides,
  savePromptOverrides,
} from "@/game-core/agent/prompt-overrides-storage"

type FieldKey = "interact" | "validate" | "personality" | "decision" | "worldKnowledge"
type TabKey = "interact" | "pipeline" | "world" | "settings"

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
  { key: "settings", label: "설정" },
]

type DefaultsApi = {
  interact: string
  validate: string
  personality: string
  decision: string
}

// /dev/world 페이지의 고정 콘텐츠 크기. 게임 화면은 이 픽셀 기준으로 고정 렌더되고,
// 스크린이 좁아지면 transform scale 로 비례 축소된다(스크롤 금지).
const GAME_NATIVE_W = 1332
const GAME_NATIVE_H = 984
const SCREEN_PADDING = 16

export default function StudioPage() {
  const [defaults, setDefaults] = useState<Record<FieldKey, string> | null>(null)
  const [drafts, setDrafts] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>)
  const [saved, setSaved] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>)
  const [tab, setTab] = useState<TabKey>("interact")
  const [error, setError] = useState<string | null>(null)

  const screenRef = useRef<HTMLDivElement>(null)
  const [gameScale, setGameScale] = useState(1)

  useEffect(() => {
    const el = screenRef.current
    if (!el) return
    const update = () => {
      const availW = el.clientWidth - SCREEN_PADDING * 2
      const availH = el.clientHeight - SCREEN_PADDING * 2
      const next = Math.min(1, availW / GAME_NATIVE_W, availH / GAME_NATIVE_H)
      setGameScale(next > 0 ? next : 0.1)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
            </div>
          )}
        </div>
      </section>

      <section style={styles.rightPane}>
        <div style={styles.gbCasing}>
          <div style={styles.gbBrandRow}>
            <span style={styles.gbPowerDot} />
            <span style={styles.gbPowerLabel}>POWER</span>
            <span style={styles.gbDotMatrix}>DOT MATRIX WITH STEREO SOUND</span>
          </div>
          <div ref={screenRef} style={styles.gbScreenFrame}>
            <div
              style={{
                width: GAME_NATIVE_W * gameScale,
                height: GAME_NATIVE_H * gameScale,
                overflow: "hidden",
              }}
            >
              <iframe
                src="/dev/world"
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
          <div style={styles.gbLogoRow}>
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
    width: "94%",
    height: "96%",
    minHeight: 0,
    padding: "20px 24px 26px",
    boxSizing: "border-box",
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
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: SCREEN_PADDING,
    background: "#2c2c33",
    borderRadius: "10px 10px 26px 10px",
    overflow: "hidden",
    boxShadow: "inset 0 4px 12px rgba(0,0,0,0.7)",
  },
  iframe: {
    border: 0,
    display: "block",
    background: "#1a1a24",
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
}
