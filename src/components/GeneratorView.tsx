import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { EXAM_LEVEL_CONFIGS, QUESTION_TYPE_CONFIGS, CURRICULUM_STAGE_CONFIGS, CURRICULUM_SUBJECT_CONFIGS } from '../types'
import type { ExamLevel, QuestionType, CurriculumStage, GenerationConfig } from '../types'
import { generateQuestions, generatePassageSets, generateFigureSets } from '../lib/gemini'
import { TEMPLATES } from '../lib/templates'
import { GENERATION_MODES, inferAutoConfig } from '../lib/autoConfig'

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
  const [showTemplates, setShowTemplates] = useState(false)
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null)

  const selected = dataSources.filter((s) => s.selected)
  const mode = config.generationMode ?? 'individual'
  const selectedText = selected.map((s) => `${s.name}\n${s.content}`).join('\n\n').slice(0, 12000)
  const autoConfig = inferAutoConfig(config, selectedText)
  const autoMode = GENERATION_MODES.find((m) => m.id === autoConfig.generationMode)
  const selectedSubject = CURRICULUM_SUBJECT_CONFIGS.find((s) => s.id === config.subjectArea)
  const selectedCourse = selectedSubject?.courses.find((c) => c.id === config.subjectCourse)
  const selectedUnit = config.subjectUnit

  // ── Template ─────────────────────────────────────────────────────────────
  const applyTemplate = (templateId: string) => {
    const tpl = TEMPLATES.find((t) => t.id === templateId)
    if (!tpl) return
    updateConfig(tpl.config)
    setAppliedTemplate(templateId)
    setShowTemplates(false)
  }

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

  const updateSubjectArea = (subjectArea: string) => {
    const subjectConf = CURRICULUM_SUBJECT_CONFIGS.find((s) => s.id === subjectArea)
    updateConfig({
      subjectArea,
      subjectCourse: '',
      subjectUnit: '',
      subject: subjectConf?.label ?? '',
      curriculumStage: subjectArea === 'rika' ? config.curriculumStage : 'none',
    })
  }

  const updateSubjectCourse = (courseId: string) => {
    const course = selectedSubject?.courses.find((c) => c.id === courseId)
    const label = [selectedSubject?.label, course?.label].filter(Boolean).join(' / ')
    updateConfig({
      subjectCourse: courseId,
      subjectUnit: '',
      subject: label,
    })
  }

  const updateSubjectUnit = (unit: string) => {
    const label = [selectedSubject?.label, selectedCourse?.label, unit].filter(Boolean).join(' / ')
    updateConfig({
      subjectUnit: unit,
      subject: label || unit,
    })
  }

  // ── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async (overrideConfig?: GenerationConfig, label = '問題生成') => {
    const effectiveConfig = overrideConfig ?? config
    const effectiveMode = effectiveConfig.generationMode ?? 'individual'
    setError(null)
    setSuccess(null)

    if (!settings.geminiApiKey) {
      setError('設定画面でGemini APIキーを設定してください。')
      return
    }
    if (selected.length === 0 && effectiveConfig.curriculumStage === 'none') {
      setError('データソースを選択するか、学習指導要領の単元を選択してください。')
      return
    }

    setIsGenerating(true)
    try {
      const srcs = selected.map((s) => ({ name: s.name, content: s.content }))
      if (effectiveMode === 'passage') {
        const sets = await generatePassageSets(
          settings.geminiApiKey, settings.geminiModel, srcs, effectiveConfig, setGenerationProgress
        )
        appendPassageSets(sets)
        const totalQ = sets.reduce((a, s) => a + s.questions.length, 0)
        setSuccess(`${label}: ${sets.length}セット（計${totalQ}問）の長文問題を生成しました！`)
        setQuestionListTab('passage')
      } else if (effectiveMode === 'figure') {
        const sets = await generateFigureSets(
          settings.geminiApiKey, settings.geminiModel, srcs, effectiveConfig, setGenerationProgress
        )
        appendPassageSets(sets)
        const totalQ = sets.reduce((a, s) => a + s.questions.length, 0)
        setSuccess(`${label}: ${sets.length}セット（計${totalQ}問）の図解問題を生成しました！`)
        setQuestionListTab('passage')
      } else {
        const questions = await generateQuestions(
          settings.geminiApiKey, settings.geminiModel, srcs, effectiveConfig, setGenerationProgress
        )
        appendQuestions(questions)
        setSuccess(`${label}: ${questions.length}問の問題を生成しました！`)
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

  const hasCurriculum = config.curriculumStage !== 'none'
  const canGenerate = (selected.length > 0 || hasCurriculum) && !!settings.geminiApiKey && !isGenerating
  const handleAutoGenerate = () => {
    updateConfig(autoConfig)
    void handleGenerate(autoConfig, 'おまかせ生成')
  }

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
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '34px 32px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>問題生成</h2>
          <p style={{ marginTop: 6, color: 'var(--color-text-muted)', fontSize: 14 }}>
            条件を細かく指定しても、素材から自動推定してすぐ作っても大丈夫です。
          </p>
        </div>

        {/* Guided status */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            {
              title: '素材',
              value: selected.length > 0 ? `${selected.length}件選択中` : hasCurriculum ? '単元から生成' : '未選択',
              ok: selected.length > 0 || hasCurriculum,
              note: selected.length > 0 ? `${selected.reduce((a, s) => a + s.content.length, 0).toLocaleString()}文字` : '素材画面または単元を指定',
            },
            {
              title: 'API',
              value: settings.geminiApiKey ? '設定済み' : '未設定',
              ok: !!settings.geminiApiKey,
              note: settings.geminiModel,
            },
            {
              title: '推定形式',
              value: autoMode ? `${autoMode.icon} ${autoMode.label}` : '未判定',
              ok: true,
              note: autoMode?.note ?? '',
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                ...card,
                padding: '16px 18px',
                borderColor: item.ok ? 'var(--color-border-strong)' : 'rgba(245,158,11,0.35)',
                background: item.ok ? 'var(--color-surface-2)' : 'rgba(245,158,11,0.06)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-dim)', marginBottom: 5 }}>{item.title}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: item.ok ? 'var(--color-text)' : '#fbbf24' }}>{item.value}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.note}</div>
            </div>
          ))}
        </div>

        {/* Auto path */}
        <div style={{ ...card, display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center', background: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.25)' }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#6ee7b7' }}>おまかせで確実に作る</p>
            <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              素材の量や「図・実験・本文」などの手がかりから、問題形式・問題数・追加指示を自動で整えて生成します。
            </p>
          </div>
          <button
            onClick={handleAutoGenerate}
            disabled={!canGenerate}
            style={{
              padding: '13px 20px',
              borderRadius: 11,
              border: 'none',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              background: canGenerate ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'var(--color-surface-3)',
              color: canGenerate ? '#fff' : 'var(--color-text-dim)',
              fontSize: 14,
              fontWeight: 900,
              whiteSpace: 'nowrap',
            }}
          >
            ✨ おまかせ生成
          </button>
        </div>

        {/* ── Template Selector ────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                テンプレート
              </p>
              {appliedTemplate && (() => {
                const tpl = TEMPLATES.find((t) => t.id === appliedTemplate)
                return tpl ? (
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--color-text-dim)' }}>
                    {tpl.emoji} {tpl.name} を適用中
                  </p>
                ) : null
              })()}
            </div>
            <button
              onClick={() => setShowTemplates((v) => !v)}
              style={{
                padding: '7px 16px', borderRadius: 20, border: '1px solid var(--color-border)',
                background: showTemplates ? 'rgba(99,102,241,0.14)' : 'var(--color-surface-3)',
                color: showTemplates ? 'var(--color-primary-hover)' : 'var(--color-text-muted)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {showTemplates ? '▲ 閉じる' : '▼ テンプレートから選ぶ'}
            </button>
          </div>

          {showTemplates && (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {TEMPLATES.map((tpl) => {
                const active = appliedTemplate === tpl.id
                return (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl.id)}
                    style={{
                      padding: '14px 16px', borderRadius: 12, border: 'none',
                      cursor: 'pointer', textAlign: 'left', position: 'relative', overflow: 'hidden',
                      background: active ? tpl.accent : 'var(--color-surface-3)',
                      outline: active ? `2px solid #fff` : '1px solid var(--color-border)',
                      outlineOffset: active ? -2 : 0,
                      transition: 'all 0.15s',
                      color: active ? '#fff' : 'var(--color-text)',
                    }}
                  >
                    {!active && (
                      <div
                        style={{
                          position: 'absolute', inset: 0, opacity: 0.07,
                          background: tpl.accent, pointerEvents: 'none',
                        }}
                      />
                    )}
                    <div style={{ fontSize: 20, marginBottom: 5 }}>{tpl.emoji}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{tpl.name}</div>
                    <div style={{ fontSize: 11, opacity: active ? 0.85 : 0.6, lineHeight: 1.5 }}>
                      {tpl.description}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {tpl.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 20,
                            background: active ? 'rgba(255,255,255,0.2)' : 'rgba(99,102,241,0.12)',
                            color: active ? '#fff' : 'var(--color-primary-hover)',
                            fontWeight: 600,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
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
            { id: 'individual', label: '📝 一問一答', desc: '独立した問題を複数生成' },
            { id: 'passage',    label: '📖 長文問題', desc: 'リード文＋複数設問のセット' },
            { id: 'figure',     label: '🔬 図解問題', desc: '図のラベルを参照する設問' },
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
            borderColor: (selected.length > 0 || hasCurriculum) ? 'var(--color-border-strong)' : 'rgba(239,68,68,0.3)',
            background:  (selected.length > 0 || hasCurriculum) ? 'var(--color-surface-2)'     : 'rgba(239,68,68,0.05)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}
        >
          <span style={{ fontSize: 22 }}>{selected.length > 0 ? '✅' : hasCurriculum ? '📚' : '⚠️'}</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              {selected.length > 0
                ? `${selected.length}件のデータソースが選択されています`
                : hasCurriculum
                  ? '学習指導要領の単元から生成します'
                  : 'データソースが選択されていません'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
              {selected.length > 0
                ? `合計 ${selected.reduce((a, s) => a + s.content.length, 0).toLocaleString()} 文字`
                : hasCurriculum
                  ? 'データソースなしでも単元に基づいて問題を生成できます'
                  : 'データソース画面でファイルを追加するか、学習指導要領を選択してください'}
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

        {/* ── Subject & Unit ──────────────────────────────────────────────── */}
        <div style={card}>
          <p style={sectionTitle}>
            学習指導要領の教科・科目
            <span style={subNote}>（教科 → 科目 → 内容候補の順に選択）</span>
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {CURRICULUM_SUBJECT_CONFIGS.map((subject) => {
              const active = config.subjectArea === subject.id
              return (
                <button
                  key={subject.id}
                  onClick={() => updateSubjectArea(subject.id)}
                  title={subject.description}
                  style={{
                    padding: '11px 12px',
                    borderRadius: 10,
                    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: active ? 'rgba(99,102,241,0.14)' : 'var(--color-surface-3)',
                    color: active ? 'var(--color-primary-hover)' : 'var(--color-text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{subject.emoji}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>{subject.label}</span>
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--color-text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {subject.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          {selectedSubject && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                {selectedSubject.emoji} {selectedSubject.label} の科目
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
                {selectedSubject.courses.map((course) => {
                  const active = config.subjectCourse === course.id
                  return (
                    <button
                      key={course.id}
                      onClick={() => updateSubjectCourse(course.id)}
                      style={{
                        padding: '9px 11px',
                        borderRadius: 10,
                        border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: active ? 'rgba(99,102,241,0.14)' : 'var(--color-surface-3)',
                        color: active ? 'var(--color-primary-hover)' : 'var(--color-text-muted)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: active ? 800 : 600,
                        textAlign: 'left',
                      }}
                    >
                      {course.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {selectedCourse && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                {selectedCourse.label} の内容候補
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedCourse.units.map((unit) => {
                  const active = selectedUnit === unit
                  return (
                    <button
                      key={unit}
                      onClick={() => updateSubjectUnit(unit)}
                      style={{
                        padding: '6px 11px',
                        borderRadius: 16,
                        border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: active ? 'rgba(99,102,241,0.14)' : 'var(--color-surface-3)',
                        color: active ? 'var(--color-primary-hover)' : 'var(--color-text-muted)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: active ? 800 : 600,
                      }}
                    >
                      {unit}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <label style={{ ...sectionTitle, display: 'block', marginBottom: 7 }}>
              詳細テーマ<span style={subNote}>（任意。例：苦手範囲や章名）</span>
            </label>
            <input
              type="text"
              placeholder="例：DNAの複製、三角関数の最大最小、江戸時代の文化"
              value={config.subject}
              onChange={(e) => updateConfig({ subject: e.target.value })}
              style={input}
            />
          </div>
        </div>

        {/* ── Curriculum Stage ─────────────────────────────────────────────── */}
        <div style={card}>
          <p style={sectionTitle}>
            学習指導要領<span style={subNote}>（任意）令和3年度告示準拠</span>
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {CURRICULUM_STAGE_CONFIGS.map((s) => {
              const active = (config.curriculumStage ?? 'none') === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => updateConfig({ curriculumStage: s.id as CurriculumStage })}
                  style={{
                    padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
                    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: active ? 'rgba(99,102,241,0.14)' : 'var(--color-surface-3)',
                    color: active ? 'var(--color-primary-hover)' : 'var(--color-text-muted)',
                    fontSize: 13, fontWeight: active ? 700 : 400, transition: 'all 0.15s',
                  }}
                >
                  {s.emoji ? `${s.emoji} ` : ''}{s.label}
                </button>
              )
            })}
          </div>
          {(config.curriculumStage ?? 'none') !== 'none' && (() => {
            const stageConf = CURRICULUM_STAGE_CONFIGS.find((s) => s.id === config.curriculumStage)
            if (!stageConf || stageConf.chapters.length === 0) return null
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 11, color: 'var(--color-text-dim)', margin: 0 }}>
                  小単元をクリックすると「教科・単元」と詳細テーマに反映されます
                </p>
                {stageConf.chapters.map((ch) => (
                  <div key={ch.chapter}>
                    <p style={{
                      margin: '0 0 5px',
                      fontSize: 11, fontWeight: 700,
                      color: 'var(--color-text-muted)',
                      letterSpacing: '0.02em',
                    }}>
                      {ch.chapter}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {ch.units.map((unit) => (
                        <button
                          key={unit}
                          onClick={() => updateConfig({ subjectArea: 'rika', subjectCourse: config.curriculumStage === 'high_biology_basic' ? 'biology_basic' : 'biology', subjectUnit: unit, subject: `理科 / ${config.curriculumStage === 'high_biology_basic' ? '生物基礎' : '生物'} / ${unit}` })}
                          style={{
                            padding: '3px 10px', borderRadius: 12, cursor: 'pointer', fontSize: 11,
                            border: `1px solid ${config.subject === unit ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            background: config.subject === unit ? 'rgba(99,102,241,0.14)' : 'var(--color-surface-3)',
                            color: config.subject === unit ? 'var(--color-primary-hover)' : 'var(--color-text-muted)',
                            transition: 'all 0.1s',
                          }}
                        >{unit}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* ── Count & Subject ──────────────────────────────────────────────── */}
        <div style={{ ...card, display: 'grid', gridTemplateColumns: mode === 'individual' ? '1fr' : '1fr', gap: 20 }}>
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
                  {mode === 'figure' ? '図解セット数' : '長文セット数'}：
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
          onClick={() => handleGenerate()}
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
