import type { ExamLevel, QuestionType, GenerationConfig } from '../types'
import { CURRICULUM_STAGE_CONFIGS } from '../types'

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

function buildCurriculumPart(config: GenerationConfig): string {
  if (config.curriculumStage === 'none') return ''
  const conf = CURRICULUM_STAGE_CONFIGS.find((c) => c.id === config.curriculumStage)
  if (!conf) return ''
  const allUnits = conf.chapters.flatMap((ch) => ch.units)
  const unitList = allUnits.length ? `\n    主要小単元: ${allUnits.join('、')}` : ''
  return `・学習指導要領準拠: 文部科学省「令和3年度告示 学習指導要領」高等学校 ${conf.label} に準拠すること
・範囲遵守: 問題内容・語彙・難易度・扱う概念を ${conf.label} の学習指導要領の目標・内容の範囲内に収めること${unitList}
・教科書準拠: ${conf.label} で使用される用語・表記法・単位系を使用すること`
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
  const levelPart      = buildLevelPart(config)
  const typePart       = buildTypePart(config)
  const curriculumPart = buildCurriculumPart(config)
  const combined       = sourceTexts.join('\n\n---\n\n').slice(0, 80000)
  const hasSource      = combined.trim().length > 0

  return `あなたは優秀な教育コンテンツ作成の専門家です。
${hasSource
  ? `以下の学習資料をよく読み、指定された条件で試験問題を生成してください。

═══ 学習資料 ═══
${combined}`
  : `指定された条件に基づいて、教科書・学習指導要領の知識を活用し試験問題を生成してください。`}

═══ 生成条件 ═══
・問題数: ${config.count}問（必ずこの数を生成すること）
・対象レベル:
  ・${levelPart}
・問題形式（以下の中から指定のものを使用）:
  ・${typePart}${config.subject ? `\n・科目・テーマ: ${config.subject}` : ''}${curriculumPart ? `\n${curriculumPart}` : ''}${config.additionalInstructions ? `\n・追加指示: ${config.additionalInstructions}` : ''}

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
1. ${hasSource ? '学習資料の内容に基づいた正確な問題を作成してください' : '学習指導要領の範囲・教科書の内容に基づいた正確な問題を作成してください'}
2. 選択問題は紛らわしい選択肢も含め、理解度を問うものにしてください
3. 解説は背景知識や関連事項も含め詳しく書いてください
4. 指定レベルに応じた難易度・語彙・出題形式を使用してください
5. 選択問題以外はchoicesフィールドを含めないでください
6. 問題数は必ず${config.count}問にしてください
`
}

