import { useRef, useState, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useAppStore } from '../store/appStore'
import { parseFile, detectFileType } from '../lib/parsers'
import { extractTextFromImage, generateQuestions, generatePassageSets } from '../lib/gemini'
import { EXAM_LEVEL_CONFIGS, QUESTION_TYPE_CONFIGS, CURRICULUM_STAGE_CONFIGS } from '../types'
import type { DataSourceType, ExamLevel, QuestionType, CurriculumStage } from '../types'
import { TEMPLATES } from '../lib/templates'
import { listSources, fetchSourceAsText, getSourceImages, imageUrlToBase64 } from '../lib/seibuturagClient'
import type { SeibuturagSource } from '../lib/seibuturagClient'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED = '.pdf,.docx,.doc,.md,.markdown,.txt,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.bmp,.tiff'

const TYPE_META: Record<DataSourceType, { emoji: string }> = {
  pdf:      { emoji: '📄' },
  word:     { emoji: '📝' },
  markdown: { emoji: '📋' },
  text:     { emoji: '📃' },
  paste:    { emoji: '✂️' },
  image:    { emoji: '🖼️' },
}

const MODELS = [
  { id: 'gemini-3.1-flash-lite-preview',  label: 'Gemini 3.1 Flash-Lite', note: '推奨 · 最速・低コスト' },
  { id: 'gemini-2.5-flash-preview-04-17', label: 'Gemini 2.5 Flash',      note: '高精度' },
  { id: 'gemini-2.5-flash-lite',          label: 'Gemini 2.5 Flash-Lite', note: '節約モード' },
  { id: 'gemini-1.5-pro',                 label: 'Gemini 1.5 Pro',        note: '最高精度' },
]

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Section accordion ────────────────────────────────────────────────────────

interface SectionProps {
  title: string
  emoji: string
  badge?: number
  defaultOpen?: boolean
  children: React.ReactNode
}

