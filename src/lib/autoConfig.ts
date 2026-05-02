import type { ExamLevel, GenerationConfig, QuestionType } from '../types'

export const GENERATION_MODES = [
  { id: 'individual', label: '一問一答', icon: '📝', note: '独立した問題をまとめて作成' },
  { id: 'passage', label: '長文', icon: '📖', note: 'リード文と複数設問' },
  { id: 'figure', label: '図解', icon: '🔬', note: '図中ラベルを使う設問' },
] as const

export function inferAutoConfig(base: GenerationConfig, selectedText: string): GenerationConfig {
  const hint = `${base.subject}\n${base.additionalInstructions}\n${selectedText}`.toLowerCase()
  const wantsFigure = /図|グラフ|表|模式|ラベル|構造|断面|系統|循環|フロー|過程|細胞|器官|figure|diagram|chart|graph/.test(hint)
  const wantsPassage = selectedText.length > 3200 || /本文|長文|資料文|読解|考察|実験|会話文|article|passage/.test(hint)
  const generationMode = wantsFigure ? 'figure' : wantsPassage ? 'passage' : 'individual'
  const hasCurriculum = base.curriculumStage !== 'none'
  const levels: ExamLevel[] = base.levels.length > 0 ? base.levels : (hasCurriculum ? ['high_exam', 'csat'] : ['high_exam'])
  const questionTypes: QuestionType[] =
    generationMode === 'figure'
      ? ['multiple_choice_4', 'fill_blank', 'short_answer']
      : generationMode === 'passage'
        ? ['multiple_choice_4', 'short_answer', 'essay']
        : selectedText.length > 1400
          ? ['multiple_choice_4', 'fill_blank', 'short_answer']
          : ['fill_blank', 'short_answer', 'true_false']

  return {
    ...base,
    generationMode,
    levels,
    questionTypes,
    count: generationMode === 'individual' ? (selectedText.length > 2500 ? 15 : 10) : base.count,
    passageCount: generationMode === 'figure' ? 2 : generationMode === 'passage' ? 1 : base.passageCount,
    questionsPerPassage: generationMode === 'figure' ? 4 : generationMode === 'passage' ? 5 : base.questionsPerPassage,
    additionalInstructions: base.additionalInstructions || (
      generationMode === 'figure'
        ? '重要概念を図のラベルと対応させ、図を見ないと解けない設問を優先してください。'
        : generationMode === 'passage'
          ? '資料文の内容を根拠にして答える設問を中心に、知識確認と考察問題を混ぜてください。'
          : '重要語句の確認だけでなく、概念の理解を問う問題も混ぜてください。'
    ),
  }
}