// ─── 図解問題プロンプト ────────────────────────────────────────────────────
export function buildFigurePrompt(
  sourceTexts: string[],
  config: GenerationConfig
): string {
  const levelPart      = buildLevelPart(config)
  const typePart       = buildTypePart(config)
  const curriculumPart = buildCurriculumPart(config)
  const combined       = sourceTexts.join('\n\n---\n\n').slice(0, 80000)
  const hasSource      = combined.trim().length > 0

  return `あなたは優秀な教育コンテンツ作成の専門家です。
${hasSource
  ? `以下の学習資料をよく読み、「図解問題形式」の問題セットを生成してください。

═══ 学習資料 ═══
${combined}`
  : `指定された条件に基づいて、教科書・学習指導要領の知識を活用し「図解問題形式」の問題セットを生成してください。`}

═══ 図解問題形式とは ═══
実際の試験でよく出る以下のような形式です：
・「次の図は〜を示したものである。以下の問いに答えよ。」で始まる設問文
・図中の各要素に (a)(b)(c)… または ①②③… のラベルを付ける
・設問はそのラベルを参照して問う（「(a)の名称を答えよ」「①と②の違いを述べよ」など）
・図の種類例：系統図、過程図、循環図、比較図、断面図、フローチャート、表、グラフ

═══ 生成条件 ═══
・問題セット数: ${config.passageCount}セット（必ずこの数を生成すること）
・各セットの設問数: ${config.questionsPerPassage}問
・対象レベル:
  ・${levelPart}
・設問形式（各設問に使用。複数形式をバランスよく配分）:
  ・${typePart}${config.subject ? `\n・科目・テーマ: ${config.subject}` : ''}${curriculumPart ? `\n${curriculumPart}` : ''}${config.additionalInstructions ? `\n・追加指示: ${config.additionalInstructions}` : ''}

═══ 出力フォーマット ═══
JSONのみを出力してください。前後に説明文や\`\`\`は不要です。

{
  "passage_sets": [
    {
      "title": "問題タイトル（例：「真核細胞の進化」「光合成の過程」など単元名）",
      "figure_type": "図の種類（例：過程図・系統図・循環図・比較図・断面図）",
      "passage": "次の図は〜を示したものである。\\n\\n【図の説明】\\n(a)〜(f) などのラベルを付けた図の詳細な文章説明。各ラベルが何を指すかを文章で示す。実際の試験では図が描かれるが、ここでは文章で図の内容を表現する。\\n\\n上記の図について、以下の問いに答えよ。",
      "subject": "科目・テーマ名",
      "level": "（レベルのidのいずれか）",
      "questions": [
        {
          "question_number": 1,
          "type": "（問題形式のidのいずれか）",
          "content": "問１　図中の(a)は何という〜か答えよ。",
          "choices": [
            {"label": "A", "text": "選択肢"},
            {"label": "B", "text": "選択肢"},
            {"label": "C", "text": "選択肢"},
            {"label": "D", "text": "選択肢"}
          ],
          "correctAnswer": "A",
          "explanation": "詳細な解説（図のどの部分に基づくか明示する）",
          "tags": ["キーワード"]
        }
      ]
    }
  ]
}

═══ 重要な注意事項 ═══
1. passageフィールドには「次の図は〜」で始まる図の設定文と説明を必ず含めること
2. (a)(b)(c) などのラベルは passage と questions の両方で一致させること
3. 各設問は必ず図のラベルを参照した問いにすること
4. figure_typeには図の種類を必ず記入すること
5. 選択問題のchoicesは選択問題にのみ含め、記述問題には含めないこと
6. 問題セット数は必ず${config.passageCount}セット、各セットの設問数は必ず${config.questionsPerPassage}問にすること
`
}

// ─── 長文読解問題プロンプト ────────────────────────────────────────────────
export function buildPassagePrompt(
  sourceTexts: string[],
  config: GenerationConfig
): string {
  const levelPart      = buildLevelPart(config)
  const typePart       = buildTypePart(config)
  const curriculumPart = buildCurriculumPart(config)
  const combined       = sourceTexts.join('\n\n---\n\n').slice(0, 80000)
  const hasSource      = combined.trim().length > 0

  return `あなたは優秀な教育コンテンツ作成の専門家です。
${hasSource
  ? `以下の学習資料をよく読み、「長文読解型・長文総合問題」を生成してください。
リード文（本文）を先に提示し、それに基づく複数の設問を作成するスタイルです。

═══ 学習資料 ═══
${combined}`
  : `指定された条件に基づいて、教科書・学習指導要領の知識を活用し「長文読解型・長文総合問題」を生成してください。
リード文（本文）を先に作成し、それに基づく複数の設問を作成するスタイルです。`}

═══ 生成条件 ═══
・長文セット数: ${config.passageCount}セット（必ずこの数を生成すること）
・各セットの設問数: ${config.questionsPerPassage}問
・対象レベル:
  ・${levelPart}
・設問形式（各設問に使用。複数形式をバランスよく配分）:
  ・${typePart}${config.subject ? `\n・科目・テーマ: ${config.subject}` : ''}${curriculumPart ? `\n${curriculumPart}` : ''}${config.additionalInstructions ? `\n・追加指示: ${config.additionalInstructions}` : ''}

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
