import { GoogleGenerativeAI } from '@google/generative-ai'
import { v4 as uuidv4 } from 'uuid'
import type { Question, PassageSet, GenerationConfig, ExamLevel, QuestionType } from '../types'
import { buildGenerationPrompt, buildPassagePrompt, buildFigurePrompt } from './prompts'

// ─── リトライ付き generateContent ──────────────────────────────────────────
async function generateWithRetry(
  model: ReturnType<InstanceType<typeof GoogleGenerativeAI>['getGenerativeModel']>,
  prompt: Parameters<typeof model.generateContent>[0],
  maxRetries = 4,
  onProgress?: (msg: string) => void
) {
  let lastError: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await model.generateContent(prompt)
    } catch (err: any) {
      const msg: string = err?.message ?? ''
      const is503 = msg.includes('503') || msg.includes('high demand') || msg.includes('overloaded')
      if (!is503 || attempt === maxRetries - 1) throw err
      const wait = Math.round((2 ** attempt) * 3000 + Math.random() * 1000)
      onProgress?.(`⏳ モデルが混雑中。${Math.round(wait / 1000)}秒後に再試行... (${attempt + 1}/${maxRetries - 1})`)
      await new Promise((r) => setTimeout(r, wait))
      lastError = err
    }
  }
  throw lastError
}

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

