import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../store/appStore'
import { QUESTION_TYPE_CONFIGS, EXAM_LEVEL_CONFIGS } from '../types'
import type { QuestionType, ExamLevel } from '../types'
import QuestionCard from './QuestionCard'
import PassageCard from './PassageCard'
import { exportToMarkdown, exportToJSON, exportToText, exportToDocx, exportPassagesToDocx, downloadFile } from '../lib/exporters'
import { startGoogleAuth, createGoogleFormFromQuestions, isTokenValid } from '../lib/googleForms'
import { openUrl } from '@tauri-apps/plugin-opener'

export default function QuestionListView() {
  const questions       = useAppStore((s) => s.questions)
  const clearQuestions  = useAppStore((s) => s.clearQuestions)
  const toggleQuestion  = useAppStore((s) => s.toggleQuestion)
  const passageSets     = useAppStore((s) => s.passageSets)
  const clearPassageSets = useAppStore((s) => s.clearPassageSets)
  const togglePassageSet = useAppStore((s) => s.togglePassageSet)
  const tab             = useAppStore((s) => s.questionListTab)
  const setTab          = useAppStore((s) => s.setQuestionListTab)
  const settings        = useAppStore((s) => s.settings)
  const googleAuth      = useAppStore((s) => s.googleAuth)
  const setGoogleAuth   = useAppStore((s) => s.setGoogleAuth)

  const [filterType,  setFilterType]  = useState<QuestionType | 'all'>('all')
  const [filterLevel, setFilterLevel] = useState<ExamLevel | 'all'>('all')
  const [gFormLoading, setGFormLoading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; onOk: () => void } | null>(null)

  const showConfirm = (message: string, onOk: () => void) => setConfirm({ message, onOk })

  const filtered = questions.filter((q) => {
    if (filterType  !== 'all' && q.type  !== filterType)  return false
    if (filterLevel !== 'all' && q.level !== filterLevel) return false
    return true
  })

  const checked      = filtered.filter((q) => q.checked)
  const exportTarget = checked.length > 0 ? checked : filtered
  const allChecked   = filtered.length > 0 && filtered.every((q) => q.checked)

  const checkedPassages = passageSets.filter((p) => p.checked)
  const allPassagesChecked = passageSets.length > 0 && passageSets.every((p) => p.checked)
  const figureCount = passageSets.filter((p) => p.questionMode === 'figure').length
  const passageCount = passageSets.length - figureCount

  const handleSelectAll = () => {
    filtered.forEach((q) => {
      if (allChecked ? q.checked : !q.checked) toggleQuestion(q.id)
    })
  }

  const handleSelectAllPassages = () => {
    passageSets.forEach((p) => {
      if (allPassagesChecked ? p.checked : !p.checked) togglePassageSet(p.id)
    })
  }

  const handleExport = async (fmt: 'md' | 'json' | 'txt' | 'docx') => {
    setExportError(null)
    const date = new Date().toISOString().split('T')[0]
    try {
      switch (fmt) {
        case 'md':   downloadFile(exportToMarkdown(exportTarget),   `mongene_${date}.md`,   'text/markdown'); break
        case 'json': downloadFile(exportToJSON(exportTarget),        `mongene_${date}.json`, 'application/json'); break
        case 'txt':  downloadFile(exportToText(exportTarget),        `mongene_${date}.txt`,  'text/plain'); break
        case 'docx': {
          const blob = await exportToDocx(exportTarget)
          const arr = Array.from(new Uint8Array(await blob.arrayBuffer()))
          const savedPath = await invoke<string>('save_bytes_to_downloads', { filename: `mongene_${date}.docx`, data: arr })
          setExportError(`✅ 保存しました: ${savedPath}`)
          break
        }
      }
    } catch (err) {
      setExportError(`❌ エクスポートに失敗しました: ${String(err)}`)
    }
  }

  const handleExportPassagesDocx = async () => {
    setExportError(null)
    const date = new Date().toISOString().split('T')[0]
    try {
      const target = checkedPassages.length > 0 ? checkedPassages : passageSets
      const blob = await exportPassagesToDocx(target)
      const arr = Array.from(new Uint8Array(await blob.arrayBuffer()))
      const savedPath = await invoke<string>('save_bytes_to_downloads', { filename: `mongene_passage_${date}.docx`, data: arr })
      setExportError(`✅ 保存しました: ${savedPath}`)
    } catch (err) {
      setExportError(`Word エクスポートに失敗しました: ${String(err)}`)
    }
  }

  const handleCreateGoogleForm = async () => {
    if (!settings.googleClientId) {
      alert('設定画面でGoogle Client IDを入力してください。')
      return
    }
    if (exportTarget.length === 0) {
      alert('エクスポートする問題がありません。')
      return
    }
    setGFormLoading(true)
    try {
      let auth = isTokenValid(googleAuth) ? googleAuth! : null
      if (!auth) {
        auth = await startGoogleAuth(settings.googleClientId, settings.googleClientSecret)
        setGoogleAuth(auth)
      }
      const date = new Date().toLocaleString('ja-JP')
      const title = `問題集 (${date})`
      const result = await createGoogleFormFromQuestions(auth.accessToken, title, exportTarget)

      // ローカルにJSONファイルとして保存
      const baseJson = JSON.parse(exportToJSON(exportTarget)) as Record<string, unknown>
      baseJson.googleFormTitle = title
      baseJson.googleFormUrl = result.url
      baseJson.googleFormId = result.formId
      baseJson.addedToForm = result.addedCount
      const safeDate = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `mongene_gform_${safeDate}.json`
      const jsonStr = JSON.stringify(baseJson, null, 2)
      const encoder = new TextEncoder()
      const bytes = Array.from(encoder.encode(jsonStr))
      try {
        const savedPath = await invoke<string>('save_bytes_to_downloads', { filename, data: bytes })
        setExportError(`✅ フォーム作成完了 (${result.addedCount}問) / JSON: ${savedPath}`)
      } catch (saveErr) {
        setExportError(`✅ フォーム完了 (${result.addedCount}問) / ⚠️ JSON保存失敗: ${String(saveErr)}`)
      }

      await openUrl(result.url)
    } catch (err) {
      const msg = String(err)
      if (msg.includes('401') || msg.includes('invalid_token')) {
        setGoogleAuth(null)
        setExportError('⚠️ 認証が失効しました。もう一度お試しください。')
      } else {
        setExportError(`❌ エラー: ${msg}`)
      }
    } finally {
      setGFormLoading(false)
    }
  }

  const btnStyle: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
    background: 'var(--color-surface-3)', color: 'var(--color-text-muted)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const,
  }

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)',
    background: 'var(--color-surface-3)', color: 'var(--color-text-muted)',
    fontSize: 12, outline: 'none', cursor: 'pointer',
  }

  if (questions.length === 0 && passageSets.length === 0) {
    return (
      <div
        style={{
          height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-dim)',
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
        <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-text-muted)', margin: 0 }}>
          まだ問題がありません
        </p>
        <p style={{ fontSize: 13, marginTop: 6, color: 'var(--color-text-dim)' }}>
          左側のデータソースと生成設定から問題を生成してください。
        </p>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border)', background: 'var(--color-surface-1)', padding: '0 20px' }}>
        <button
          onClick={() => setTab('individual')}
          style={{
            padding: '10px 20px', fontSize: 13, fontWeight: tab === 'individual' ? 700 : 400,
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: tab === 'individual' ? '2px solid var(--color-accent)' : '2px solid transparent',
            color: tab === 'individual' ? 'var(--color-accent)' : 'var(--color-text-muted)',
            marginBottom: -2,
          }}
        >
          📝 一問一答 ({questions.length})
        </button>
        <button
          onClick={() => setTab('passage')}
          style={{
            padding: '10px 20px', fontSize: 13, fontWeight: tab === 'passage' ? 700 : 400,
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: tab === 'passage' ? '2px solid var(--color-accent)' : '2px solid transparent',
            color: tab === 'passage' ? 'var(--color-accent)' : 'var(--color-text-muted)',
            marginBottom: -2,
          }}
        >
          📚 セット問題 ({passageSets.length})
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ flexShrink: 0, padding: '14px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tab === 'individual' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 auto' }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>問題一覧</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 10 }}>
                  全{questions.length}問
                  {checked.length > 0 && ` · ${checked.length}問選択中`}
                </span>
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={handleSelectAll} style={btnStyle}>
                {allChecked ? '全解除' : '全選択'}
              </button>
              <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>エクスポート:</span>
              <button onClick={() => handleExport('md')}    style={btnStyle}>📄 Markdown</button>
              <button onClick={() => handleExport('json')}  style={btnStyle}>{'{ }'} JSON</button>
              <button onClick={() => handleExport('txt')}   style={btnStyle}>📝 テキスト</button>
              <button onClick={() => handleExport('docx')}  style={btnStyle}>📘 Word</button>
              <button
                onClick={handleCreateGoogleForm}
                disabled={gFormLoading}
                style={{ ...btnStyle, opacity: gFormLoading ? 0.6 : 1 }}
              >
                {gFormLoading ? '⏳ 作成中…' : '📋 Googleフォーム作成'}
              </button>
              <button
                onClick={() => showConfirm('全ての問題を削除しますか？', clearQuestions)}
                style={{ ...btnStyle, color: 'var(--color-error)', borderColor: 'rgba(239,68,68,0.3)' }}
              >
                🗑 クリア
              </button>
            </div>
            {exportError && (
              <div style={{ padding: '8px 14px', borderRadius: 8,
                background: exportError.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${exportError.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: exportError.startsWith('✅') ? '#4ade80' : '#f87171', fontSize: 13 }}>
                {exportError}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as QuestionType | 'all')}
                style={selectStyle}
              >
                <option value="all">すべての形式</option>
                {QUESTION_TYPE_CONFIGS.map((t) => (
                  <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>
                ))}
              </select>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value as ExamLevel | 'all')}
                style={selectStyle}
              >
                <option value="all">すべてのレベル</option>
                {EXAM_LEVEL_CONFIGS.map((l) => (
                  <option key={l.id} value={l.id}>{l.emoji} {l.label}</option>
                ))}
              </select>
              <span style={{ fontSize: 12, color: 'var(--color-text-dim)', marginLeft: 'auto' }}>
                {filtered.length}件表示
                {checked.length > 0 && `（${checked.length}件選択中をエクスポート）`}
              </span>
            </div>
          </>
        ) : (
          <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 auto' }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>セット問題一覧</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 10 }}>
                全{passageSets.length}セット
                {passageCount > 0 && ` · 長文${passageCount}`}
                {figureCount > 0 && ` · 図解${figureCount}`}
                {checkedPassages.length > 0 && ` · ${checkedPassages.length}件選択中`}
              </span>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={handleSelectAllPassages} style={btnStyle}>
              {allPassagesChecked ? '全解除' : '全選択'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>エクスポート:</span>
            <button onClick={handleExportPassagesDocx} style={btnStyle}>📘 Word</button>
            <button
              onClick={() => showConfirm('全てのセット問題を削除しますか？', clearPassageSets)}
              style={{ ...btnStyle, color: 'var(--color-error)', borderColor: 'rgba(239,68,68,0.3)' }}
            >
              🗑 クリア
            </button>
          </div>
          {exportError && (
            <div style={{ padding: '8px 14px', borderRadius: 8,
              background: exportError.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${exportError.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: exportError.startsWith('✅') ? '#4ade80' : '#f87171', fontSize: 13 }}>
              {exportError}
            </div>
          )}
          </>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tab === 'individual' ? (
          filtered.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--color-text-dim)', fontSize: 14 }}>
              フィルター条件に一致する問題がありません
            </div>
          ) : (
            filtered.map((q, i) => (
              <QuestionCard key={q.id} question={q} index={i} />
            ))
          )
        ) : (
          passageSets.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--color-text-dim)', fontSize: 14 }}>
              セット問題がまだありません。左側の生成設定で「長文」または「図解」を選択してください。
            </div>
          ) : (
            passageSets.map((ps, i) => (
              <PassageCard key={ps.id} passageSet={ps} index={i} />
            ))
          )
        )}
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div
          onClick={() => setConfirm(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-surface-2)', borderRadius: 16,
              padding: '28px 32px', minWidth: 320, maxWidth: 420,
              border: '1px solid var(--color-border)',
              display: 'flex', flexDirection: 'column', gap: 20,
            }}
          >
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
              {confirm.message}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirm(null)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', fontSize: 13, cursor: 'pointer' }}
              >
                キャンセル
              </button>
              <button
                onClick={() => { confirm.onOk(); setConfirm(null) }}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.85)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
