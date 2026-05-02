// SEIBUTURAG REST API クライアント
// fetch の代わりに Tauri invoke を使うことで CORS を回避する

import { invoke } from '@tauri-apps/api/core'

export interface SeibuturagSource {
  id: string
  name: string
  chunkCount: number
  imageCount: number
  fileTypes: string[]
  searchIndexStatus?: string
}

export interface SeibuturagChunk {
  sourceName: string
  text: string
  imageUrl?: string
  imageCaption?: string
  similarity?: number
}

export interface SeibuturagImage {
  chunkIndex: number
  imageUrl: string
  imageCaption?: string
  text?: string
}

// ─── 内部ヘルパー ────────────────────────────────────────────────────────────

async function getJson<T>(url: string): Promise<T> {
  const text = await invoke<string>('seibuturag_get', { url })
  return JSON.parse(text) as T
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const text = await invoke<string>('seibuturag_post', { url, body: JSON.stringify(body) })
  return JSON.parse(text) as T
}

// ─── ソース一覧 ──────────────────────────────────────────────────────────────
export async function listSources(baseUrl: string): Promise<SeibuturagSource[]> {
  const data = await getJson<unknown>(`${baseUrl}/api/sources`)
  return Array.isArray(data) ? data : []
}

// ─── セマンティック検索 ──────────────────────────────────────────────────────
export async function searchChunks(
  baseUrl: string,
  query: string,
  sourceIds: string[],
  topK: number,
): Promise<SeibuturagChunk[]> {
  const data = await postJson<{ results?: SeibuturagChunk[] }>(
    `${baseUrl}/api/search`,
    { query, sourceIds, topK },
  )
  return Array.isArray(data.results) ? data.results : []
}

// ─── ソースの画像一覧 ────────────────────────────────────────────────────────
export async function getSourceImages(
  baseUrl: string,
  sourceId: string,
): Promise<SeibuturagImage[]> {
  const data = await getJson<{ images?: SeibuturagImage[] }>(
    `${baseUrl}/api/sources/${sourceId}/images`,
  )
  return Array.isArray(data.images) ? data.images : []
}

// ─── ソース内容をまとめてテキスト化 ─────────────────────────────────────────
export async function fetchSourceAsText(
  baseUrl: string,
  source: SeibuturagSource,
  additionalQuery = '',
): Promise<string> {
  const queries = [source.name, additionalQuery || '内容 解説 説明'].filter(Boolean)
  const seen = new Set<string>()
  const allChunks: SeibuturagChunk[] = []

  for (const q of queries) {
    const chunks = await searchChunks(baseUrl, q, [source.id], 50)
    for (const c of chunks) {
      if (!seen.has(c.text)) {
        seen.add(c.text)
        allChunks.push(c)
      }
    }
  }

  const parts: string[] = []
  for (const c of allChunks) {
    parts.push(c.text)
    if (c.imageCaption) parts.push(`[図の説明] ${c.imageCaption}`)
  }
  return parts.join('\n\n')
}

// ─── 画像URLをbase64に変換（画像は CORS がかかるため同じく invoke 経由） ───
export async function imageUrlToBase64(
  url: string,
): Promise<{ base64: string; mimeType: string }> {
  // 画像は seibuturag_get でバイナリ取得が難しいので fetch フォールバック
  // （同一オリジンや公開URLの場合はそのまま動く）
  const res = await fetch(url)
  if (!res.ok) throw new Error(`画像の取得に失敗: ${url}`)
  const blob = await res.blob()
  const mimeType = blob.type || 'image/jpeg'
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve({ base64, mimeType })
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