// ─── 途中切れJSON から完成オブジェクトを回収 ──────────────────────────────
function extractCompleteObjects(text: string, arrayKey: string): unknown[] {
  const keyIdx = text.indexOf(`"${arrayKey}"`)
  if (keyIdx === -1) return []
  const arrStart = text.indexOf('[', keyIdx)
  if (arrStart === -1) return []

  const objects: unknown[] = []
  let i = arrStart + 1
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i++
    if (i >= text.length || text[i] === ']') break
    if (text[i] !== '{') break
    let depth = 0, j = i, inStr = false, escaped = false
    while (j < text.length) {
      const c = text[j]
      if (escaped) { escaped = false }
      else if (c === '\\' && inStr) { escaped = true }
      else if (c === '"') { inStr = !inStr }
      else if (!inStr) {
        if (c === '{') depth++
        else if (c === '}') {
          depth--
          if (depth === 0) {
            try { objects.push(JSON.parse(text.slice(i, j + 1))) } catch { /* malformed */ }
            i = j + 1
            break
          }
        }
      }
      j++
    }
    if (j >= text.length && depth > 0) break // 途中で切れた
  }
  return objects
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

  const result = await generateWithRetry(
    model,
    [
      { inlineData: { data: base64, mimeType } },
      'この画像に写っているすべてのテキスト・数式・図の説明・表の内容を日本語で詳細に抽出してください。学習資料として問題生成に使用します。図や表がある場合は内容を文章で説明してください。',
    ]
  )

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
  onProgress?.('Gemini APIに接続中...')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.8,
      maxOutputTokens: 65536,
    },
  })

  const sourceTexts = sources.map((s) => `=== ${s.name} ===\n${s.content}`)
  const prompt = buildGenerationPrompt(sourceTexts, config)

  onProgress?.('AIが問題を生成中...')

  const result = await generateWithRetry(model, prompt, 4, onProgress)
  const text = result.response.text()
  const finishReason = result.response.candidates?.[0]?.finishReason

  onProgress?.('レスポンスを解析中...')

  let questions: unknown[]
  if (finishReason === 'MAX_TOKENS') {
    // 出力が打ち切られた場合、完成したquestionだけ部分回収
    questions = extractCompleteObjects(text, 'questions')
    if (questions.length === 0) throw new Error('AIの出力がトークン上限で打ち切られ、問題を取得できませんでした。問題数を減らして再試行してください。')
    onProgress?.(`⚠️ 出力が打ち切られました。回収できた問題: ${questions.length}件`)
  } else {
    let parsed: { questions: unknown[] }
    try {
      parsed = extractJSON(text) as { questions: unknown[] }
    } catch (err) {
      throw err
    }
    if (!Array.isArray(parsed.questions)) throw new Error('無効なレスポンス形式です')
    questions = parsed.questions
  }

  const defaultLevel = config.levels[0] ?? 'high_exam'
  const now = new Date().toISOString()

  return questions.map((q: any) => ({
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
  onProgress?.('Gemini APIに接続中...')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.8,
      maxOutputTokens: 65536,
    },
  })

  const sourceTexts = sources.map((s) => `=== ${s.name} ===\n${s.content}`)
  const prompt = buildPassagePrompt(sourceTexts, config)

  onProgress?.('AIが長文問題を生成中...')

  const result = await generateWithRetry(model, prompt, 4, onProgress)
  const text = result.response.text()
  const finishReason = result.response.candidates?.[0]?.finishReason

  onProgress?.('レスポンスを解析中...')

  let passageSets: unknown[]
  if (finishReason === 'MAX_TOKENS') {
    passageSets = extractCompleteObjects(text, 'passage_sets')
    if (passageSets.length === 0) throw new Error('AIの出力がトークン上限で打ち切られ、長文問題セットを取得できませんでした。問題数を減らして再試行してください。')
    onProgress?.(`⚠️ 出力が打ち切られました。回収できたセット: ${passageSets.length}件`)
  } else {
    let parsed: { passage_sets: unknown[] }
    try {
      parsed = extractJSON(text) as { passage_sets: unknown[] }
    } catch (err) {
      throw err
    }
    if (!Array.isArray(parsed.passage_sets)) throw new Error('無効なレスポンス形式です')
    passageSets = parsed.passage_sets
  }

  const defaultLevel = config.levels[0] ?? 'high_exam'
  const now = new Date().toISOString()

  return passageSets.map((ps: any) => ({
    id: uuidv4(),
    title: String(ps.title ?? '長文読解問題'),
    passage: String(ps.passage ?? ''),
    level: (ps.level as ExamLevel) ?? defaultLevel,
    subject: String(ps.subject ?? config.subject ?? ''),
    questionMode: 'passage' as const,
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

// ─── 図解問題セット生成 ────────────────────────────────────────────────────
export async function generateFigureSets(
  apiKey: string,
  modelName: string,
  sources: Array<{ name: string; content: string }>,
  config: GenerationConfig,
  onProgress?: (msg: string) => void
): Promise<PassageSet[]> {
  if (!apiKey) throw new Error('Gemini APIキーが設定されていません')
  onProgress?.('Gemini APIに接続中...')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.7,
      maxOutputTokens: 65536,
    },
  })

  const sourceTexts = sources.map((s) => `=== ${s.name} ===\n${s.content}`)
  const prompt = buildFigurePrompt(sourceTexts, config)

  onProgress?.('AIが図解問題を生成中...')

  const result = await generateWithRetry(model, prompt, 4, onProgress)
  const text = result.response.text()
  const finishReason = result.response.candidates?.[0]?.finishReason

  onProgress?.('レスポンスを解析中...')

  let passageSets: unknown[]
  if (finishReason === 'MAX_TOKENS') {
    passageSets = extractCompleteObjects(text, 'passage_sets')
    if (passageSets.length === 0) throw new Error('AIの出力がトークン上限で打ち切られました。セット数を減らして再試行してください。')
    onProgress?.(`⚠️ 出力が打ち切られました。回収できたセット: ${passageSets.length}件`)
  } else {
    const parsed = extractJSON(text) as { passage_sets: unknown[] }
    if (!Array.isArray(parsed.passage_sets)) throw new Error('無効なレスポンス形式です')
    passageSets = parsed.passage_sets
  }

  const defaultLevel = config.levels[0] ?? 'high_exam'
  const now = new Date().toISOString()

  return passageSets.map((ps: any) => ({
    id: uuidv4(),
    title: String(ps.title ?? '図解問題'),
    passage: String(ps.passage ?? ''),
    figureType: String(ps.figure_type ?? ''),
    questionMode: 'figure' as const,
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
