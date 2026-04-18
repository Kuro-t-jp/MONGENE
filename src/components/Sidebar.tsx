import { useAppStore } from '../store/appStore'
import type { ViewType } from '../types'

const NAV_ITEMS: { id: ViewType; label: string; emoji: string }[] = [
  { id: 'datasource', label: 'データソース', emoji: '📂' },
  { id: 'generator',  label: '問題生成',     emoji: '⚡' },
  { id: 'questions',  label: '問題一覧',     emoji: '📋' },
  { id: 'settings',   label: '設定',         emoji: '⚙️' },
]

export default function Sidebar() {
  const activeView      = useAppStore((s) => s.activeView)
  const setActiveView   = useAppStore((s) => s.setActiveView)
  const dataSources     = useAppStore((s) => s.dataSources)
  const questions       = useAppStore((s) => s.questions)
  const isGenerating    = useAppStore((s) => s.isGenerating)

  const badges: Partial<Record<ViewType, number>> = {
    datasource: dataSources.length || undefined,
    questions:  questions.length   || undefined,
  }

  return (
    <aside
      style={{
        width: 196,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-surface-1)',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          MONGENE
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>
          問題生成システム
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV_ITEMS.map((item) => {
          const active = activeView === item.id
          const badge  = badges[item.id]
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 0.15s',
                background: active
                  ? 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)'
                  : 'transparent',
                color: active ? '#fff' : 'var(--color-text-muted)',
                boxShadow: active ? '0 4px 12px rgba(99,102,241,0.25)' : 'none',
              }}
            >
              <span style={{ fontSize: 15 }}>{item.emoji}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
              {badge !== undefined && (
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'monospace',
                    padding: '1px 6px',
                    borderRadius: 20,
                    background: active ? 'rgba(255,255,255,0.2)' : 'var(--color-surface-3)',
                    color: active ? '#fff' : 'var(--color-text-muted)',
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--color-border)',
          fontSize: 11,
          color: 'var(--color-text-dim)',
        }}
      >
        {isGenerating ? (
          <span style={{ color: 'var(--color-primary)' }}>⚡ 生成中...</span>
        ) : (
          'v0.1.0'
        )}
      </div>
    </aside>
  )
}
