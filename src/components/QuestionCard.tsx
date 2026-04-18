import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { QUESTION_TYPE_CONFIGS, EXAM_LEVEL_CONFIGS } from '../types'
import type { Question } from '../types'

interface Props {
  question: Question
  index: number
}

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  multiple_choice_4: { bg: 'rgba(96,165,250,0.1)', text: '#60a5fa', border: 'rgba(96,165,250,0.25)' },
  multiple_choice_5: { bg: 'rgba(167,139,250,0.1)', text: '#a78bfa', border: 'rgba(167,139,250,0.25)' },
  fill_blank:        { bg: 'rgba(74,222,128,0.1)', text: '#4ade80', border: 'rgba(74,222,128,0.25)' },
  short_answer:      { bg: 'rgba(250,204,21,0.1)', text: '#facc15', border: 'rgba(250,204,21,0.25)' },
  essay:             { bg: 'rgba(251,146,60,0.1)', text: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  true_false:        { bg: 'rgba(45,212,191,0.1)', text: '#2dd4bf', border: 'rgba(45,212,191,0.25)' },
  calculation:       { bg: 'rgba(244,114,182,0.1)', text: '#f472b6', border: 'rgba(244,114,182,0.25)' },
}

export default function QuestionCard({ question, index }: Props) {
  const toggleQuestion = useAppStore((s) => s.toggleQuestion)
  const removeQuestion = useAppStore((s) => s.removeQuestion)
  const [expanded, setExpanded] = useState(false)

  const typeConfig  = QUESTION_TYPE_CONFIGS.find((c) => c.id === question.type)
  const levelConfig = EXAM_LEVEL_CONFIGS.find((c) => c.id === question.level)
  const tc = TYPE_COLORS[question.type] ?? { bg: 'rgba(148,163,184,0.1)', text: '#94a3b8', border: 'rgba(148,163,184,0.25)' }

  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${question.checked ? 'var(--color-border-strong)' : 'var(--color-border)'}`,
        background: question.checked ? 'var(--color-surface-2)' : 'var(--color-surface-1)',
        opacity: question.checked ? 1 : 0.65,
        transition: 'all 0.15s',
      }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px' }}>
        {/* Checkbox */}
        <div
          onClick={() => toggleQuestion(question.id)}
          style={{
            width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2, cursor: 'pointer',
            border: `2px solid ${question.checked ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
            background: question.checked ? 'var(--color-primary)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {question.checked && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-dim)' }}>
              問{index + 1}
            </span>
            <span
              style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                color: tc.text, background: tc.bg, border: `1px solid ${tc.border}`,
              }}
            >
              {typeConfig?.emoji} {typeConfig?.label}
            </span>
            <span
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                color: 'var(--color-text-dim)', background: 'var(--color-surface-3)',
                border: '1px solid var(--color-border)',
              }}
            >
              {levelConfig?.emoji} {levelConfig?.label}
            </span>
            {question.subject && (
              <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                · {question.subject}
              </span>
            )}
          </div>

          {/* Question content */}
          <p style={{
            margin: 0, fontSize: 14, lineHeight: 1.65,
            color: 'var(--color-text)',
            display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 3,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {question.content}
          </p>

          {/* Choices preview (collapsed) */}
          {!expanded && question.choices && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {question.choices.slice(0, 2).map((c) => (
                <div
                  key={c.label}
                  style={{
                    display: 'flex', gap: 6, fontSize: 12,
                    color: c.label === question.correctAnswer ? '#34d399' : 'var(--color-text-muted)',
                  }}
                >
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{c.label}.</span>
                  <span>{c.text}</span>
                </div>
              ))}
              {question.choices.length > 2 && (
                <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                  +{question.choices.length - 2}件...
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              padding: '5px 10px', borderRadius: 7, border: '1px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-text-muted)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {expanded ? '閉じる' : '詳細'}
          </button>
          <button
            onClick={() => removeQuestion(question.id)}
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

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            padding: '16px 20px 20px 50px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}
        >
          {/* Full question */}
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>問題文</p>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{question.content}</p>
          </div>

          {/* Choices */}
          {question.choices && (
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>選択肢</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {question.choices.map((c) => (
                  <div
                    key={c.label}
                    style={{
                      display: 'flex', gap: 10, fontSize: 13, padding: '8px 12px', borderRadius: 8,
                      background: c.label === question.correctAnswer
                        ? 'rgba(16,185,129,0.08)' : 'transparent',
                      border: c.label === question.correctAnswer
                        ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
                      color: c.label === question.correctAnswer
                        ? '#34d399' : 'var(--color-text-muted)',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, flexShrink: 0 }}>{c.label}.</span>
                    <span style={{ flex: 1 }}>{c.text}</span>
                    {c.label === question.correctAnswer && <span>✓</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Answer */}
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>正解</p>
            <div
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 14,
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                color: '#34d399',
              }}
            >
              {question.correctAnswer}
            </div>
          </div>

          {/* Explanation */}
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>解説</p>
            <div
              style={{
                padding: '10px 14px', borderRadius: 8, fontSize: 13, lineHeight: 1.7,
                background: 'var(--color-surface-3)', color: 'var(--color-text-muted)',
              }}
            >
              {question.explanation}
            </div>
          </div>

          {/* Tags */}
          {question.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {question.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 20,
                    background: 'var(--color-surface-3)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text-dim)',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
