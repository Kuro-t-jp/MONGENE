import type { GenerationConfig } from '../types'

export interface Template {
  id: string
  name: string
  emoji: string
  description: string
  tags: string[]
  accent: string       // CSS グラデーション
  config: Partial<GenerationConfig>
}

export const TEMPLATES: Template[] = [
  {
    id: 'teiki_standard',
    name: '定期考査 標準セット',
    emoji: '📚',
    description: '教科書の理解度を確認する定番問題。4択・空欄補充・短答をバランスよく出題。',
    tags: ['高校定期考査', '標準'],
    accent: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    config: {
      generationMode: 'individual',
      levels: ['high_exam'],
      questionTypes: ['multiple_choice_4', 'fill_blank', 'short_answer'],
      count: 20,
      additionalInstructions: '教科書の基本事項を中心に、重要語句・しくみ・働きを問う問題を作成してください。',
    },
  },
  {
    id: 'csat_prep',
    name: '共通テスト対策',
    emoji: '🎯',
    description: '思考力・図表読解を重視した共通テスト型。正誤判定・5択を含む。',
    tags: ['共通テスト', '思考力'],
    accent: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    config: {
      generationMode: 'individual',
      levels: ['csat'],
      questionTypes: ['multiple_choice_4', 'multiple_choice_5', 'true_false'],
      count: 15,
      additionalInstructions: '図や表の読み取り・考察・データ解釈を含む問題を優先してください。正誤判定は紛らわしい誤文を含めてください。',
    },
  },
  {
    id: 'figure_biology',
    name: '図解・ラベル問題',
    emoji: '🔬',
    description: '「次の図を見て答えよ」形式。細胞・器官・過程の図解問題に最適。',
    tags: ['図解問題', '共通テスト'],
    accent: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    config: {
      generationMode: 'figure',
      levels: ['csat', 'high_exam'],
      questionTypes: ['multiple_choice_4', 'fill_blank', 'short_answer'],
      passageCount: 3,
      questionsPerPassage: 4,
      additionalInstructions: '系統図・過程図・断面図など図の種類を多様にしてください。',
    },
  },
  {
    id: 'passage_biology',
    name: '長文読解・総合問題',
    emoji: '📖',
    description: 'リード文を読んで複数の設問に答える形式。私大・国公立二次向け。',
    tags: ['長文問題', '私大入試'],
    accent: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    config: {
      generationMode: 'passage',
      levels: ['private_univ', 'csat'],
      questionTypes: ['multiple_choice_4', 'short_answer', 'essay'],
      passageCount: 2,
      questionsPerPassage: 5,
      additionalInstructions: '本文は400〜600字で、重要概念を含む考察型の文章にしてください。',
    },
  },
  {
    id: 'flash_cards',
    name: '一問一答 速攻',
    emoji: '⚡',
    description: '用語・定義を素早く確認。空欄補充・短答で重要語句を徹底定着。',
    tags: ['定期考査', '用語確認'],
    accent: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
    config: {
      generationMode: 'individual',
      levels: ['high_exam', 'middle_exam'],
      questionTypes: ['fill_blank', 'short_answer'],
      count: 30,
      additionalInstructions: '重要語句・定義・名称を問う短い問題を作成してください。解説は簡潔に。',
    },
  },
  {
    id: 'essay_practice',
    name: '記述・論述練習',
    emoji: '✏️',
    description: '「理由を説明せよ」「違いを述べよ」形式の論述練習。国公立二次に対応。',
    tags: ['国公立二次', '記述'],
    accent: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
    config: {
      generationMode: 'individual',
      levels: ['national_univ', 'private_univ'],
      questionTypes: ['essay', 'short_answer'],
      count: 10,
      additionalInstructions: '「なぜか」「どのように」「違いを述べよ」など思考を問う論述問題を中心に作成してください。採点基準となるキーワードを解説に含めてください。',
    },
  },
  {
    id: 'biology_basic_review',
    name: '生物基礎 総まとめ',
    emoji: '🌿',
    description: '生物基礎の学習指導要領に準拠した総復習。全単元をカバー。',
    tags: ['生物基礎', '定期考査', '共通テスト'],
    accent: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    config: {
      generationMode: 'individual',
      levels: ['high_exam', 'csat'],
      questionTypes: ['multiple_choice_4', 'fill_blank', 'true_false'],
      count: 25,
      curriculumStage: 'high_biology_basic',
      additionalInstructions: '生物基礎の全単元をバランスよくカバーしてください。',
    },
  },
  {
    id: 'biology_advanced',
    name: '生物 応用問題',
    emoji: '🧬',
    description: '生物（発展）の考察・計算・遺伝を含む応用問題。',
    tags: ['生物', '応用', '私大入試'],
    accent: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
    config: {
      generationMode: 'individual',
      levels: ['private_univ', 'csat'],
      questionTypes: ['multiple_choice_4', 'short_answer', 'calculation'],
      count: 15,
      curriculumStage: 'high_biology',
      additionalInstructions: '遺伝計算・実験考察・グラフ読み取りを含む応用問題を作成してください。',
    },
  },
]
