import type { DataSourceType } from '../types'

// ─── PDF ───────────────────────────────────────────────────────────────────
async function getPdfJs() {
  const pdfjsLib = await import('pdfjs-dist')
  // Use the bundled worker via Vite's URL resolution
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()
    } catch {
      // Fallback: inline fake worker (single-threaded)
      pdfjsLib.GlobalWorkerOptions.workerSrc = ''
    }
  }
  return pdfjsLib
}

export async function parsePDF(file: File): Promise<string> {
  const pdfjsLib = await getPdfJs()
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
  const pdf = await loadingTask.promise

  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ')
    pages.push(pageText)
  }

  return pages.join('\n\n')
}

// ─── Word ──────────────────────────────────────────────────────────────────
export async function parseWord(file: File): Promise<string> {
  // mammoth has a browser build with the "browser" package.json field
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  // mammoth's browser entry point follows the same API
  const mod = (mammoth as any).default ?? mammoth
  const result = await mod.extractRawText({ arrayBuffer })
  return result.value as string
}

// ─── Text/Markdown ─────────────────────────────────────────────────────────
export function parseTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string) ?? '')
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'))
    reader.readAsText(file, 'UTF-8')
  })
}

// ─── Dispatcher ────────────────────────────────────────────────────────────
export function detectFileType(
  file: File
): { type: DataSourceType; supported: boolean } {
  const name = file.name.toLowerCase()
  const mime = file.type.toLowerCase()

  if (name.endsWith('.pdf'))                               return { type: 'pdf',      supported: true }
  if (name.endsWith('.docx') || name.endsWith('.doc'))     return { type: 'word',     supported: true }
  if (name.endsWith('.md') || name.endsWith('.markdown'))  return { type: 'markdown', supported: true }
  if (name.endsWith('.txt'))                               return { type: 'text',     supported: true }

  // 画像ファイル
  const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.bmp', '.tiff', '.tif']
  if (IMAGE_EXTS.some((ext) => name.endsWith(ext)) || mime.startsWith('image/'))
    return { type: 'image', supported: true }

  return { type: 'text', supported: false }
}

export async function parseFile(
  file: File
): Promise<{ content: string; type: DataSourceType }> {
  const { type, supported } = detectFileType(file)
  if (!supported)
    throw new Error(`対応していないファイル形式です: ${file.name}`)

  // 画像は呼び出し元（DataSourceView）で別途OCR処理
  if (type === 'image') return { content: '', type }

  let content: string
  switch (type) {
    case 'pdf':
      content = await parsePDF(file)
      break
    case 'word':
      content = await parseWord(file)
      break
    default:
      content = await parseTextFile(file)
  }

  return { content, type }
}
