// GDDATA (Google Drive RAG) REST API クライアント
// CORS 回避のため Tauri invoke 経由で HTTP GET を実行

import { invoke } from '@tauri-apps/api/core'

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export interface GddataTopic {
  subject: string
  unit: string
}

export interface GddataDocument {
  id: string
  drive_file_id: string
  drive_url: string
  subject: string
  unit: string
  file_type: string
  drive_folder_path: string
}

export interface GddataChunk {
  id: string
  content: string
  chunk_type: string
  problem_types: string[]
  page_number: number | null
  image_drive_url: string | null
  similarity: number
  subject: string
  unit: string
  drive_url: string
}

// ─── 内部ヘルパー ────────────────────────────────────────────────────────────

async function getJson<T>(url: string): Promise<T> {
  // seibuturag_get は汎用 GET コマンドとして再利用（CORS 回避）
  const text = await invoke<string>('seibuturag_get', { url })
  return JSON.parse(text) as T
}

// ─── ヘルスチェック ──────────────────────────────────────────────────────────

export async function checkGddataHealth(baseUrl: string): Promise<boolean> {
  try {
    const data = await getJson<{ status: string }>(`${baseUrl}/health`)
    return data.status === 'ok'
  } catch {
    return false
  }
}

// ─── トピック一覧（subject/unit の組み合わせ）────────────────────────────────

export async function listGddataTopics(baseUrl: string): Promise<GddataTopic[]> {
  const data = await getJson<{ topics: GddataTopic[] }>(`${baseUrl}/topics`)
  return Array.isArray(data.topics) ? data.topics : []
}

// ─── ファイル一覧 ────────────────────────────────────────────────────────────

export async function listGddataDocuments(
  baseUrl: string,
  subject?: string,
  unit?: string,
): Promise<GddataDocument[]> {
  const params = new URLSearchParams()
  if (subject) params.set('subject', subject)
  if (unit) params.set('unit', unit)
  const qs = params.toString()
  const data = await getJson<{ files: GddataDocument[] }>(
    `${baseUrl}/files${qs ? `?${qs}` : ''}`,
  )
  return Array.isArray(data.files) ? data.files : []
}

// ─── セマンティック検索 ──────────────────────────────────────────────────────

export async function searchGddataChunks(
  baseUrl: string,
  topic: string,
  options?: {
    type?: string
    subject?: string
    unit?: string
    limit?: number
  },
): Promise<GddataChunk[]> {
  const params = new URLSearchParams({ topic })
  if (options?.type) params.set('type', options.type)
  if (options?.subject) params.set('subject', options.subject)
  if (options?.unit) params.set('unit', options.unit)
  if (options?.limit != null) params.set('limit', String(options.limit))
  const data = await getJson<{ chunks: GddataChunk[] }>(
    `${baseUrl}/search?${params.toString()}`,
  )
  return Array.isArray(data.chunks) ? data.chunks : []
}

// ─── トピックのテキストと図チャンクをまとめて取得 ───────────────────────────

export async function fetchGddataTopicContent(
  baseUrl: string,
  topic: GddataTopic,
  searchQuery = '',
): Promise<{ text: string; figureChunks: GddataChunk[] }> {
  const query = searchQuery.trim() || `${topic.subject} ${topic.unit}`
  const chunks = await searchGddataChunks(baseUrl, query, {
    subject: topic.subject,
    unit: topic.unit,
    limit: 20,
  })

  const textParts: string[] = []
  const figureChunks: GddataChunk[] = []
  const seen = new Set<string>()

  for (const c of chunks) {
    if (seen.has(c.content)) continue
    seen.add(c.content)
    if (c.image_drive_url) {
      figureChunks.push(c)
    } else {
      textParts.push(c.content)
    }
  }

  return { text: textParts.join('\n\n'), figureChunks }
}
