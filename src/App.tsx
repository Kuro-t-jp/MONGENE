import { useEffect } from 'react'
import DataSourceView from './components/DataSourceView'
import GeneratorView from './components/GeneratorView'
import QuestionListView from './components/QuestionListView'
import SettingsView from './components/SettingsView'
import { initGASSync } from './lib/gasSync'
import { useAppStore } from './store/appStore'
import type { ViewType } from './types'

const NAV_ITEMS: Array<{ id: ViewType; label: string; icon: string; note: string }> = [
  { id: 'datasource', label: '素材', icon: '📂', note: 'ファイル・本文を入れる' },
  { id: 'generator', label: '問題設計', icon: '⚡', note: '形式と難度を決める' },
  { id: 'questions', label: '結果', icon: '📚', note: '確認・出力する' },
  { id: 'settings', label: '設定', icon: '⚙️', note: 'APIと連携' },
]

function App() {
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const dataSources = useAppStore((s) => s.dataSources)
  const questions = useAppStore((s) => s.questions)
  const passageSets = useAppStore((s) => s.passageSets)
  const settings = useAppStore((s) => s.settings)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const generationConfig = useAppStore((s) => s.generationConfig)

  useEffect(() => {
    initGASSync()
  }, [])

  const selectedCount = dataSources.filter((s) => s.selected).length
  const totalSetQuestions = passageSets.reduce((sum, set) => sum + set.questions.length, 0)
  const totalQuestions = questions.length + totalSetQuestions
  const ready = selectedCount > 0 || generationConfig.curriculumStage !== 'none'

  const renderView = () => {
    switch (activeView) {
      case 'datasource':
        return <DataSourceView />
      case 'generator':
        return <GeneratorView />
      case 'settings':
        return <SettingsView />
      case 'questions':
      default:
        return <QuestionListView />
    }
  }

  return (
    <div style={{ height: '100vh', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          flexShrink: 0,
          borderBottom: '1px solid var(--color-border)',
          background: 'rgba(19,19,42,0.96)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px 24px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <button
              onClick={() => setActiveView('datasource')}
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--color-text)',
                minWidth: 150,
              }}
            >
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 900,
                  letterSpacing: 0,
                  background: 'linear-gradient(135deg, #e2e8f0 0%, #818cf8 55%, #34d399 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                MONGENE
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 1 }}>
                問題生成ワークベンチ
              </div>
            </button>

            <nav style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
              {NAV_ITEMS.map((item, index) => {
                const active = activeView === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: active ? 'rgba(99,102,241,0.16)' : 'var(--color-surface-2)',
                      color: active ? 'var(--color-primary-hover)' : 'var(--color-text-muted)',
                      cursor: 'pointer',
                      padding: '9px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      minWidth: 0,
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 7,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        background: active ? 'rgba(99,102,241,0.2)' : 'var(--color-surface-3)',
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 800 }}>
                        {index + 1}. {item.label}
                      </span>
                      <span style={{ display: 'block', fontSize: 10, color: 'var(--color-text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.note}
                      </span>
                    </span>
                  </button>
                )
              })}
            </nav>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <StatusPill ok={settings.geminiApiKey.length > 0} label={settings.geminiApiKey ? 'APIキー設定済み' : 'APIキー未設定'} />
            <StatusPill ok={ready} label={selectedCount > 0 ? `素材 ${selectedCount}件選択中` : '素材または単元が必要'} />
            <StatusPill ok={totalQuestions > 0} label={`生成済み ${totalQuestions}問`} />
            {isGenerating && <StatusPill ok label="生成中" tone="primary" />}
          </div>
        </div>
      </header>

      <main style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {renderView()}
      </main>
    </div>
  )
}

function StatusPill({ ok, label, tone }: { ok: boolean; label: string; tone?: 'primary' }) {
  const color = tone === 'primary' ? '#a5b4fc' : ok ? '#6ee7b7' : '#fbbf24'
  const bg = tone === 'primary' ? 'rgba(99,102,241,0.13)' : ok ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'
  const border = tone === 'primary' ? 'rgba(99,102,241,0.28)' : ok ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 9px',
        borderRadius: 20,
        border: `1px solid ${border}`,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      <span>{ok ? '●' : '●'}</span>
      {label}
    </span>
  )
}

export default App
