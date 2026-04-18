import type { ExamLevel, QuestionType, GenerationConfig } from '../types'

export const LEVEL_DESCRIPTIONS: Record<ExamLevel, string> = {
  middle_exam:   '中学校定期考査レベル（基礎的な用語・概念の確認、教科書の範囲内）',
  high_exam:     '高校定期考査レベル（教科書内容の理解と標準的な応用）',
  csat:          '大学入学共通テストレベル（思考力・判断力・表現力、図表や長文の読解を重視）',
  private_univ:  '私立大学入試レベル（正確な知識と応用力、やや高難度）',
  national_univ: '国公立大学二次試験レベル（高度な記述・論述・深い思考力）',
  grad_school:   '大学院入試レベル（専門的な分析・研究理解・最新トピック）',
  qualification: '資格試験レベル（実務・専門分野の体系的な知識）',
  custom:        'カスタムレベル',
}

export const TYPE_DESCRIPTIONS: Record<QuestionType, string> = {
  multiple_choice_4: '4択選択問題（choicesフィールドにA〜D の4要素を必ず含める）',
  multiple_choice_5: '5択選択問題（choicesフィールドにA〜E の5要素を必ず含める）',
  fill_blank:        '空欄補充問題（問題文に【　　】で空欄を示す、correctAnswerは補充すべき語句）',
  short_answer:      '短答記述問題（1〜3文での簡潔な回答）',
  essay:             '論述問題（4文以上・採点キーワードをcorrectAnswerに含める）',
  true_false:        '正誤判定問題（correctAnswerは "正" か "誤"、誤の場合は正しい説明も解説に含める）',
  calculation:       '計算・数式問題（途中過程を含む解説を書く）',
}

function buildLevelPart(config: GenerationConfig): string {
  return config.levels
    .map((l) =>
      l === 'custom' && config.customLevel
        ? `カスタム: ${config.customLevel}`
        : LEVEL_DESCRIPTIONS[l]
    )
    .join('\n  ・')
}

function buildTypePart(config: GenerationConfig): string {
  return config.questionTypes
    .map((t) => `${t}: ${TYPE_DESCRIPTIONS[t]}`)
    .join('\n  ・')
}

// ─── 一問一答プロンプト ────────────────────────────────────────────────────
export function buildGenerationPrompt(
  sourceTexts: string[],
  config: GenerationConfig
): string {
  const levelPart = buildLevelPart(config)
  const typePart  = buildTypePart(config)
  const combined  = sourceTexts.join('\n\n---\n\n').slice(0, 80000)

  return `あなたは優秀な教育コンテンツ作成の専門家です。
以下の学習資料をよく読み、指定された条件で試験問題を生成してください。

═══ 学習資料 ═══
${combined}

═══ 生成条件 ═══
・問題数: ${config.count}問（必ずこの数を生成すること）
・対象レベル:
  ・${levelPart}
・問題形式（以下の中から指定のものを使用）:
  ・${typePart}${config.subject ? `\n・科目・テーマ: ${config.subject}` : ''}${config.additionalInstructions ? `\n・追加指示: ${config.additionalInstructions}` : ''}

═══ 出力フォーマット ═══
JSONのみを出力してください。前後に説明文や\`\`\`は不要です。

{
  "questions": [
    {
      "type": "（上記形式のidのいずれか）",
      "content": "問題文（完全な文章）",
      "choices": [
        {"label": "A", "text": "選択肢の内容"},
        {"label": "B", "text": "選択肢の内容"},
        {"label": "C", "text": "選択肢の内容"},
        {"label": "D", "text": "選択肢の内容"}
      ],
      "correctAnswer": "正解（選択問題はラベル例: A、記述は解答文）",
      "explanation": "詳細な解説（なぜその答えか、背景知識も含める）",
      "subject": "科目・テーマ名",
      "tags": ["キーワード1", "キーワード2"],
      "level": "（上記レベルのidのいずれか）"
    }
  ]
}

═══ 重要な注意事項 ═══
1. 学習資料の内容に基づいた正確な問題を作成してください
2. 選択問題は紛らわしい選択肢も含め、理解度を問うものにしてください
3. 解説は背景知識や関連事項も含め詳しく書いてください
4. 指定レベルに応じた難易度・語彙・出題形式を使用してください
5. 選択問題以外はchoicesフィールドを含めないでください
6. 問題数は必ず${config.count}問にしてください
`
}

// ─── 長文読解問題プロンプト ────────────────────────────────────────────────
export function buildPassagePrompt(
  sourceTexts: string[],
  config: GenerationConfig
): string {
  const levelPart = buildLevelPart(config)
  const typePart  = buildTypePart(config)
  const combined  = sourceTexts.join('\n\n---\n\n').slice(0, 80000)

  return `あなたは優秀な教育コンテンツ作成の専門家です。
以下の学習資料をよく読み、「長文読解型・長文総合問題」を生成してください。
リード文（本文）を先に提示し、それに基づく複数の設問を作成するスタイルです。

═══ 学習資料 ═══
${combined}

═══ 生成条件 ═══
・長文セット数: ${config.passageCount}セット（必ずこの数を生成すること）
・各セットの設問数: ${config.questionsPerPassage}問
・対象レベル:
  ・${levelPart}
・設問形式（各設問に使用。複数形式をバランスよく配分）:
  ・${typePart}${config.subject ? `\n・科目・テーマ: ${config.subject}` : ''}${config.additionalInstructions ? `\n・追加指示: ${config.additionalInstructions}` : ''}

═══ 出力フォーマット ═══
JSONのみを出力してください。前後に説明文や\`\`\`は不要です。

{
  "passage_sets": [
    {
      "title": "次の文章を読んで、以下の問いに答えなさい。",
      "passage": "リード文（本文）。学習資料の重要な概念・事実・論点を含む400〜800字程度の文章。必要に応じて下線部①②…や空欄【A】【B】を設けて各設問と対応させる。",
      "subject": "科目・テーマ名",
      "level": "（レベルのidのいずれか）",
      "questions": [
        {
          "question_number": 1,
          "type": "（問題形式のidのいずれか）",
          "content": "問１　本文中の下線部①について…（本文を読まないと解けない問いにする）",
          "choices": [
            {"label": "A", "text": "選択肢の内容"},
            {"label": "B", "text": "選択肢の内容"},
            {"label": "C", "text": "選択肢の内容"},
            {"label": "D", "text": "選択肢の内容"}
          ],
          "correctAnswer": "A",
          "explanation": "詳細な解説（本文のどの記述に基づくか明示する）",
          "tags": ["キーワード"]
        }
      ]
    }
  ]
}

═══ 重要な注意事項 ═══
1. 各設問は必ず本文（リード文）の内容を読まなければ解けない問いにしてください
2. 本文には下線部①②…や空欄【A】【B】などを設けて設問と対応させてください
3. 選択問題のchoicesは選択問題にのみ含め、記述問題には含めないでください
4. 各長文セットの設問数は必ず${config.questionsPerPassage}問にしてください
5. 長文セット数は必ず${config.passageCount}セットにしてください
6. 設問形式は指定された形式をバランスよく使い分けてください
`
}
