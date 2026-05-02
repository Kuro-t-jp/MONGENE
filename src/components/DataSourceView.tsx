import { useRef, useState, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useAppStore } from '../store/appStore'
import { parseFile, detectFileType } from '../lib/parsers'
import { extractTextFromImage } from '../lib/gemini'
import type { DataSource, DataSourceType } from '../types'
import {
  listSources,
  fetchSourceAsText,
  getSourceImages,
  imageUrlToBase64,
} from '../lib/seibuturagClient'
import type { SeibuturagSource } from '../lib/seibuturagClient'

const ACCEPTED = '.pdf,.docx,.doc,.md,.markdown,.txt,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.bmp,.tiff'

const TYPE_META: Record<DataSourceType, { label: string; color: string; emoji: string }> = {
  pdf:      { label: 'PDF',    color: '#f87171', emoji: '📄' },
  word:     { label: 'Word',   color: '#60a5fa', emoji: '📝' },
  markdown: { label: 'MD',     color: '#4ade80', emoji: '📋' },
  text:     { label: 'TXT',    color: '#facc15', emoji: '📃' },
  paste:    { label: 'テキスト', color: '#22d3ee', emoji: '✂️' },
  image:    { label: 'IMAGE',  color: '#e879f9', emoji: '🖼️' },
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DataSourceView() {
  const dataSources      = useAppStore((s) => s.dataSources)
  const addDataSource    = useAppStore((s) => s.addDataSource)
  const removeDataSource = useAppStore((s) => s.removeDataSource)
  const toggleDataSource = useAppStore((s) => s.toggleDataSource)
  const settings         = useAppStore((s) => s.settings)
  const setActiveView    = useAppStore((s) => s.setActiveView)
  const urlHistory       = useAppStore((s) => s.urlHistory)
  const addUrlHistory    = useAppStore((s) => s.addUrlHistory)
  const clearUrlHistory  = useAppStore((s) => s.clearUrlHistory)

  const [isDragging,  setIsDragging]  = useState(false)
  const [, setDragCounter] = useState(0) // 子要素経由のleaveを無視するカウンター
  const [loading,     setLoading]     = useState(false)
  const [loadingName, setLoadingName] = useState('')
  const [error,       setError]       = useState<string | null>(null)

  const [showPaste,  setShowPaste]  = useState(false)
  const [pasteText,  setPasteText]  = useState('')
  const [pasteName,  setPasteName]  = useState('')

  const [showUrl,    setShowUrl]    = useState(false)
  const [urlInput,   setUrlInput]   = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlMsg,     setUrlMsg]     = useState<string | null>(null)

  // ── SEIBUTURAG ──────────────────────────────────────────────────────────
  const [showRag,          setShowRag]          = useState(false)
  const [ragSources,       setRagSources]       = useState<SeibuturagSource[]>([])
  const [ragLoading,       setRagLoading]       = useState(false)
  const [ragImporting,     setRagImporting]     = useState(false)
  const [ragMsg,           setRagMsg]           = useState<string | null>(null)
  const [ragChecked,       setRagChecked]       = useState<Set<string>>(new Set())
  const [ragQuery,         setRagQuery]         = useState('')
  const [ragImportImages,  setRagImportImages]  = useState(false)

  const ragBaseUrl = settings.seibuturagBaseUrl || 'http://localhost:3001'

  const handleRagConnect = async () => {
    setRagLoading(true)
    setRagMsg(null)
    try {
      const sources = await listSources(ragBaseUrl)
      setRagSources(sources.filter((s) => (s.chunkCount ?? 0) > 0))
      setRagMsg(sources.length === 0 ? '⚠️ ソースが見つかりません' : null)
    } catch (err) {
      setRagMsg(`❌ 接続失敗: ${String(err)}`)
    } finally {
      setRagLoading(false)
    }
  }

  const toggleRagSource = (id: string) => {
    setRagChecked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleRagImport = async () => {
    if (ragChecked.size === 0) return
    setRagImporting(true)
    setRagMsg('📥 読み込み中...')
    let imported = 0
    try {
      for (const sourceId of ragChecked) {
        const source = ragSources.find((s) => s.id === sourceId)
        if (!source) continue

        setRagMsg(`📥 ${source.name} を取得中...`)
        const text = await fetchSourceAsText(ragBaseUrl, source, ragQuery)
        if (text.trim()) {
          addDataSource({
            id: uuidv4(),
            type: 'text',
            name: `[RAG] ${source.name}`,
            content: text,
            size: new Blob([text]).size,
            addedAt: new Date().toISOString(),
            selected: true,
          })
          imported++
        }

        if (ragImportImages && (source.imageCount ?? 0) > 0) {
          setRagMsg(`🖼️ ${source.name} の画像を取得中...`)
          const images = await getSourceImages(ragBaseUrl, sourceId)
          for (const img of images) {
            try {
              if (img.imageCaption) {
                const captionText = `[図の説明 ${img.chunkIndex + 1}]\n${img.imageCaption}`
                addDataSource({
                  id: uuidv4(),
                  type: 'text',
                  name: `[RAG図] ${source.name} #${img.chunkIndex + 1}`,
                  content: captionText,
                  size: new Blob([captionText]).size,
                  addedAt: new Date().toISOString(),
                  selected: true,
                })
              }
              if (img.imageUrl) {
                const { base64, mimeType } = await imageUrlToBase64(img.imageUrl)
                const file = await (await fetch(`data:${mimeType};base64,${base64}`)).blob()
                const ocrText = await extractTextFromImage(
                  settings.geminiApiKey,
                  settings.geminiModel,
                  new File([file], `rag_img_${img.chunkIndex}.jpg`, { type: mimeType })
                )
                addDataSource({
                  id: uuidv4(),
                  type: 'image',
                  name: `[RAG画像] ${source.name} #${img.chunkIndex + 1}`,
                  content: ocrText,
                  size: file.size,
                  addedAt: new Date().toISOString(),
                  selected: true,
                })
              }
            } catch { /* 画像1件失敗は無視して続行 */ }
          }
        }
      }
      setRagMsg(`✅ ${imported}件のソースを読み込みました`)
      setRagChecked(new Set())
    } catch (err) {
      setRagMsg(`❌ ${String(err)}`)
    } finally {
      setRagImporting(false)
    }
  }

  // アプリ内ブラウザから「取り込む」ボタンが押されたとき content-captured イベントを受信
  useEffect(() => {
    let cancelled = false
    let unlisten: (() => void) | undefined
    listen<{ title: string; content: string }>('content-captured', ({ payload }) => {
      addDataSource({
        id: uuidv4(),
        type: 'paste',
        name: payload.title || 'Webページ取り込み',
        content: payload.content,
        size: new Blob([payload.content]).size,
        addedAt: new Date().toISOString(),
        selected: true,
      })
      setUrlMsg(`✅ 取り込み完了: ${payload.title}`)
      setUrlLoading(false)
    }).then((fn) => {
      if (cancelled) { fn() } else { unlisten = fn }
    })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, []) // addDataSource は Zustand の安定した参照なので依存不要

  const handleOpenUrl = async (url?: string) => {
    const trimmed = (url ?? urlInput).trim()
    if (!trimmed) return
    if (url) setUrlInput(url)
    setUrlLoading(true)
    setUrlMsg('🌐 アプリ内ブラウザを起動中...')
    try {
      await invoke('open_notebooklm_window', { url: trimmed })
      addUrlHistory(trimmed)
      setUrlMsg('📌 ページが開きました。右下の「MONGENEに取り込む」ボタンを押してください。\n（初回はGoogleアカウントでのログインが必要です）')
    } catch (err) {
      setUrlMsg(`❌ ${String(err)}`)
      setUrlLoading(false)
    }
  }
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setLoading(true)
      setError(null)
      for (const file of Array.from(files)) {
        const { type: detectedType, supported } = detectFileType(file)
        if (!supported) {
          setError(`対応していないファイル形式です: ${file.name}`)
          continue
        }

        setLoadingName(file.name)
        try {
          // 画像は Gemini Vision でOCR
          if (detectedType === 'image') {
            if (!settings.geminiApiKey) {
              setError('画像OCRにはGemini APIキーが必要です。先に「設定」でAPIキーを登録してください。')
              setActiveView('settings')
              break
            }
            const ocrText = await extractTextFromImage(
              settings.geminiApiKey,
              settings.geminiModel,
              file
            )
            addDataSource({
              id: uuidv4(),
              type: 'image',
              name: file.name,
              content: ocrText,
              size: file.size,
              addedAt: new Date().toISOString(),
              selected: true,
            })
            continue
          }

          // テキスト系
          const { content, type } = await parseFile(file)
          const source: DataSource = {
            id: uuidv4(),
            type,
            name: file.name,
            content,
            size: file.size,
            addedAt: new Date().toISOString(),
            selected: true,
          }
          addDataSource(source)
        } catch (err) {
          setError(`${file.name}: ${String(err)}`)
        }
      }
      setLoading(false)
      setLoadingName('')
    },
    [addDataSource, settings.geminiApiKey, settings.geminiModel, setActiveView]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      setDragCounter(0)
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const addPasteSource = () => {
    if (!pasteText.trim()) return
    addDataSource({
      id: uuidv4(),
      type: 'paste',
      name: pasteName.trim() || `貼り付けテキスト ${new Date().toLocaleString('ja-JP')}`,
      content: pasteText,
      size: new Blob([pasteText]).size,
      addedAt: new Date().toISOString(),
      selected: true,
    })
    setPasteText('')
    setPasteName('')
    setShowPaste(false)
  }

  const selectedCount = dataSources.filter((s) => s.selected).length
  const totalChars    = dataSources
    .filter((s) => s.selected)
    .reduce((a, s) => a + s.content.length, 0)

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '36px 32px' }}>

        {/* Header */}
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>データソース</h2>
        <p style={{ marginTop: 6, color: 'var(--color-text-muted)', fontSize: 14 }}>
          問題の元となる学習資料を追加してください。PDF・Word・Markdown・テキストに対応しています。
        </p>

        {/* Drop zone */}
        <div
          style={{
            marginTop: 28,
            border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
            borderRadius: 16,
            padding: '48px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'rgba(99,102,241,0.06)' : 'transparent',
            transition: 'all 0.2s',
          }}
          onDragEnter={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragCounter((c) => c + 1)
            setIsDragging(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragCounter((c) => {
              const next = c - 1
              if (next <= 0) setIsDragging(false)
              return Math.max(0, next)
            })
          }}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED}
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36, height: 36,
                  border: '3px solid var(--color-primary)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: 0 }}>
                {loadingName
                  ? `処理中: ${loadingName}`
                  : 'ファイルを処理中...'}
              </p>
              {loadingName.match(/\.(jpe?g|png|webp|gif|heic?|bmp|tiff?)$/i) && (
                <p style={{ fontSize: 12, color: 'var(--color-text-dim)', margin: 0 }}>
                  🖼️ Gemini Vision で文字を抽出中...
                </p>
              )}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 44, marginBottom: 12 }}>
                {isDragging ? '📂' : '📁'}
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                {isDragging ? 'ここにドロップ！' : 'ファイルをドロップ、またはクリックして選択'}
              </p>
              <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
                PDF · Word (.docx) · Markdown · テキスト · 画像 (JPEG / PNG / WebP / GIF 等)
              </p>
              <p style={{ marginTop: 4, fontSize: 11, color: 'var(--color-text-dim)' }}>
                ※ 画像は Gemini Vision API で自動OCR
              </p>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              marginTop: 12, padding: '10px 14px',
              borderRadius: 10, border: '1px solid rgba(239,68,68,0.35)',
              background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 13,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Paste button */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowPaste(!showPaste)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 10,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-3)',
              color: 'var(--color-text-muted)',
              fontSize: 13, cursor: 'pointer', transition: 'color 0.15s',
            }}
          >
            📋 テキストを貼り付け
          </button>

          <button
            onClick={() => { setShowUrl(!showUrl); setUrlMsg(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 10,
              border: `1px solid ${showUrl ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: showUrl ? 'rgba(99,102,241,0.10)' : 'var(--color-surface-3)',
              color: showUrl ? 'var(--color-primary-hover)' : 'var(--color-text-muted)',
              fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            🌐 URLから取り込む
          </button>

          <button
            onClick={() => { setShowRag(!showRag); if (!showRag && ragSources.length === 0) handleRagConnect() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 10,
              border: `1px solid ${showRag ? 'rgba(99,102,241,0.5)' : 'var(--color-border)'}`,
              background: showRag ? 'rgba(99,102,241,0.12)' : 'var(--color-surface-3)',
              color: showRag ? '#a5b4fc' : 'var(--color-text-muted)',
              fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            🔬 SEIBUTURAGから読み込む
          </button>
        </div>

        {/* SEIBUTURAG panel */}
        {showRag && (
          <div
            style={{
              marginTop: 12, padding: 20, borderRadius: 14,
              background: 'var(--color-surface-2)',
              border: '1px solid rgba(99,102,241,0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 16 }}>🔬</span>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#a5b4fc' }}>
                SEIBUTURAG
              </p>
              <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{ragBaseUrl}</span>
              <button
                onClick={handleRagConnect}
                disabled={ragLoading}
                style={{
                  marginLeft: 'auto', padding: '5px 12px', borderRadius: 7,
                  border: '1px solid rgba(99,102,241,0.4)',
                  background: 'rgba(99,102,241,0.12)', color: '#a5b4fc',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  opacity: ragLoading ? 0.5 : 1,
                }}
              >
                {ragLoading ? '⏳ 接続中...' : '🔄 再読み込み'}
              </button>
            </div>

            {/* ソース一覧 */}
            {ragSources.length > 0 && (
              <>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-dim)' }}>
                  登録ソース ({ragSources.length}件) — チェックして読み込む
                </p>
                <div
                  style={{
                    maxHeight: 280, overflowY: 'auto',
                    display: 'flex', flexDirection: 'column', gap: 5,
                    marginBottom: 14,
                  }}
                >
                  {ragSources.map((src) => {
                    const checked = ragChecked.has(src.id)
                    return (
                      <div
                        key={src.id}
                        onClick={() => toggleRagSource(src.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                          border: `1px solid ${checked ? 'rgba(99,102,241,0.4)' : 'var(--color-border)'}`,
                          background: checked ? 'rgba(99,102,241,0.08)' : 'var(--color-surface-3)',
                          transition: 'all 0.12s',
                        }}
                      >
                        <div
                          style={{
                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                            border: `2px solid ${checked ? '#818cf8' : 'var(--color-border-strong)'}`,
                            background: checked ? '#818cf8' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {checked && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {src.name}
                          </p>
                          <p style={{ margin: '1px 0 0', fontSize: 10, color: 'var(--color-text-dim)' }}>
                            {src.chunkCount}チャンク
                            {(src.imageCount ?? 0) > 0 && ` · 画像${src.imageCount}枚`}
                            {src.fileTypes?.length > 0 && ` · ${src.fileTypes.join('/')}`}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 検索クエリ */}
                <div style={{ marginBottom: 10 }}>
                  <p style={{ margin: '0 0 5px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-dim)' }}>
                    検索クエリ（省略時はソース名で自動検索）
                  </p>
                  <input
                    type="text"
                    placeholder="例：細胞膜の構造、DNAの複製"
                    value={ragQuery}
                    onChange={(e) => setRagQuery(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 8,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface-3)', color: 'var(--color-text)',
                      fontSize: 12, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* 画像オプション */}
                <label
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                    fontSize: 12, color: 'var(--color-text-muted)', cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={ragImportImages}
                    onChange={(e) => setRagImportImages(e.target.checked)}
                    style={{ width: 14, height: 14 }}
                  />
                  画像も取り込む（Gemini Vision でOCR、画像を含むソースのみ）
                </label>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={handleRagImport}
                    disabled={ragChecked.size === 0 || ragImporting}
                    style={{
                      padding: '9px 22px', borderRadius: 8, border: 'none',
                      background: ragChecked.size > 0 && !ragImporting
                        ? 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)'
                        : 'var(--color-surface-3)',
                      color: ragChecked.size > 0 && !ragImporting ? '#fff' : 'var(--color-text-dim)',
                      fontSize: 13, fontWeight: 700, cursor: ragChecked.size > 0 ? 'pointer' : 'not-allowed',
                      transition: 'all 0.15s',
                    }}
                  >
                    {ragImporting ? '⏳ 読み込み中...' : `📥 ${ragChecked.size}件を読み込む`}
                  </button>
                  {ragChecked.size > 0 && (
                    <button
                      onClick={() => setRagChecked(new Set())}
                      style={{
                        padding: '9px 14px', borderRadius: 8,
                        border: '1px solid var(--color-border)',
                        background: 'transparent', color: 'var(--color-text-dim)',
                        fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      選択解除
                    </button>
                  )}
                </div>
              </>
            )}

            {ragMsg && (
              <p
                style={{
                  margin: '10px 0 0', fontSize: 12, padding: '8px 12px', borderRadius: 8,
                  background: ragMsg.startsWith('❌') ? 'rgba(239,68,68,0.08)' : ragMsg.startsWith('✅') ? 'rgba(16,185,129,0.08)' : 'rgba(99,102,241,0.08)',
                  color: ragMsg.startsWith('❌') ? '#f87171' : ragMsg.startsWith('✅') ? '#34d399' : 'var(--color-text-muted)',
                  border: `1px solid ${ragMsg.startsWith('❌') ? 'rgba(239,68,68,0.3)' : ragMsg.startsWith('✅') ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.25)'}`,
                }}
              >
                {ragMsg}
              </p>
            )}
          </div>
        )}

        {/* URL panel */}
        {showUrl && (
          <div
            style={{
              marginTop: 12, padding: 20, borderRadius: 14,
              background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
            }}
          >
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
              🌐 URLからページを取り込む
            </p>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--color-text-dim)', lineHeight: 1.5 }}>
              NotebookLM・Webサイトなどをアプリ内ブラウザで開き、右下の「MONGENEに取り込む」ボタンでテキストを取得します。<br />
              <span style={{ color: 'rgba(99,102,241,0.9)' }}>※ NotebookLM は初回のみ Google ログインが必要です。</span>
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="url"
                placeholder="https://notebooklm.google.com/notebook/..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleOpenUrl()}
                style={{
                  flex: 1, padding: '9px 12px',
                  borderRadius: 8, border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-3)', color: 'var(--color-text)',
                  fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button
                onClick={() => handleOpenUrl()}
                disabled={!urlInput.trim() || urlLoading}
                style={{
                  padding: '9px 18px', borderRadius: 8, border: 'none',
                  background: 'var(--color-primary)', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: !urlInput.trim() || urlLoading ? 0.4 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {urlLoading ? '⏳ 起動中...' : '🚀 開く'}
              </button>
            </div>
            {urlMsg && (
              <p
                style={{
                  margin: 0, fontSize: 12, padding: '10px 12px', borderRadius: 8,
                  background: urlMsg.startsWith('❌') ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.08)',
                  color: urlMsg.startsWith('❌') ? '#f87171' : 'var(--color-text-muted)',
                  border: `1px solid ${urlMsg.startsWith('❌') ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.25)'}`,
                  lineHeight: 1.6, whiteSpace: 'pre-wrap',
                }}
              >
                {urlMsg}
              </p>
            )}
            {urlHistory.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--color-text-dim)' }}>🕓 最近使ったURL</p>
                  <button
                    onClick={clearUrlHistory}
                    style={{
                      padding: '2px 8px', fontSize: 10, borderRadius: 6, cursor: 'pointer',
                      border: '1px solid var(--color-border)', background: 'transparent',
                      color: 'var(--color-text-dim)',
                    }}
                  >クリア</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {urlHistory.map((u) => (
                    <button
                      key={u}
                      onClick={() => handleOpenUrl(u)}
                      title={u}
                      style={{
                        textAlign: 'left', padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                        border: '1px solid var(--color-border)', background: 'var(--color-surface-3)',
                        color: 'var(--color-text-muted)', fontSize: 11,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: '100%',
                      }}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Paste panel */}
        {showPaste && (
          <div
            style={{
              marginTop: 12, padding: 20, borderRadius: 14,
              background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
            }}
          >
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
              テキストを貼り付け（AegisNote や NotebookLM のコピーにも使用可能）
            </p>
            <input
              type="text"
              placeholder="ソース名（任意）"
              value={pasteName}
              onChange={(e) => setPasteName(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', marginBottom: 10,
                borderRadius: 8, border: '1px solid var(--color-border)',
                background: 'var(--color-surface-3)', color: 'var(--color-text)',
                fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />
            <textarea
              rows={8}
              placeholder="ここに学習資料のテキストを貼り付けてください..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', marginBottom: 12,
                borderRadius: 8, border: '1px solid var(--color-border)',
                background: 'var(--color-surface-3)', color: 'var(--color-text)',
                fontSize: 13, fontFamily: 'monospace', resize: 'vertical',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={addPasteSource}
                disabled={!pasteText.trim()}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: 'var(--color-primary)', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: pasteText.trim() ? 1 : 0.4,
                }}
              >
                追加
              </button>
              <button
                onClick={() => { setShowPaste(false); setPasteText(''); setPasteName('') }}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: '1px solid var(--color-border)',
                  background: 'transparent', color: 'var(--color-text-muted)',
                  fontSize: 13, cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        {dataSources.length > 0 && (
          <div style={{ display: 'flex', gap: 20, marginTop: 24, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <span>{dataSources.length} 件のソース</span>
            <span>{selectedCount} 件選択中</span>
            <span>合計 {totalChars.toLocaleString()} 文字</span>
          </div>
        )}

        {/* Source list */}
        {dataSources.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dataSources.map((src) => {
              const meta = TYPE_META[src.type] ?? { label: src.type, color: '#94a3b8' }
              return (
                <div
                  key={src.id}
                  onClick={() => toggleDataSource(src.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    border: `1px solid ${src.selected ? 'var(--color-border-strong)' : 'var(--color-border)'}`,
                    background: src.selected ? 'var(--color-surface-2)' : 'var(--color-surface-1)',
                    opacity: src.selected ? 1 : 0.55, transition: 'all 0.15s',
                  }}
                >
                  {/* Checkbox */}
                  <div
                    style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${src.selected ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
                      background: src.selected ? 'var(--color-primary)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {src.selected && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
                  </div>

                  {/* Type badge */}
                  <span
                    style={{
                      fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                      padding: '2px 6px', borderRadius: 4,
                      color: meta.color,
                      background: `${meta.color}18`,
                      border: `1px solid ${meta.color}40`,
                    }}
                  >
                    {meta.emoji} {meta.label}
                  </span>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {src.name}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-dim)' }}>
                      {formatSize(src.size)} · {src.content.length.toLocaleString()} 文字
                    </p>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeDataSource(src.id) }}
                    style={{
                      padding: 4, border: 'none', background: 'transparent',
                      color: 'var(--color-text-dim)', cursor: 'pointer', fontSize: 14,
                    }}
                    title="削除"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {dataSources.length === 0 && !loading && (
          <div style={{ marginTop: 48, textAlign: 'center', color: 'var(--color-text-dim)' }}>
            <p>まだデータソースが追加されていません。</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>ファイルをドロップするか、テキストを貼り付けてください。</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
