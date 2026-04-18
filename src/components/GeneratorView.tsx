import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { EXAM_LEVEL_CONFIGS, QUESTION_TYPE_CONFIGS } from '../types'
import type { ExamLevel, QuestionType } from '../types'
import { generateQuestions, generatePassageSets } from '../lib/gemini'

export default function GeneratorView() {
  const dataSources            = useAppStore((s) => s.dataSources)
  const config                 = useAppStore((s) => s.generationConfig)
  const updateConfig           = useAppStore((s) => s.updateGenerationConfig)
  const settings               = useAppStore((s) => s.settings)
  const appendQuestions        = useAppStore((s) => s.appendQuestions)
  const appendPassageSets      = useAppStore((s) => s.appendPassageSets)
  const setActiveView          = useAppStore((s) => s.setActiveView)
  const setQuestionListTab     = useAppStore((s) => s.setQuestionListTab)
  const isGenerating           = useAppStore((s) => s.isGenerating)
  const setIsGenerating        = useAppStore((s) => s.setIsGenerating)
  const generationProgress     = useAppStore((s) => s.generationProgress)
  const setGenerationProgress  = useAppStore((s) => s.setGenerationProgress)

  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selected = dataSources.filter((s) => s.selected)
  const mode = config.generationMode ?? 'individual'

  // ── Toggles ──────────────────────────────────────────────────────────────
  const toggleLevel = (level: ExamLevel) => {
    const cur = config.levels
    if (cur.includes(level)) {
      if (cur.length === 1) return
      updateConfig({ levels: cur.filter((l) => l !== level) })
    } else {
      updateConfig({ levels: [...cur, level] })
    }
  }

  const toggleType = (type: QuestionType) => {
    const cur = config.questionTypes
    if (cur.includes(type)) {
      if (cur.length === 1) return
      updateConfig({ questionTypes: cur.filter((t) => t !== type) })
    } else {
      updateConfig({ questionTypes: [...cur, type] })
    }
  }

  // ── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setError(null)
    setSuccess(null)

    if (!settings.geminiApiKey) {
      setError('設定画面でGemini APIキーを設定してください。')
      return
    }
    if (selected.length === 0) {
      setError('データソース画面で少なくとも1つのソースを選択してください。')
      return
    }

    setIsGenerating(true)
    try {
      if (mode === 'passage') {
        const sets = await generatePassageSets(
          settings.geminiApiKey,
          settings.geminiModel,
          selected.map((s) => ({ name: s.name, content: s.content })),
          config,
          setGenerationProgress
        )
        appendPassageSets(sets)
        const totalQ = sets.reduce((a, s) => a + s.questions.length, 0)
        setSuccess(`${sets.length}セット（計${totalQ}問）の長文問題を生成しました！`)
        setQuestionListTab('passage')
      } else {
        const questions = await generateQuestions(
          settings.geminiApiKey,
          settings.geminiModel,
          selected.map((s) => ({ name: s.name, content: s.content })),
          config,
          setGenerationProgress
        )
        appendQuestions(questions)
        setSuccess(`${questions.length}問の問題を生成しました！`)
        setQuestionListTab('individual')
      }
      setTimeout(() => setActiveView('questions'), 1400)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsGenerating(false)
      setGenerationProgress('')
    }
  }

  const canGenerate = selected.length > 0 && !!settings.geminiApiKey && !isGenerating

  // ── Styles ────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    padding: '20px 24px',
    borderRadius: 14,
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
  }
  const sectionTitle: React.CSSProperties = {
    fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--color-text)',
  }
  const subNote: React.CSSProperties = {
    fontSize: 11, color: 'var(--color-text-dim)', fontWeight: 400, marginLeft: 6,
  }
  const input: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-3)', color: 'var(--color-text)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 740, margin: '0 auto', padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>問題生成</h2>
          <p style={{ marginTop: 6, color: 'var(--color-text-muted)', fontSize: 14 }}>
            AIが学習資料から試験問題を自動生成します。
          </p>
        </div>

        {/* ── Mode Toggle ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex', borderRadius: 14, overflow: 'hidden',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
          }}
        >
          {([
            { id: 'individual', label: '📝 一問一答モード', desc: '独立した問題を複数生成' },
            { id: 'passage',    label: '📖 長文問題モード', desc: 'リード文＋複数設問のセットを生成' },
          ] as const).map((m) => {
            const active = mode === m.id
            return (
              <button
                key={m.id}
                onClick={() => updateConfig({ generationMode: m.id })}
                style={{
                  flex: 1, padding: '14px 16px', border: 'none', cursor: 'pointer',
                  background: active
                    ? 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)'
                    : 'transparent',
                  color: active ? '#fff' : 'var(--color-text-muted)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700 }}>{m.label}</span>
                <span style={{ fontSize: 11, opacity: 0.8 }}>{m.desc}</span>
              </button>
            )
          })}
        </div>

        {/* Source status */}
        <div
          style={{
            ...card,
            borderColor: selected.length > 0 ? 'var(--color-border-strong)' : 'rgba(239,68,68,0.3)',
            background:  selected.length > 0 ? 'var(--color-surface-2)'     : 'rgba(239,68,68,0.05)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}
        >
          <span style={{ fontSize: 22 }}>{selected.length > 0 ? '✅' : '⚠️'}</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              {selected.length > 0
                ? `${selected.length}件のデータソースが選択されています`
                : 'データソースが選択されていません'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
              {selected.length > 0
                ? `合計 ${selected.reduce((a, s) => a + s.content.length, 0).toLocaleString()} 文字`
                : 'データソース画面でファイルを追加・選択してください'}
            </p>
          </div>
          {selected.length === 0 && (
            <button
              onClick={() => setActiveView('datasource')}
              style={{
                padding: '7px 16px', borderRadius: 8, border: '1px solid var(--color-border)',
                background: 'var(--color-surface-3)', color: 'var(--color-text-muted)',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              追加 →
            </button>
          )}
        </div>

        {/* ── Level Selection ─────────────────────────────────────────────── */}
        <div style={card}>
          <p style={sectionTitle}>
            対象レベル
            <span style={subNote}>（複数選択可）</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {EXAM_LEVEL_CONFIGS.map((lv) => {
              const active = config.levels.includes(lv.id)
              return (
                <button
                  key={lv.id}
                  onClick={() => toggleLevel(lv.id)}
                  title={lv.description}
                  style={{
                    padding: '10px 8px', borderRadius: 12, cursor: 'pointer',
                    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: active ? 'rgba(99,102,241,0.14)' : 'var(--color-surface-3)',
                    textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{lv.emoji}</div>
                  <div
                    style={{
                      fontSize: 11, fontWeight: 700,
                      color: active ? 'var(--color-primary-hover)' : 'var(--color-text)',
                    }}
                  >
                    {lv.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 2, lineHeight: 1.4 }}>
                    {lv.description}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Custom level input */}
          {config.levels.includes('custom') && (
            <input
              type="text"
              placeholder="レベルの詳細を入力（例：高校2年理系・大学院物理）"
              value={config.customLevel}
              onChange={(e) => updateConfig({ customLevel: e.target.value })}
              style={{ ...input, marginTop: 10 }}
            />
          )}
        </div>

        {/* ── Question Types ───────────────────────────────────────────────── */}
        <div style={card}>
          <p style={sectionTitle}>
            問題形式
            <span style={subNote}>（複数選択可）</span>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {QUESTION_TYPE_CONFIGS.map((qt) => {
              const active = config.questionTypes.includes(qt.id)
              return (
                <button
                  key={qt.id}
                  onClick={() => toggleType(qt.id)}
                  title={qt.description}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 24, cursor: 'pointer',
                    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: active
                      ? 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)'
                      : 'var(--color-surface-3)',
                    color: active ? '#fff' : 'var(--color-text-muted)',
                    fontSize: 13, fontWeight: 600,
                    boxShadow: active ? '0 4px 12px rgba(99,102,241,0.25)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{qt.emoji}</span>
                  <span>{qt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Count & Subject ──────────────────────────────────────────────── */}
        <div style={{ ...card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {mode === 'individual' ? (
            <div>
              <label style={{ ...sectionTitle, display: 'block' }}>
                問題数：
                <span style={{ color: 'var(--color-primary)' }}>{config.count}問</span>
              </label>
              <input
                type="range"
                min={1} max={50} step={1}
                value={config.count}
                onChange={(e) => updateConfig({ count: Number(e.target.value) })}
                style={{ width: '100%', marginTop: 6 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-dim)', marginTop: 4 }}>
                <span>1</span><span>25</span><span>50</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ ...sectionTitle, display: 'block' }}>
                  長文セット数：
                  <span style={{ color: 'var(--color-primary)' }}>{config.passageCount ?? 2}セット</span>
                </label>
                <input
                  type="range"
                  min={1} max={5} step={1}
                  value={config.passageCount ?? 2}
                  onChange={(e) => updateConfig({ passageCount: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 6 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-dim)', marginTop: 4 }}>
                  <span>1</span><span>3</span><span>5</span>
                </div>
              </div>
              <div>
                <label style={{ ...sectionTitle, display: 'block' }}>
                  各セットの設問数：
                  <span style={{ color: 'var(--color-primary)' }}>{config.questionsPerPassage ?? 5}問</span>
                </label>
                <input
                  type="range"
                  min={2} max={10} step={1}
                  value={config.questionsPerPassage ?? 5}
                  onChange={(e) => updateConfig({ questionsPerPassage: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 6 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-dim)', marginTop: 4 }}>
                  <span>2</span><span>6</span><span>10</span>
                </div>
              </div>
            </div>
          )}
          <div>
            <label style={{ ...sectionTitle, display: 'block' }}>
              科目・テーマ<span style={subNote}>（任意）</span>
            </label>
            <input
              type="text"
              placeholder="例：日本史、微積分、英文法"
              value={config.subject}
              onChange={(e) => updateConfig({ subject: e.target.value })}
              style={{ ...input, marginTop: 6 }}
            />
          </div>
        </div>

        {/* ── Additional Instructions ────────────────────────────────────── */}
        <div style={card}>
          <label style={{ ...sectionTitle, display: 'block' }}>
            追加指示<span style={subNote}>（任意）</span>
          </label>
          <textarea
            rows={3}
            placeholder="例：江戸時代の文化に焦点を当ててください / 計算は整数のみ / 標準〜難レベルで"
            value={config.additionalInstructions}
            onChange={(e) => updateConfig({ additionalInstructions: e.target.value })}
            style={{ ...input, resize: 'vertical' as const, fontFamily: 'inherit' }}
          />
        </div>

        {/* Alerts */}
        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: 10,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', fontSize: 13,
          }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{
            padding: '12px 16px', borderRadius: 10,
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
            color: '#34d399', fontSize: 13,
          }}>
            ✅ {success}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          style={{
            width: '100%', padding: '16px 24px', borderRadius: 14,
            border: 'none', cursor: canGenerate ? 'pointer' : 'not-allowed',
            background: canGenerate
              ? 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)'
              : 'var(--color-surface-3)',
            color: canGenerate ? '#fff' : 'var(--color-text-dim)',
            fontSize: 16, fontWeight: 700,
            boxShadow: canGenerate ? '0 8px 24px rgba(99,102,241,0.3)' : 'none',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {isGenerating ? (
            <>
              <span
                style={{
                  width: 18, height: 18,
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  flexShrink: 0,
                }}
              />
              {generationProgress || '生成中...'}
            </>
          ) : (
            <>⚡ 問題を生成する</>
          )}
        </button>

        {!settings.geminiApiKey && (
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-warning)', marginTop: -8 }}>
            ⚠️{' '}
            <button
              onClick={() => setActiveView('settings')}
              style={{
                background: 'none', border: 'none', color: 'var(--color-warning)',
                textDecoration: 'underline', cursor: 'pointer', fontSize: 13,
              }}
            >
              設定画面
            </button>
            でGemini APIキーを設定してください
          </p>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
