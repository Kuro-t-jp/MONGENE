import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { QUESTION_TYPE_CONFIGS, EXAM_LEVEL_CONFIGS } from '../types'
import type { PassageSet, SubQuestion } from '../types'

interface Props {
  passageSet: PassageSet
  index: number
}

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  multiple_choice_4: { bg: 'rgba(96,165,250,0.1)',   text: '#60a5fa', border: 'rgba(96,165,250,0.25)' },
  multiple_choice_5: { bg: 'rgba(167,139,250,0.1)',  text: '#a78bfa', border: 'rgba(167,139,250,0.25)' },
  fill_blank:        { bg: 'rgba(74,222,128,0.1)',   text: '#4ade80', border: 'rgba(74,222,128,0.25)' },
  short_answer:      { bg: 'rgba(250,204,21,0.1)',   text: '#facc15', border: 'rgba(250,204,21,0.25)' },
  essay:             { bg: 'rgba(251,146,60,0.1)',   text: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  true_false:        { bg: 'rgba(45,212,191,0.1)',   text: '#2dd4bf', border: 'rgba(45,212,191,0.25)' },
  calculation:       { bg: 'rgba(244,114,182,0.1)',  text: '#f472b6', border: 'rgba(244,114,182,0.25)' },
}

function SubQuestionItem({ q, num, isFigure }: { q: SubQuestion; num: number; isFigure: boolean }) {
  const [open, setOpen] = useState(false)
  const typeConfig = QUESTION_TYPE_CONFIGS.find((c) => c.id === q.type)
  const tc = TYPE_COLORS[q.type] ?? { bg: 'rgba(148,163,184,0.1)', text: '#94a3b8', border: 'rgba(148,163,184,0.25)' }

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${isFigure ? 'rgba(99,102,241,0.2)' : 'var(--color-border)'}`,
        background: 'var(--color-surface-1)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 14px', cursor: 'pointer',
        }}
        onClick={() => setOpen(!open)}
      >
        {/* Question number badge */}
        <span
          style={{
            flexShrink: 0, width: 26, height: 26, borderRadius: isFigure ? '50%' : 6,
            background: isFigure ? 'rgba(99,102,241,0.15)' : 'var(--color-surface-3)',
            border: isFigure ? '1px solid rgba(99,102,241,0.3)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
            color: isFigure ? '#818cf8' : 'var(--color-text-muted)',
            marginTop: 1,
          }}
        >
          {isFigure ? `(${num})` : num}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
                color: tc.text, background: tc.bg, border: `1px solid ${tc.border}`,
              }}
            >
              {typeConfig?.emoji} {typeConfig?.label}
            </span>
          </div>
          <p
            style={{
              margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-text)',
              display: '-webkit-box', WebkitLineClamp: open ? 'unset' : 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}
          >
            {q.content}
          </p>
        </div>
        <span style={{ fontSize: 11, color: 'var(--color-text-dim)', flexShrink: 0, marginTop: 2 }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {open && (
        <div
          style={{
            borderTop: `1px solid ${isFigure ? 'rgba(99,102,241,0.15)' : 'var(--color-border)'}`,
            padding: '12px 14px 14px 50px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{q.content}</p>

          {q.choices && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {q.choices.map((c) => (
                <div
                  key={c.label}
                  style={{
                    display: 'flex', gap: 8, fontSize: 12, padding: '7px 10px', borderRadius: 7,
                    background: c.label === q.correctAnswer ? 'rgba(16,185,129,0.08)' : 'var(--color-surface-3)',
                    border: c.label === q.correctAnswer ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
                    color: c.label === q.correctAnswer ? '#34d399' : 'var(--color-text-muted)',
                  }}
                >
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, flexShrink: 0 }}>{c.label}.</span>
                  <span style={{ flex: 1 }}>{c.text}</span>
                  {c.label === q.correctAnswer && <span>✓</span>}
                </div>
              ))}
            </div>
          )}

          <div>
            <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>正解</p>
            <div
              style={{
                padding: '6px 12px', borderRadius: 7, fontSize: 13,
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                color: '#34d399',
              }}
            >
              {q.correctAnswer}
            </div>
          </div>

          {q.explanation && (
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>解説</p>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap' }}>
                {q.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 図解問題の図説明ブロック ────────────────────────────────────────────────
function FigureBlock({ passage, figureType }: { passage: string; figureType?: string }) {
  const [open, setOpen] = useState(true)

  // ラベル (a)(b)... や ①②... を強調表示
  const highlighted = passage.replace(
    /(\([a-z]\)|\([A-Z]\)|①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)/g,
    (m) => `<mark style="background:rgba(99,102,241,0.18);color:#a5b4fc;border-radius:3px;padding:0 2px;font-weight:700;">${m}</mark>`
  )

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid rgba(99,102,241,0.3)',
        background: 'rgba(99,102,241,0.04)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 16 }}>🔬</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', flex: 1, textAlign: 'left' }}>
          図の説明文
          {figureType && (
            <span
              style={{
                marginLeft: 8, fontSize: 10, fontWeight: 600,
                padding: '1px 8px', borderRadius: 20,
                background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
                border: '1px solid rgba(99,102,241,0.25)',
              }}
            >
              {figureType}
            </span>
          )}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
          {passage.length}字　{open ? '▲ 閉じる' : '▼ 開く'}
        </span>
      </button>
      {open && (
        <div
          style={{
            borderTop: '1px solid rgba(99,102,241,0.2)',
            padding: '14px 16px',
          }}
        >
          {/* 試験風のボックス */}
          <div
            style={{
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: 8,
              padding: '14px 16px',
              background: 'var(--color-surface-1)',
              fontSize: 13, lineHeight: 1.9, color: 'var(--color-text)',
              whiteSpace: 'pre-wrap', maxHeight: 420, overflowY: 'auto',
              fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
            }}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
          <p style={{ margin: '8px 0 0', fontSize: 10, color: 'var(--color-text-dim)' }}>
            ※ カラーハイライトは図中ラベル（(a)(b)… / ①②…）を示します
          </p>
        </div>
      )}
    </div>
  )
}

export default function PassageCard({ passageSet, index }: Props) {
  const togglePassageSet = useAppStore((s) => s.togglePassageSet)
  const removePassageSet = useAppStore((s) => s.removePassageSet)
  const [passageOpen, setPassageOpen] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const isFigure = passageSet.questionMode === 'figure'
  const levelConfig = EXAM_LEVEL_CONFIGS.find((c) => c.id === passageSet.level)

  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${passageSet.checked
          ? (isFigure ? 'rgba(99,102,241,0.5)' : 'var(--color-border-strong)')
          : (isFigure ? 'rgba(99,102,241,0.25)' : 'var(--color-border)')}`,
        background: passageSet.checked ? 'var(--color-surface-2)' : 'var(--color-surface-1)',
        opacity: passageSet.checked ? 1 : 0.7,
        transition: 'all 0.15s',
      }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px' }}>
        <div
          onClick={() => togglePassageSet(passageSet.id)}
          style={{
            width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 3, cursor: 'pointer',
            border: `2px solid ${passageSet.checked ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
            background: passageSet.checked ? 'var(--color-primary)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {passageSet.checked && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-dim)' }}>
              第{index + 1}問
            </span>
            {isFigure ? (
              <span
                style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  color: '#a5b4fc', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                }}
              >
                🔬 図解問題
              </span>
            ) : (
              <span
                style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  color: '#818cf8', background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.25)',
                }}
              >
                📖 長文読解
              </span>
            )}
            <span
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                color: 'var(--color-text-dim)', background: 'var(--color-surface-3)',
                border: '1px solid var(--color-border)',
              }}
            >
              {levelConfig?.emoji} {levelConfig?.label}
            </span>
            {passageSet.subject && (
              <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>· {passageSet.subject}</span>
            )}
            <span
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                color: 'var(--color-text-dim)', background: 'var(--color-surface-3)',
                border: '1px solid var(--color-border)',
              }}
            >
              設問 {passageSet.questions.length}問
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
            {isFigure && (
              <span style={{ marginRight: 6, color: '#818cf8' }}>
                例題{index + 1}
              </span>
            )}
            {passageSet.title}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              padding: '5px 10px', borderRadius: 7, border: '1px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-text-muted)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {expanded ? '折りたたむ' : '展開'}
          </button>
          <button
            onClick={() => removePassageSet(passageSet.id)}
            style={{
              padding: 6, borderRadius: 7, border: 'none', background: 'transparent',
              color: 'var(--color-text-dim)', cursor: 'pointer', fontSize: 14,
            }}
            title="削除"
          >
            ✕
          </button>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${isFigure ? 'rgba(99,102,241,0.15)' : 'var(--color-border)'}`,
            padding: '16px 20px 20px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}
        >
          {/* 図解モード: 専用の図説明ブロック / 長文モード: 折りたたみ式本文 */}
          {isFigure ? (
            <FigureBlock passage={passageSet.passage} figureType={passageSet.figureType} />
          ) : (
            <div
              style={{
                borderRadius: 10,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-3)',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setPassageOpen(!passageOpen)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
                  color: 'var(--color-text)',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700 }}>📄 本文（リード文）</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                  {passageSet.passage.length}字　{passageOpen ? '▲ 閉じる' : '▼ 開く'}
                </span>
              </button>
              {passageOpen && (
                <div
                  style={{
                    borderTop: '1px solid var(--color-border)',
                    padding: '12px 14px',
                    fontSize: 13, lineHeight: 1.8, color: 'var(--color-text)',
                    whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto',
                  }}
                >
                  {passageSet.passage}
                </div>
              )}
            </div>
          )}

          {/* 設問一覧 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{
              margin: 0, fontSize: 12, fontWeight: 700,
              color: isFigure ? '#818cf8' : 'var(--color-text-dim)',
            }}>
              {isFigure ? '問' : '設問一覧'}
            </p>
            {passageSet.questions.map((q) => (
              <SubQuestionItem key={q.id} q={q} num={q.questionNumber} isFigure={isFigure} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
