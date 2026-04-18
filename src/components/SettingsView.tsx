import { useState } from 'react'
import { useAppStore } from '../store/appStore'

const MODELS = [
  { id: 'gemini-3.1-flash-lite-preview',  label: 'Gemini 3.1 Flash-Lite', note: '推奨 · 最速・低コスト' },
  { id: 'gemini-2.5-flash-preview-04-17', label: 'Gemini 2.5 Flash', note: '高精度' },
  { id: 'gemini-2.5-flash-lite',           label: 'Gemini 2.5 Flash-Lite', note: '節約モード' },
  { id: 'gemini-1.5-pro',                  label: 'Gemini 1.5 Pro', note: '最高精度' },
]

export default function SettingsView() {
  const settings       = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)

  const [showKey, setShowKey] = useState(false)
  const [saved,   setSaved]   = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const card: React.CSSProperties = {
    padding: '24px 28px', borderRadius: 16,
    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
  }
  const label: React.CSSProperties = {
    display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--color-text)',
  }
  const input: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-3)', color: 'var(--color-text)',
    fontSize: 14, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>設定</h2>
          <p style={{ marginTop: 6, color: 'var(--color-text-muted)', fontSize: 14 }}>
            APIキーとAIモデルを設定します。
          </p>
        </div>

        {/* API Key */}
        <div style={card}>
          <label style={label}>🔑 Gemini API キー</label>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Google AI Studio（
            <code
              style={{
                color: 'var(--color-primary)', background: 'rgba(99,102,241,0.1)',
                padding: '1px 6px', borderRadius: 4, fontSize: 12,
              }}
            >
              aistudio.google.com
            </code>
            ）でAPIキーを取得してください。
          </p>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="AIzaSy..."
              value={settings.geminiApiKey}
              onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
              style={{ ...input, paddingRight: 70 }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)',
                background: 'var(--color-surface-3)', color: 'var(--color-text-muted)',
                fontSize: 11, cursor: 'pointer',
              }}
            >
              {showKey ? '隠す' : '表示'}
            </button>
          </div>
          {settings.geminiApiKey && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#34d399' }}>
              ✓ APIキーが設定されています
            </p>
          )}
        </div>

        {/* Model */}
        <div style={card}>
          <label style={label}>🤖 AIモデル</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MODELS.map((model) => {
              const active = settings.geminiModel === model.id
              return (
                <label
                  key={model.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px', borderRadius: 12, cursor: 'pointer',
                    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: active ? 'rgba(99,102,241,0.1)' : 'var(--color-surface-3)',
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="radio"
                    name="model"
                    value={model.id}
                    checked={active}
                    onChange={() => updateSettings({ geminiModel: model.id })}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <div>
                    <p
                      style={{
                        margin: 0, fontSize: 14, fontWeight: 600,
                        color: active ? 'var(--color-primary-hover)' : 'var(--color-text)',
                      }}
                    >
                      {model.label}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-dim)' }}>
                      {model.id} · {model.note}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Google 連携 */}
        <div style={card}>
          <label style={label}>🔗 Google Client ID</label>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--color-text-dim)', lineHeight: 1.6 }}>
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>Google Cloud Console</a> でプロジェクトを作成 → <strong>「認証情報」→「OAuthクライアントID」→「デスクトップアプリ」</strong> を選択して取得してください。<br />
            また <strong>「APIとサービス」→「有効なAPIとサービス」</strong> から <strong>Google Forms API</strong> を有効にしてください。
          </p>
          <input
            type="text"
            placeholder="xxxxx.apps.googleusercontent.com"
            value={settings.googleClientId}
            onChange={(e) => updateSettings({ googleClientId: e.target.value })}
            style={input}
          />
          <label style={{ ...label, marginTop: 14 }}>🔒 Google Client Secret（任意）</label>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--color-text-dim)' }}>
            デスクトップアプリ型では通常不要ですが、エラーが出る場合は入力してください。
          </p>
          <input
            type="password"
            placeholder="GOCSPX-..."
            value={settings.googleClientSecret}
            onChange={(e) => updateSettings({ googleClientSecret: e.target.value })}
            style={input}
          />
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          style={{
            width: '100%', padding: '14px 24px', borderRadius: 12, border: 'none',
            background: saved
              ? 'rgba(16,185,129,0.15)'
              : 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
            color: saved ? '#34d399' : '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            outline: saved ? '1px solid rgba(16,185,129,0.3)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          {saved ? '✓ 保存しました' : '設定を保存'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-dim)' }}>
          APIキーはブラウザのローカルストレージに暗号化なしで保存されます。
        </p>
      </div>
    </div>
  )
}
