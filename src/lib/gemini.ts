import { GoogleGenerativeAI } from '@google/generative-ai'
import { v4 as uuidv4 } from 'uuid'
import type { Question, PassageSet, GenerationConfig, ExamLevel, QuestionType } from '../types'
import { buildGenerationPrompt, buildPassagePrompt } from './prompts'

// ─── JSON抽出ヘルパー ────────────────────────────────────────────────────
function extractJSON(text: string): unknown {
  // 1. そのままparseを試みる
  try { return JSON.parse(text) } catch { /* ignore */ }
  // 2. マークダウンコードブロック内を試みる
  const mdMatch = text.match(/```(?:json)?\s*([\s\S]+?)```/)
  if (mdMatch) { try { return JSON.parse(mdMatch[1]) } catch { /* ignore */ } }
  // 3. 最初の { から最後の } を切り出す
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)) } catch { /* ignore */ }
  }
  const preview = text.slice(0, 300).replace(/\n/g, ' ')
  throw new Error(`AIからの応答をJSONとして解析できませんでした。\n\n[受信内容の先頭]: ${preview}`)
}

// ─── Uint8Array → base64 (スタックオーバーフロー対策) ─────────────────────
function uint8ToBase64(arr: Uint8Array): string {
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode(...arr.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// ─── 画像 OCR ─────────────────────────────────────────────────────────────
export async function extractTextFromImage(
  apiKey: string,
  modelName: string,
  file: File
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: modelName })

  const arrayBuffer = await file.arrayBuffer()
  const base64 = uint8ToBase64(new Uint8Array(arrayBuffer))
  const mimeType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/heic' | 'image/heif'

  const result = await model.generateContent([
    {
      inlineData: { data: base64, mimeType },
    },
    'この画像に写っているすべてのテキスト・数式・図の説明・表の内容を日本語で詳細に抽出してください。学習資料として問題生成に使用します。図や表がある場合は内容を文章で説明してください。',
  ])

  return result.response.text()
}

// ─── 問題生成 ──────────────────────────────────────────────────────────────

export async function generateQuestions(
  apiKey: string,
  modelName: string,
  sources: Array<{ name: string; content: string }>,
  config: GenerationConfig,
  onProgress?: (msg: string) => void
): Promise<Question[]> {
  if (!apiKey) throw new Error('Gemini APIキーが設定されていません')
  if (sources.length === 0) throw new Error('データソースが選択されていません')

  onProgress?.('Gemini APIに接続中...')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.8,
      maxOutputTokens: 32768,
    },
  })

  const sourceTexts = sources.map((s) => `=== ${s.name} ===\n${s.content}`)
  const prompt = buildGenerationPrompt(sourceTexts, config)

  onProgress?.('AIが問題を生成中...')

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  onProgress?.('レスポンスを解析中...')

  let parsed: { questions: unknown[] }
  try {
    parsed = extractJSON(text) as { questions: unknown[] }
  } catch (err) {
    throw err
  }

  if (!Array.isArray(parsed.questions)) {
    throw new Error('無効なレスポンス形式です')
  }

  const defaultLevel = config.levels[0] ?? 'high_exam'
  const now = new Date().toISOString()

  return parsed.questions.map((q: any) => ({
    id: uuidv4(),
    type: (q.type as QuestionType) ?? 'multiple_choice_4',
    level: (q.level as ExamLevel) ?? defaultLevel,
    subject: String(q.subject ?? config.subject ?? ''),
    content: String(q.content ?? ''),
    choices: Array.isArray(q.choices) ? q.choices : undefined,
    correctAnswer: String(q.correctAnswer ?? q.correct_answer ?? ''),
    explanation: String(q.explanation ?? ''),
    tags: Array.isArray(q.tags) ? q.tags.map(String) : [],
    createdAt: now,
    checked: false,
  }))
}

// ─── 長文問題セット生成 ────────────────────────────────────────────────────
export async function generatePassageSets(
  apiKey: string,
  modelName: string,
  sources: Array<{ name: string; content: string }>,
  config: GenerationConfig,
  onProgress?: (msg: string) => void
): Promise<PassageSet[]> {
  if (!apiKey) throw new Error('Gemini APIキーが設定されていません')
  if (sources.length === 0) throw new Error('データソースが選択されていません')

  onProgress?.('Gemini APIに接続中...')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.8,
      maxOutputTokens: 32768,
    },
  })

  const sourceTexts = sources.map((s) => `=== ${s.name} ===\n${s.content}`)
  const prompt = buildPassagePrompt(sourceTexts, config)

  onProgress?.('AIが長文問題を生成中...')

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  onProgress?.('レスポンスを解析中...')

  let parsed: { passage_sets: unknown[] }
  try {
    parsed = extractJSON(text) as { passage_sets: unknown[] }
  } catch (err) {
    throw err
  }

  if (!Array.isArray(parsed.passage_sets)) {
    throw new Error('無効なレスポンス形式です')
  }

  const defaultLevel = config.levels[0] ?? 'high_exam'
  const now = new Date().toISOString()

  return parsed.passage_sets.map((ps: any) => ({
    id: uuidv4(),
    title: String(ps.title ?? '長文読解問題'),
    passage: String(ps.passage ?? ''),
    level: (ps.level as ExamLevel) ?? defaultLevel,
    subject: String(ps.subject ?? config.subject ?? ''),
    checked: false,
    createdAt: now,
    questions: Array.isArray(ps.questions)
      ? ps.questions.map((q: any, i: number) => ({
          id: uuidv4(),
          questionNumber: Number(q.question_number ?? i + 1),
          type: (q.type as QuestionType) ?? 'multiple_choice_4',
          content: String(q.content ?? ''),
          choices: Array.isArray(q.choices) ? q.choices : undefined,
          correctAnswer: String(q.correctAnswer ?? q.correct_answer ?? ''),
          explanation: String(q.explanation ?? ''),
          tags: Array.isArray(q.tags) ? q.tags.map(String) : [],
        }))
      : [],
  }))
}