function Section({ title, emoji, badge, defaultOpen = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '11px 14px', border: 'none', background: 'transparent',
          cursor: 'pointer', color: 'var(--color-text)',
        }}
      >
        <span style={{ fontSize: 14 }}>{emoji}</span>
        <span style={{ flex: 1, textAlign: 'left', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>
          {title}
        </span>
        {badge !== undefined && badge > 0 && (
          <span style={{
            fontSize: 10, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 20,
            background: 'var(--color-surface-3)', color: 'var(--color-text-muted)',
          }}>
            {badge}
          </span>
        )}
        <span style={{
          fontSize: 10, color: 'var(--color-text-dim)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s',
        }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export default function Sidebar() {
  // ── Store ────────────────────────────────────────────────────────────────
  const dataSources          = useAppStore((s) => s.dataSources)
  const addDataSource        = useAppStore((s) => s.addDataSource)
  const removeDataSource     = useAppStore((s) => s.removeDataSource)
  const toggleDataSource     = useAppStore((s) => s.toggleDataSource)
  const clearDataSources     = useAppStore((s) => s.clearDataSources)
  const questions            = useAppStore((s) => s.questions)
  const passageSets          = useAppStore((s) => s.passageSets)
  const appendQuestions      = useAppStore((s) => s.appendQuestions)
  const appendPassageSets    = useAppStore((s) => s.appendPassageSets)
  const setQuestionListTab   = useAppStore((s) => s.setQuestionListTab)
  const config               = useAppStore((s) => s.generationConfig)
  const updateConfig         = useAppStore((s) => s.updateGenerationConfig)
  const settings             = useAppStore((s) => s.settings)
  const updateSettings       = useAppStore((s) => s.updateSettings)
  const isGenerating         = useAppStore((s) => s.isGenerating)
  const setIsGenerating      = useAppStore((s) => s.setIsGenerating)
  const generationProgress   = useAppStore((s) => s.generationProgress)
  const setGenerationProgress= useAppStore((s) => s.setGenerationProgress)
  const urlHistory           = useAppStore((s) => s.urlHistory)
  const addUrlHistory        = useAppStore((s) => s.addUrlHistory)

  // ── Local state ──────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef    = useRef<HTMLDivElement>(null)
  const scrollTopRef = useRef(0)

  // スクロール位置を再レンダリング前後で保持する
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const save = () => { scrollTopRef.current = el.scrollTop }
    el.addEventListener('scroll', save, { passive: true })
    return () => el.removeEventListener('scroll', save)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el && Math.abs(el.scrollTop - scrollTopRef.current) > 50) {
      el.scrollTop = scrollTopRef.current
    }
  })
  const [fileLoading,     setFileLoading]     = useState(false)
  const [fileLoadingName, setFileLoadingName] = useState('')
  const [fileError,       setFileError]       = useState<string | null>(null)
  const [showPaste,       setShowPaste]       = useState(false)
  const [pasteText,       setPasteText]       = useState('')
  const [pasteName,       setPasteName]       = useState('')
  const [showUrl,         setShowUrl]         = useState(false)
  const [urlInput,        setUrlInput]        = useState('')
  const [urlLoading,      setUrlLoading]      = useState(false)
  const [urlMsg,          setUrlMsg]          = useState<string | null>(null)
  const [genError,        setGenError]        = useState<string | null>(null)
  const [genSuccess,      setGenSuccess]      = useState<string | null>(null)
  const [showKey,         setShowKey]         = useState(false)

  // ── SEIBUTURAG ────────────────────────────────────────────────────────────
  const [showRag,         setShowRag]         = useState(false)
  const [ragSources,      setRagSources]      = useState<SeibuturagSource[]>([])
  const [ragLoading,      setRagLoading]      = useState(false)
  const [ragImporting,    setRagImporting]    = useState(false)
  const [ragMsg,          setRagMsg]          = useState<string | null>(null)
  const [ragChecked,      setRagChecked]      = useState<Set<string>>(new Set())
  const [ragQuery,        setRagQuery]        = useState('')
  const [ragConnected,    setRagConnected]    = useState(false)

  // ── Templates ─────────────────────────────────────────────────────────────
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null)

  // ── URL capture event ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    let unlisten: (() => void) | undefined
    listen<{ title: string; content: string }>('content-captured', ({ payload }) => {
      addDataSource({
        id: uuidv4(), type: 'paste',
        name: payload.title || 'Webページ取り込み',
        content: payload.content,
        size: new Blob([payload.content]).size,
        addedAt: new Date().toISOString(), selected: true,
      })
      setUrlMsg(`✅ 取り込み完了: ${payload.title}`)
      setUrlLoading(false)
    }).then((fn) => {
      if (cancelled) { fn() } else { unlisten = fn }
    })
    return () => { cancelled = true; unlisten?.() }
  }, [])

  // ── File handling ────────────────────────────────────────────────────────
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setFileLoading(true)
    setFileError(null)
    for (const file of Array.from(files)) {
      const { type: detectedType, supported } = detectFileType(file)
      if (!supported) { setFileError(`対応していない形式: ${file.name}`); continue }
      setFileLoadingName(file.name)
      try {
        if (detectedType === 'image') {
          if (!settings.geminiApiKey) {
            setFileError('画像OCRにはAPIキーが必要です（設定セクションで入力してください）')
            break
          }
          const ocrText = await extractTextFromImage(settings.geminiApiKey, settings.geminiModel, file)
          addDataSource({ id: uuidv4(), type: 'image', name: file.name, content: ocrText, size: file.size, addedAt: new Date().toISOString(), selected: true })
          continue
        }
        const { content, type } = await parseFile(file)
        addDataSource({ id: uuidv4(), type, name: file.name, content, size: file.size, addedAt: new Date().toISOString(), selected: true })
      } catch (err) {
        setFileError(`${file.name}: ${String(err)}`)
      }
    }
    setFileLoading(false)
    setFileLoadingName('')
  }, [addDataSource, settings.geminiApiKey, settings.geminiModel])

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return
    addDataSource({
      id: uuidv4(), type: 'paste',
      name: pasteName || 'テキスト貼り付け',
      content: pasteText, size: new Blob([pasteText]).size,
      addedAt: new Date().toISOString(), selected: true,
    })
    setPasteText(''); setPasteName(''); setShowPaste(false)
  }

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

  // ── SEIBUTURAG handlers ───────────────────────────────────────────────────
  const ragBaseUrl = settings.seibuturagBaseUrl || 'http://localhost:3001'

  const handleRagConnect = async () => {
    setRagLoading(true)
    setRagMsg('🔌 接続中...')
    try {
      const sources = await listSources(ragBaseUrl)
      const valid = sources.filter((s) => (s.chunkCount ?? 0) > 0)
      setRagSources(valid)
      setRagConnected(true)
      setRagMsg(valid.length === 0 ? '⚠️ ソースが見つかりません' : `✅ ${valid.length}件のソースを取得しました`)
    } catch (err) {
      setRagMsg(`❌ 接続失敗: ${String(err)}`)
      setRagConnected(false)
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
    let imported = 0
    try {
      for (const sourceId of ragChecked) {
        const source = ragSources.find((s) => s.id === sourceId)
        if (!source) continue
        setRagMsg(`📥 ${source.name} を取得中...`)
        const text = await fetchSourceAsText(ragBaseUrl, source, ragQuery)
        if (text.trim()) {
          addDataSource({
            id: uuidv4(), type: 'text',
            name: `[RAG] ${source.name}`,
            content: text,
            size: new Blob([text]).size,
            addedAt: new Date().toISOString(),
            selected: true,
          })
          imported++
        }
        if ((source.imageCount ?? 0) > 0) {
          setRagMsg(`🖼️ ${source.name} の画像を取得中...`)
          try {
            const images = await getSourceImages(ragBaseUrl, sourceId)
            for (const img of images) {
              if (img.imageCaption) {
                const captionText = `[図の説明 ${img.chunkIndex + 1}]\n${img.imageCaption}`
                addDataSource({
                  id: uuidv4(), type: 'text',
                  name: `[RAG図] ${source.name} #${img.chunkIndex + 1}`,
                  content: captionText,
                  size: new Blob([captionText]).size,
                  addedAt: new Date().toISOString(),
                  selected: true,
                })
              }
              if (img.imageUrl && settings.geminiApiKey) {
                const { base64, mimeType } = await imageUrlToBase64(img.imageUrl)
                const file = await (await fetch(`data:${mimeType};base64,${base64}`)).blob()
                const ocrText = await extractTextFromImage(
                  settings.geminiApiKey, settings.geminiModel,
                  new File([file], `rag_img_${img.chunkIndex}.jpg`, { type: mimeType })
                )
                addDataSource({
                  id: uuidv4(), type: 'image',
                  name: `[RAG画像] ${source.name} #${img.chunkIndex + 1}`,
                  content: ocrText, size: file.size,
                  addedAt: new Date().toISOString(),
                  selected: true,
                })
              }
            }
          } catch { /* 画像失敗は無視して続行 */ }
        }
      }
      setRagMsg(`✅ ${imported}件を読み込みました — データソース欄を確認してください`)
      setRagChecked(new Set())
    } catch (err) {
      setRagMsg(`❌ ${String(err)}`)
    } finally {
      setRagImporting(false)
    }
  }

  // ── Template handler ──────────────────────────────────────────────────────
  const applyTemplate = (templateId: string) => {
    const tpl = TEMPLATES.find((t) => t.id === templateId)
    if (!tpl) return
    updateConfig(tpl.config)
    setAppliedTemplate(templateId)
  }

  // ── Generation ───────────────────────────────────────────────────────────
  const selected      = dataSources.filter((s) => s.selected)
  const mode          = config.generationMode ?? 'individual'
  const hasCurriculum = config.curriculumStage !== 'none'
  const canGenerate   = (selected.length > 0 || hasCurriculum) && !!settings.geminiApiKey && !isGenerating

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

  const handleGenerate = async () => {
    setGenError(null)
    setGenSuccess(null)
    if (!settings.geminiApiKey) { setGenError('APIキーを設定してください'); return }
    if (selected.length === 0 && config.curriculumStage === 'none') { setGenError('データソースを選択するか単元を選んでください'); return }
    setIsGenerating(true)
    try {
      if (mode === 'passage') {
        const sets = await generatePassageSets(
          settings.geminiApiKey, settings.geminiModel,
          selected.map((s) => ({ name: s.name, content: s.content })),
          config, setGenerationProgress,
        )
        appendPassageSets(sets)
        const totalQ = sets.reduce((a, s) => a + s.questions.length, 0)
        setGenSuccess(`${sets.length}セット（計${totalQ}問）生成完了！`)
        setQuestionListTab('passage')
      } else {
        const qs = await generateQuestions(
          settings.geminiApiKey, settings.geminiModel,
          selected.map((s) => ({ name: s.name, content: s.content })),
          config, setGenerationProgress,
        )
        appendQuestions(qs)
        setGenSuccess(`${qs.length}問生成完了！`)
        setQuestionListTab('individual')
      }
    } catch (err) {
      setGenError(String(err))
    } finally {
      setIsGenerating(false)
      setGenerationProgress('')
    }
  }

  // ── Shared styles ────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-surface-3)',
    color: 'var(--color-text)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
  }
  const btn: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 8,
    border: '1px solid var(--color-border)', cursor: 'pointer',
    color: 'var(--color-text-muted)', fontSize: 11, fontWeight: 600,
    textAlign: 'left', transition: 'all 0.12s', background: 'transparent',
  }

  const totalQuestions = questions.length + passageSets.reduce((a, s) => a + s.questions.length, 0)

  return (
    <aside style={{
      width: 288, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--color-border)', background: 'var(--color-surface-1)',
      height: '100vh', overflow: 'hidden',
    }}>
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: '18px 14px 14px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{
          fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          MONGENE
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>問題生成システム</div>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>

        {/* API キー未設定バナー */}
        {!settings.geminiApiKey && (
          <div style={{
            margin: '10px 10px 0', padding: '9px 12px', borderRadius: 10,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            fontSize: 11, color: '#f87171', lineHeight: 1.5,
          }}>
            ⚠️ <strong>Gemini APIキー未設定</strong><br />
            下の「設定」セクションにAPIキーを入力してください。
          </div>
        )}

        {/* ══ データソース ══════════════════════════════════════════════════ */}
        <Section title="データソース" emoji="📂" badge={dataSources.length} defaultOpen>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }}
          />

          {/* Source list */}
          {dataSources.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {dataSources.map((src) => (
                <div
                  key={src.id}
                  onClick={() => toggleDataSource(src.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8,
                    background: src.selected ? 'rgba(99,102,241,0.08)' : 'var(--color-surface-3)',
                    border: `1px solid ${src.selected ? 'rgba(99,102,241,0.3)' : 'var(--color-border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={src.selected}
                    onChange={() => toggleDataSource(src.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ accentColor: 'var(--color-primary)', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13 }}>{TYPE_META[src.type].emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {src.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>{formatSize(src.size)}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeDataSource(src.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-dim)', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {fileError && (
            <div style={{ fontSize: 11, color: '#f87171', marginBottom: 6, padding: '4px 8px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
              ⚠️ {fileError}
            </div>
          )}
          {fileLoading && (
            <div style={{ fontSize: 11, color: 'var(--color-primary)', marginBottom: 6 }}>
              ⏳ {fileLoadingName} を読み込み中...
            </div>
          )}

          {/* Add buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={() => fileInputRef.current?.click()} style={{ ...btn, background: 'var(--color-surface-3)' }}>
              📁 ファイルを追加
            </button>
            <button onClick={() => { setShowPaste(!showPaste); setShowUrl(false) }} style={{ ...btn, background: 'var(--color-surface-3)' }}>
              ✂️ テキストを貼り付け
            </button>
            <button onClick={() => { setShowUrl(!showUrl); setShowPaste(false) }} style={{ ...btn, background: 'var(--color-surface-3)' }}>
              🌐 URLから取り込む
            </button>
            <button
              onClick={() => {
                setShowRag((v) => !v)
                if (!showRag && !ragConnected) handleRagConnect()
              }}
              style={{
                ...btn,
                background: showRag ? 'rgba(99,102,241,0.12)' : 'var(--color-surface-3)',
                color: showRag ? '#a5b4fc' : 'var(--color-text-muted)',
                border: `1px solid ${showRag ? 'rgba(99,102,241,0.4)' : 'var(--color-border)'}`,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              🔬 SEIBUTURAGから読み込む
              {ragConnected && (
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: 'rgba(16,185,129,0.2)', color: '#34d399', fontWeight: 700 }}>
                  接続済
                </span>
              )}
            </button>
            {dataSources.length > 0 && (
              <button
                onClick={() => { if (window.confirm('全てのデータソースを削除しますか？')) clearDataSources() }}
                style={{ ...btn, background: 'rgba(239,68,68,0.06)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                🗑️ 全削除
              </button>
            )}
          </div>

          {/* SEIBUTURAG panel */}
          {showRag && (
            <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc' }}>🔬 SEIBUTURAG</span>
                <span style={{ fontSize: 10, color: 'var(--color-text-dim)', flex: 1 }}>{ragBaseUrl}</span>
                <button
                  onClick={handleRagConnect}
                  disabled={ragLoading}
                  style={{ padding: '2px 8px', borderRadius: 5, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', fontSize: 10, cursor: 'pointer', opacity: ragLoading ? 0.5 : 1 }}
                >
                  {ragLoading ? '⏳' : '🔄'}
                </button>
              </div>

              {ragMsg && (
                <div style={{
                  fontSize: 11, padding: '5px 8px', borderRadius: 6, marginBottom: 8,
                  background: ragMsg.startsWith('❌') ? 'rgba(239,68,68,0.08)' : ragMsg.startsWith('✅') ? 'rgba(16,185,129,0.08)' : 'rgba(99,102,241,0.08)',
                  color: ragMsg.startsWith('❌') ? '#f87171' : ragMsg.startsWith('✅') ? '#34d399' : 'var(--color-text-muted)',
                  lineHeight: 1.5,
                }}>
                  {ragMsg}
                </div>
              )}

              {ragSources.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 5 }}>
                    ソース（チェックして読み込む）
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 160, overflowY: 'auto', marginBottom: 8 }}>
                    {ragSources.map((src) => {
                      const checked = ragChecked.has(src.id)
                      return (
                        <div
                          key={src.id}
                          onClick={() => toggleRagSource(src.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 6, cursor: 'pointer',
                            background: checked ? 'rgba(99,102,241,0.12)' : 'var(--color-surface-3)',
                            border: `1px solid ${checked ? 'rgba(99,102,241,0.4)' : 'var(--color-border)'}`,
                          }}
                        >
                          <div style={{
                            width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                            border: `1.5px solid ${checked ? '#818cf8' : 'var(--color-border-strong)'}`,
                            background: checked ? '#818cf8' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {checked && <span style={{ color: '#fff', fontSize: 8 }}>✓</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {src.name}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--color-text-dim)' }}>
                              {src.chunkCount}チャンク{(src.imageCount ?? 0) > 0 && ` · 画像${src.imageCount}枚`}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <input
                    type="text"
                    placeholder="検索クエリ（省略可）"
                    value={ragQuery}
                    onChange={(e) => setRagQuery(e.target.value)}
                    style={{ ...inp, marginBottom: 6 }}
                  />

                  <button
                    onClick={handleRagImport}
                    disabled={ragChecked.size === 0 || ragImporting}
                    style={{
                      ...btn,
                      background: ragChecked.size > 0 && !ragImporting ? 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)' : 'var(--color-surface-3)',
                      color: ragChecked.size > 0 && !ragImporting ? '#fff' : 'var(--color-text-dim)',
                      border: 'none', textAlign: 'center', fontWeight: 700,
                      cursor: ragChecked.size > 0 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {ragImporting ? '⏳ 読み込み中...' : `📥 ${ragChecked.size}件を読み込む`}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Paste panel */}
          {showPaste && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input type="text" placeholder="名前（任意）" value={pasteName} onChange={(e) => setPasteName(e.target.value)} style={inp} />
              <textarea
                rows={4}
                placeholder="テキストを貼り付けてください"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={handlePasteSubmit}
                  disabled={!pasteText.trim()}
                  style={{ ...btn, flex: 1, background: 'rgba(99,102,241,0.2)', color: 'var(--color-primary)', textAlign: 'center' }}
                >追加</button>
                <button
                  onClick={() => { setShowPaste(false); setPasteText(''); setPasteName('') }}
                  style={{ ...btn, background: 'var(--color-surface-3)', textAlign: 'center' }}
                >キャンセル</button>
              </div>
            </div>
          )}

          {/* URL panel */}
          {showUrl && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {urlHistory.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 80, overflowY: 'auto' }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 2 }}>履歴</div>
                  {urlHistory.slice(0, 5).map((u) => (
                    <button key={u} onClick={() => handleOpenUrl(u)} style={{ ...btn, background: 'var(--color-surface-3)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type="url"
                  placeholder="https://..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleOpenUrl()}
                  style={{ ...inp, flex: 1 }}
                />
                <button
                  onClick={() => handleOpenUrl()}
                  disabled={urlLoading || !urlInput.trim()}
                  style={{ ...btn, width: 'auto', background: 'rgba(99,102,241,0.2)', color: 'var(--color-primary)', flexShrink: 0 }}
                >開く</button>
              </div>
              {urlMsg && (
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{urlMsg}</div>
              )}
            </div>
          )}
        </Section>

        {/* ══ テンプレート ══════════════════════════════════════════════════ */}
        <Section title="テンプレート" emoji="📋" defaultOpen>
          <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
            選ぶと問題形式・レベル・問題数が自動設定されます。
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {TEMPLATES.map((tpl) => {
              const active = appliedTemplate === tpl.id
              return (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl.id)}
                  style={{
                    ...btn,
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '8px 10px', borderRadius: 8,
                    background: active ? 'rgba(99,102,241,0.14)' : 'var(--color-surface-3)',
                    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    color: active ? 'var(--color-primary-hover)' : 'var(--color-text-muted)',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.3 }}>{tpl.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 1 }}>{tpl.name}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, lineHeight: 1.4 }}>{tpl.description}</div>
                  </div>
                  {active && (
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: 'rgba(99,102,241,0.2)', color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0 }}>
                      適用中
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Section>

        {/* ══ 生成設定 ═════════════════════════════════════════════════════ */}
        <Section title="生成設定" emoji="⚡" defaultOpen>

          {/* Mode toggle */}
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)', marginBottom: 12 }}>
            {([
              { id: 'individual', label: '📝 一問一答' },
              { id: 'passage',    label: '📖 長文問題' },
            ] as const).map((m) => {
              const active = mode === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => updateConfig({ generationMode: m.id })}
                  style={{
                    flex: 1, padding: '8px 4px', border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600,
                    background: active ? 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)' : 'transparent',
                    color: active ? '#fff' : 'var(--color-text-muted)',
                    transition: 'all 0.15s',
                  }}
                >{m.label}</button>
              )
            })}
          </div>

          {/* Source status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 8, marginBottom: 12,
            background: (selected.length > 0 || hasCurriculum) ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${(selected.length > 0 || hasCurriculum) ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            <span style={{ fontSize: 14 }}>
              {selected.length > 0 ? '✅' : hasCurriculum ? '📚' : '⚠️'}
            </span>
            <div style={{ flex: 1, fontSize: 11, color: 'var(--color-text-muted)' }}>
              {selected.length > 0
                ? `${selected.length}件選択中`
                : hasCurriculum
                ? '単元から生成'
                : 'データソース未選択'}
            </div>
          </div>

          {/* Exam levels */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 5 }}>
              対象レベル <span style={{ fontWeight: 400 }}>(複数可)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
              {EXAM_LEVEL_CONFIGS.map((lv) => {
                const active = config.levels.includes(lv.id)
                return (
                  <button
                    key={lv.id}
                    onClick={() => toggleLevel(lv.id)}
                    title={lv.description}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '5px 7px',
                      borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: active ? 'rgba(99,102,241,0.14)' : 'var(--color-surface-3)',
                      color: active ? 'var(--color-primary-hover)' : 'var(--color-text-muted)',
                      transition: 'all 0.12s',
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{lv.emoji}</span>
                    <span style={{ fontSize: 10 }}>{lv.label}</span>
                  </button>
                )
              })}
            </div>
            {config.levels.includes('custom') && (
              <input type="text" placeholder="カスタムレベルを入力" value={config.customLevel} onChange={(e) => updateConfig({ customLevel: e.target.value })} style={{ ...inp, marginTop: 6 }} />
            )}
          </div>

          {/* Question types */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 5 }}>
              問題形式 <span style={{ fontWeight: 400 }}>(複数可)</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {QUESTION_TYPE_CONFIGS.map((qt) => {
                const active = config.questionTypes.includes(qt.id)
                return (
                  <button
                    key={qt.id}
                    onClick={() => toggleType(qt.id)}
                    title={qt.description}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                      fontSize: 11, fontWeight: 600,
                      border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: active ? 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)' : 'var(--color-surface-3)',
                      color: active ? '#fff' : 'var(--color-text-muted)',
                      transition: 'all 0.12s',
                    }}
                  >
                    <span>{qt.emoji}</span><span>{qt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Count sliders */}
          <div style={{ marginBottom: 12 }}>
            {mode === 'individual' ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  問題数：<span style={{ color: 'var(--color-primary)' }}>{config.count}問</span>
                </div>
                <input type="range" min={1} max={50} step={1} value={config.count} onChange={(e) => updateConfig({ count: Number(e.target.value) })} style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-dim)' }}>
                  <span>1</span><span>25</span><span>50</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  長文セット数：<span style={{ color: 'var(--color-primary)' }}>{config.passageCount ?? 2}セット</span>
                </div>
                <input type="range" min={1} max={5} step={1} value={config.passageCount ?? 2} onChange={(e) => updateConfig({ passageCount: Number(e.target.value) })} style={{ width: '100%' }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', margin: '8px 0 4px' }}>
                  各セット設問数：<span style={{ color: 'var(--color-primary)' }}>{config.questionsPerPassage ?? 5}問</span>
                </div>
                <input type="range" min={2} max={10} step={1} value={config.questionsPerPassage ?? 5} onChange={(e) => updateConfig({ questionsPerPassage: Number(e.target.value) })} style={{ width: '100%' }} />
              </>
            )}
          </div>

          {/* Subject */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>科目・テーマ（任意）</div>
            <input type="text" placeholder="例：日本史、微積分、英文法" value={config.subject} onChange={(e) => updateConfig({ subject: e.target.value })} style={inp} />
          </div>

          {/* Curriculum */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 5 }}>学習指導要領（任意）</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {CURRICULUM_STAGE_CONFIGS.map((s) => {
                const active = (config.curriculumStage ?? 'none') === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => updateConfig({ curriculumStage: s.id as CurriculumStage })}
                    style={{
                      padding: '4px 10px', borderRadius: 14, cursor: 'pointer',
                      fontSize: 10, fontWeight: active ? 700 : 400,
                      border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: active ? 'rgba(99,102,241,0.14)' : 'var(--color-surface-3)',
                      color: active ? 'var(--color-primary-hover)' : 'var(--color-text-muted)',
                      transition: 'all 0.12s',
                    }}
                  >{s.emoji ? `${s.emoji} ` : ''}{s.label}</button>
                )
              })}
            </div>
            {(config.curriculumStage ?? 'none') !== 'none' && (() => {
              const stageConf = CURRICULUM_STAGE_CONFIGS.find((s) => s.id === config.curriculumStage)
              if (!stageConf || stageConf.chapters.length === 0) return null
              return (
                <div style={{ marginTop: 8, maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>小単元をクリックすると科目欄に入力されます</div>
                  {stageConf.chapters.map((ch) => (
                    <div key={ch.chapter}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 3 }}>{ch.chapter}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {ch.units.map((unit) => (
                          <button
                            key={unit}
                            onClick={() => updateConfig({ subject: unit })}
                            style={{
                              padding: '2px 7px', borderRadius: 10, cursor: 'pointer', fontSize: 10,
                              border: `1px solid ${config.subject === unit ? 'var(--color-primary)' : 'var(--color-border)'}`,
                              background: config.subject === unit ? 'rgba(99,102,241,0.14)' : 'var(--color-surface-3)',
                              color: config.subject === unit ? 'var(--color-primary-hover)' : 'var(--color-text-muted)',
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

          {/* Additional instructions */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>追加指示（任意）</div>
            <textarea
              rows={2}
              placeholder="例：江戸時代の文化に焦点を当てて / 計算は整数のみ"
              value={config.additionalInstructions}
              onChange={(e) => updateConfig({ additionalInstructions: e.target.value })}
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {/* Errors / Success */}
          {genError && (
            <div style={{ fontSize: 11, color: '#f87171', padding: '5px 8px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, marginBottom: 8 }}>
              ⚠️ {genError}
            </div>
          )}
          {genSuccess && (
            <div style={{ fontSize: 11, color: '#34d399', padding: '5px 8px', background: 'rgba(16,185,129,0.08)', borderRadius: 6, marginBottom: 8 }}>
              ✅ {genSuccess}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            style={{
              width: '100%', padding: '13px', borderRadius: 10, border: 'none',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              background: canGenerate
                ? 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)'
                : 'var(--color-surface-3)',
              color: canGenerate ? '#fff' : 'var(--color-text-dim)',
              fontSize: 13, fontWeight: 700,
              boxShadow: canGenerate ? '0 4px 14px rgba(99,102,241,0.3)' : 'none',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {isGenerating ? (
              <>
                <span style={{
                  width: 14, height: 14,
                  border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0,
                }} />
                {generationProgress || '生成中...'}
              </>
            ) : (
              <>⚡ 問題を生成する</>
            )}
          </button>
          {!settings.geminiApiKey && (
            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-warning)', margin: '6px 0 0' }}>
              ⚠️ 設定セクションでAPIキーを設定してください
            </p>
          )}
        </Section>

        {/* ══ 設定 ══════════════════════════════════════════════════════════ */}
        <Section title="設定" emoji="⚙️" defaultOpen={!settings.geminiApiKey}>

          {/* API Key */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 5 }}>🔑 Gemini API キー</div>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--color-text-dim)', lineHeight: 1.5 }}>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>
                aistudio.google.com
              </a> で取得してください。
            </p>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="AIzaSy..."
                value={settings.geminiApiKey}
                onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
                style={{ ...inp, paddingRight: 44 }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  padding: '2px 7px', borderRadius: 5, border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-3)', color: 'var(--color-text-dim)',
                  fontSize: 10, cursor: 'pointer',
                }}
              >
                {showKey ? '隠す' : '表示'}
              </button>
            </div>
            {settings.geminiApiKey && (
              <div style={{ fontSize: 10, color: '#34d399', marginTop: 4 }}>✓ 設定済み</div>
            )}
          </div>

          {/* Model */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 5 }}>🤖 AIモデル</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {MODELS.map((model) => {
                const active = settings.geminiModel === model.id
                return (
                  <label
                    key={model.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: active ? 'rgba(99,102,241,0.1)' : 'var(--color-surface-3)',
                      transition: 'all 0.12s',
                    }}
                  >
                    <input
                      type="radio"
                      name="sidebar-model"
                      value={model.id}
                      checked={active}
                      onChange={() => updateSettings({ geminiModel: model.id })}
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: active ? 'var(--color-primary-hover)' : 'var(--color-text)' }}>{model.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>{model.id} · {model.note}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Google 連携 */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 5 }}>🔗 Google Client ID（任意）</div>
            <input
              type="text"
              placeholder="xxxxx.apps.googleusercontent.com"
              value={settings.googleClientId}
              onChange={(e) => updateSettings({ googleClientId: e.target.value })}
              style={{ ...inp, marginBottom: 8 }}
            />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 5 }}>🔒 Google Client Secret（任意）</div>
            <input
              type="password"
              placeholder="GOCSPX-..."
              value={settings.googleClientSecret}
              onChange={(e) => updateSettings({ googleClientSecret: e.target.value })}
              style={inp}
            />
          </div>
        </Section>

      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid var(--color-border)',
        fontSize: 11, color: 'var(--color-text-dim)', flexShrink: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        {isGenerating ? (
          <span style={{ color: 'var(--color-primary)' }}>⚡ 生成中...</span>
        ) : (
          <>
            <span>📋 {totalQuestions}問</span>
            <span>v0.1.0</span>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </aside>
  )
}
