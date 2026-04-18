// ─────────────────────────────────────────────
//  試験レベル
// ─────────────────────────────────────────────
export type ExamLevel =
  | 'middle_exam'
  | 'high_exam'
  | 'csat'
  | 'private_univ'
  | 'national_univ'
  | 'grad_school'
  | 'qualification'
  | 'custom'

export interface ExamLevelConfig {
  id: ExamLevel
  label: string
  emoji: string
  description: string
}

export const EXAM_LEVEL_CONFIGS: ExamLevelConfig[] = [
  { id: 'middle_exam',   label: '中学定期考査', emoji: '🏫', description: '基礎的な用語・概念の確認' },
  { id: 'high_exam',     label: '高校定期考査', emoji: '📚', description: '教科書内容の理解・応用' },
  { id: 'csat',          label: '共通テスト',   emoji: '🎯', description: '思考力・読解力・図表解析' },
  { id: 'private_univ',  label: '私大入試',     emoji: '🏛️', description: '正確な知識と応用力' },
  { id: 'national_univ', label: '国公立入試',   emoji: '🎓', description: '記述・論述・高度な思考力' },
  { id: 'grad_school',   label: '大学院入試',   emoji: '🔬', description: '専門的な分析・研究理解' },
  { id: 'qualification', label: '資格試験',     emoji: '📜', description: '実務・専門知識' },
  { id: 'custom',        label: 'カスタム',     emoji: '✏️', description: '自由に指定' },
]

// ─────────────────────────────────────────────
//  問題形式
// ─────────────────────────────────────────────
export type QuestionType =
  | 'multiple_choice_4'
  | 'multiple_choice_5'
  | 'fill_blank'
  | 'short_answer'
  | 'essay'
  | 'true_false'
  | 'calculation'

export interface QuestionTypeConfig {
  id: QuestionType
  label: string
  emoji: string
  description: string
}

export const QUESTION_TYPE_CONFIGS: QuestionTypeConfig[] = [
  { id: 'multiple_choice_4', label: '4択選択',  emoji: '🔵', description: '4つの選択肢から正答を選ぶ' },
  { id: 'multiple_choice_5', label: '5択選択',  emoji: '🟣', description: '5つの選択肢から正答を選ぶ' },
  { id: 'fill_blank',        label: '穴埋め',   emoji: '📝', description: '空欄に適切な語句を入れる' },
  { id: 'short_answer',      label: '短答記述', emoji: '✍️', description: '1〜3文で簡潔に答える' },
  { id: 'essay',             label: '論述',     emoji: '📄', description: '4文以上で論理的に答える' },
  { id: 'true_false',        label: '正誤判定', emoji: '⭕', description: '正しいか誤りかを判断する' },
  { id: 'calculation',       label: '計算問題', emoji: '🔢', description: '計算・数式を用いて解く' },
]

// ─────────────────────────────────────────────
//  データソース
// ─────────────────────────────────────────────
export type DataSourceType = 'markdown' | 'pdf' | 'word' | 'text' | 'paste' | 'image'

export interface DataSource {
  id: string
  type: DataSourceType
  name: string
  content: string
  size: number
  addedAt: string
  selected: boolean
}

// ─────────────────────────────────────────────
//  問題
// ─────────────────────────────────────────────
export interface Choice {
  label: string
  text: string
}

export interface Question {
  id: string
  type: QuestionType
  level: ExamLevel
  subject: string
  content: string
  choices?: Choice[]
  correctAnswer: string
  explanation: string
  tags: string[]
  createdAt: string
  checked: boolean
}

// ─────────────────────────────────────────────
//  長文問題セット
// ─────────────────────────────────────────────
export interface SubQuestion {
  id: string
  questionNumber: number
  type: QuestionType
  content: string
  choices?: Choice[]
  correctAnswer: string
  explanation: string
  tags: string[]
}

export interface PassageSet {
  id: string
  title: string
  passage: string
  level: ExamLevel
  subject: string
  questions: SubQuestion[]
  createdAt: string
  checked: boolean
}

// ─────────────────────────────────────────────
//  生成設定
// ─────────────────────────────────────────────
export interface GenerationConfig {
  generationMode: 'individual' | 'passage'
  levels: ExamLevel[]
  customLevel: string
  questionTypes: QuestionType[]
  count: number
  passageCount: number
  questionsPerPassage: number
  subject: string
  additionalInstructions: string
}

// ─────────────────────────────────────────────
//  アプリ設定
// ─────────────────────────────────────────────
export interface AppSettings {
  geminiApiKey: string
  geminiModel: string
  googleClientId: string
  googleClientSecret: string
}

export interface GoogleAuthState {
  accessToken: string
  expiresAt: number
}

export type ViewType = 'datasource' | 'generator' | 'questions' | 'settings'
