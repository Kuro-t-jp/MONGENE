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
  { id: 'national_univ', label: '国公立二次',   emoji: '🎓', description: '記述・論述・高度な思考力' },
  { id: 'grad_school',   label: '大学院入試',   emoji: '🔬', description: '専門的な分析・研究理解' },
  { id: 'qualification', label: '資格試験',     emoji: '📜', description: '体系的な実務・専門知識' },
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
  { id: 'fill_blank',        label: '空欄補充', emoji: '📋', description: '空欄に適切な語句を入れる' },
  { id: 'short_answer',      label: '短答記述', emoji: '🖊️', description: '1〜3文で簡潔に答える' },
  { id: 'essay',             label: '論述',     emoji: '📄', description: '4文以上で論理的に答える' },
  { id: 'true_false',        label: '正誤判定', emoji: '⭕', description: '正しいか誤りかを判断する' },
  { id: 'calculation',       label: '計算問題', emoji: '🔢', description: '計算・数式を用いて解く' },
]

// ─────────────────────────────────────────────
//  学習指導要領 教科・科目
// ─────────────────────────────────────────────
export interface CurriculumCourseConfig {
  id: string
  label: string
  units: string[]
}

export interface CurriculumSubjectConfig {
  id: string
  label: string
  emoji: string
  description: string
  courses: CurriculumCourseConfig[]
}

export const CURRICULUM_SUBJECT_CONFIGS: CurriculumSubjectConfig[] = [
  {
    id: 'kokugo',
    label: '国語',
    emoji: '📖',
    description: '現代の国語・言語文化など',
    courses: [
      { id: 'modern_japanese', label: '現代の国語', units: ['話すこと・聞くこと', '書くこと', '読むこと', '論理的な文章', '実用的な文章'] },
      { id: 'language_culture', label: '言語文化', units: ['古典の世界', '近代以降の文章', '言葉の特徴', '伝統的な言語文化'] },
      { id: 'logical_japanese', label: '論理国語', units: ['評論読解', '論理構成', '要約', '資料読解', '小論文'] },
      { id: 'literary_japanese', label: '文学国語', units: ['小説', '随筆', '詩歌', '文学的表現', '作品比較'] },
      { id: 'japanese_expression', label: '国語表現', units: ['文章表現', 'プレゼンテーション', '討論', '実用文'] },
      { id: 'classical_exploration', label: '古典探究', units: ['古文読解', '古典文法', '漢文句法', '和歌・物語', '思想'] },
    ],
  },
  {
    id: 'chireki',
    label: '地理歴史',
    emoji: '🗺️',
    description: '地理総合・歴史総合・探究科目',
    courses: [
      { id: 'geography_general', label: '地理総合', units: ['地図とGIS', '国際理解', '生活文化', '地球的課題', '防災'] },
      { id: 'geography_advanced', label: '地理探究', units: ['自然環境', '資源と産業', '人口と都市', '地誌', '地域調査'] },
      { id: 'history_general', label: '歴史総合', units: ['近代化', '国際秩序の変化', '大衆化', 'グローバル化'] },
      { id: 'japanese_history', label: '日本史探究', units: ['原始・古代', '中世', '近世', '近現代', '史料読解'] },
      { id: 'world_history', label: '世界史探究', units: ['諸地域の歴史', '交流と再編', '近代化', '二つの世界大戦', '現代世界'] },
    ],
  },
  {
    id: 'komin',
    label: '公民',
    emoji: '🏛️',
    description: '公共・倫理・政治経済',
    courses: [
      { id: 'public', label: '公共', units: ['公共的な空間', '人間と社会', '法', '政治', '経済', '国際社会'] },
      { id: 'ethics', label: '倫理', units: ['青年期', '源流思想', '日本思想', '西洋近現代思想', '現代の倫理的課題'] },
      { id: 'politics_economics', label: '政治・経済', units: ['民主政治', '日本国憲法', '国際政治', '市場経済', '財政・金融', '国際経済'] },
    ],
  },
  {
    id: 'sugaku',
    label: '数学',
    emoji: '📐',
    description: '数学I・A・II・B・III・C',
    courses: [
      { id: 'math_i', label: '数学I', units: ['数と式', '図形と計量', '二次関数', 'データの分析'] },
      { id: 'math_a', label: '数学A', units: ['図形の性質', '場合の数と確率', '数学と人間の活動'] },
      { id: 'math_ii', label: '数学II', units: ['いろいろな式', '図形と方程式', '指数関数・対数関数', '三角関数', '微分・積分'] },
      { id: 'math_b', label: '数学B', units: ['数列', '統計的な推測', '数学と社会生活'] },
      { id: 'math_iii', label: '数学III', units: ['極限', '微分法', '積分法'] },
      { id: 'math_c', label: '数学C', units: ['ベクトル', '平面上の曲線と複素数平面', '数学的な表現の工夫'] },
    ],
  },
  {
    id: 'rika',
    label: '理科',
    emoji: '🔬',
    description: '科学と人間生活・基礎科目・発展科目',
    courses: [
      { id: 'science_life', label: '科学と人間生活', units: ['光や熱の科学', '物質の科学', '生命の科学', '宇宙や地球の科学', '課題研究'] },
      { id: 'physics_basic', label: '物理基礎', units: ['運動とエネルギー', '熱', '波', '電気', '物理学と社会'] },
      { id: 'physics', label: '物理', units: ['力学', '熱力学', '波動', '電磁気', '原子'] },
      { id: 'chemistry_basic', label: '化学基礎', units: ['物質の構成', '物質量と化学反応式', '酸と塩基', '酸化還元'] },
      { id: 'chemistry', label: '化学', units: ['物質の状態', '化学反応とエネルギー', '化学平衡', '無機物質', '有機化合物', '高分子化合物'] },
      { id: 'biology_basic', label: '生物基礎', units: ['生物の特徴', '遺伝子とその働き', '体内環境の維持', '生物の多様性と生態系'] },
      { id: 'biology', label: '生物', units: ['生命現象と物質', '遺伝情報の発現と発生', '生殖と遺伝', '進化と系統', '生態と環境', '生命科学と社会'] },
      { id: 'earth_basic', label: '地学基礎', units: ['地球のすがた', '変動する地球', '大気と海洋', '宇宙の構成', '自然災害と環境'] },
      { id: 'earth_science', label: '地学', units: ['地球の概観', '地球の活動', '地球の歴史', '大気と海洋', '宇宙'] },
    ],
  },
  {
    id: 'gaikokugo',
    label: '外国語',
    emoji: '🔤',
    description: '英語コミュニケーション・論理表現',
    courses: [
      { id: 'english_comm_i', label: '英語コミュニケーションI', units: ['聞くこと', '読むこと', '話すこと', '書くこと', '語彙・文法'] },
      { id: 'english_comm_ii', label: '英語コミュニケーションII', units: ['説明文読解', '物語文読解', '意見交換', '発表', '要約'] },
      { id: 'english_comm_iii', label: '英語コミュニケーションIII', units: ['高度な読解', '統合的な言語活動', '発表・討論', '英作文'] },
      { id: 'logic_expression_i', label: '論理・表現I', units: ['話すこと', '書くこと', '文法・語法', '論理構成'] },
      { id: 'logic_expression_ii', label: '論理・表現II', units: ['ディスカッション', 'プレゼンテーション', 'エッセイ', '表現の工夫'] },
      { id: 'logic_expression_iii', label: '論理・表現III', units: ['発信力', '議論', '小論文型英作文', '資料を用いた表現'] },
    ],
  },
  {
    id: 'joho',
    label: '情報',
    emoji: '💻',
    description: '情報I・情報II',
    courses: [
      { id: 'informatics_i', label: '情報I', units: ['情報社会の問題解決', 'コミュニケーションと情報デザイン', 'コンピュータとプログラミング', '情報通信ネットワークとデータ活用'] },
      { id: 'informatics_ii', label: '情報II', units: ['情報社会の進展', 'コミュニケーションとコンテンツ', '情報とデータサイエンス', '情報システムとプログラミング'] },
    ],
  },
  {
    id: 'hoken_taiiku',
    label: '保健体育',
    emoji: '🏃',
    description: '体育・保健',
    courses: [
      { id: 'physical_education', label: '体育', units: ['体つくり運動', '器械運動', '陸上競技', '球技', '武道', 'ダンス', '体育理論'] },
      { id: 'health', label: '保健', units: ['現代社会と健康', '安全な社会生活', '生涯を通じる健康', '健康を支える環境づくり'] },
    ],
  },
  {
    id: 'katei',
    label: '家庭',
    emoji: '🏠',
    description: '家庭基礎・家庭総合',
    courses: [
      { id: 'home_basic', label: '家庭基礎', units: ['人の一生と家族', '衣食住', '消費生活', '持続可能な生活'] },
      { id: 'home_general', label: '家庭総合', units: ['青年期と家族', '子供と高齢者', '食生活', '衣生活', '住生活', '経済生活'] },
    ],
  },
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
  figureType?: string
  questionMode?: 'passage' | 'figure'
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
  generationMode: 'individual' | 'passage' | 'figure'
  levels: ExamLevel[]
  customLevel: string
  questionTypes: QuestionType[]
  count: number
  passageCount: number
  questionsPerPassage: number
  subjectArea: string
  subjectCourse: string
  subjectUnit: string
  subject: string
  additionalInstructions: string
  curriculumStage: CurriculumStage
}

// ─────────────────────────────────────────────
//  学習指導要領
// ─────────────────────────────────────────────
export type CurriculumStage = 'none' | 'high_biology' | 'high_biology_basic'

export interface CurriculumChapter {
  chapter: string   // 大単元
  units: string[]   // 小単元
}

export interface CurriculumStageConfig {
  id: CurriculumStage
  label: string
  emoji: string
  description: string
  chapters: CurriculumChapter[]
}

export const CURRICULUM_STAGE_CONFIGS: CurriculumStageConfig[] = [
  { id: 'none', label: '指定なし', emoji: '', description: '', chapters: [] },
  {
    id: 'high_biology_basic',
    label: '生物基礎',
    emoji: '🌿',
    description: '高校 生物基礎（令和3年度告示）',
    chapters: [
      {
        chapter: '① 生物の特徴',
        units: [
          '生物の共通性と多様性',
          '細胞の構造と機能（原核細胞・真核細胞）',
          '細胞小器官の働き',
          '代謝とATP',
          '酵素の性質と働き',
          '光合成の概要（場と反応）',
          '呼吸の概要（場と反応）',
          '光合成と呼吸の比較',
        ],
      },
      {
        chapter: '② 遺伝子とその働き',
        units: [
          'DNAの構造（ヌクレオチド・二重らせん）',
          'DNAの複製（半保存的複製）',
          '遺伝情報の発現（転写・翻訳）',
          'ゲノムと遺伝子',
          '遺伝子の多様性と共通性',
          'PCR法・電気泳動（基礎）',
        ],
      },
      {
        chapter: '③ 生物の体内環境の維持',
        units: [
          '体液の成分と役割（血液・組織液・リンパ液）',
          '血糖濃度の調節（インスリン・グルカゴン）',
          '体温調節の仕組み',
          '血液凝固',
          '腎臓と尿の生成（ろ過・再吸収）',
          '自然免疫（食作用・炎症）',
          '適応免疫・体液性免疫（抗原・抗体・B細胞）',
          '細胞性免疫（T細胞・NK細胞）',
          'アレルギー・免疫寛容',
          '血液型と輸血',
        ],
      },
      {
        chapter: '④ 生物の多様性と生態系',
        units: [
          '植生と遷移（一次遷移・二次遷移）',
          'バイオームの種類と分布',
          '生態系の構造（生産者・消費者・分解者）',
          '食物連鎖と食物網',
          '炭素循環と窒素循環',
          'エネルギーの流れと生態効率',
          '生物多様性（遺伝的多様性・種多様性・生態系多様性）',
          '外来生物と生態系への影響',
          '生態系の保全と持続可能な利用',
        ],
      },
    ],
  },
  {
    id: 'high_biology',
    label: '生物',
    emoji: '🧬',
    description: '高校 生物（令和3年度告示）',
    chapters: [
      {
        chapter: '① 生命現象と物質',
        units: [
          'タンパク質の構造（アミノ酸・ペプチド・立体構造）',
          '酵素の性質（基質特異性・活性化エネルギー）',
          '酵素反応の調節（競争的阻害・アロステリック）',
          '細胞膜の構造と機能（リン脂質二重層・膜タンパク質）',
          '細胞骨格と細胞運動',
          '呼吸の詳細（解糖系・クエン酸回路・電子伝達系）',
          '発酵（アルコール発酵・乳酸発酵）',
          '光合成の詳細（チラコイド反応・カルビン-ベンソン回路）',
          'C4植物とCAM植物',
        ],
      },
      {
        chapter: '② 遺伝情報の発現と発生',
        units: [
          '転写の詳細（プロモーター・RNAポリメラーゼ）',
          '翻訳の詳細（リボソーム・tRNA・コドン）',
          '遺伝子の発現調節（原核生物：オペロン説）',
          '遺伝子の発現調節（真核生物：転写因子・クロマチン）',
          'エピジェネティクス',
          '細胞の分化と多能性（幹細胞・iPS細胞）',
          '形態形成と形成体（誘導・ホメオボックス遺伝子）',
          '受精と初期発生（卵割・胚葉形成）',
          '器官形成とアポトーシス',
        ],
      },
      {
        chapter: '③ 生殖と遺伝',
        units: [
          '減数分裂の仕組みと意義',
          '配偶子形成（精子形成・卵形成）',
          'メンデルの法則（分離の法則・独立の法則）',
          '検定交雑と遺伝子型の決定',
          '連鎖と組み換え・組み換え価',
          '伴性遺伝（X染色体連鎖）',
          '遺伝子突然変異と染色体突然変異',
          '数量形質と多因子遺伝',
          '集団遺伝（ハーディ・ワインベルグの法則）',
        ],
      },
      {
        chapter: '④ 生物の系統と進化',
        units: [
          '生命の起源（化学進化・原始生命体）',
          '進化の証拠（化石・比較解剖・比較胚）',
          '分子進化と分子系統樹',
          '自然選択説（ダーウィン）と集団遺伝',
          '遺伝的浮動と中立説',
          '種分化（地理的隔離・生殖的隔離）',
          '系統と分類（三ドメイン説・系統樹の見方）',
          '生物の系統（原核生物・真核生物の多様性）',
        ],
      },
      {
        chapter: '⑤ 生態と環境',
        units: [
          '個体群の成長と密度効果',
          '齢構成と生命表・生存曲線',
          '種間競争と競争排除',
          '捕食・被食関係（ロトカ・ボルテラ式）',
          '共生・寄生・相利共生',
          '生態的地位（ニッチ）と群集の構造',
          'キーストーン種と生物多様性',
          '生態系の物質循環（炭素・窒素・リン）',
          'エネルギー流と生態効率・生態ピラミッド',
          '生態系サービスと生物多様性の保全',
        ],
      },
      {
        chapter: '⑥ 生命科学と社会',
        units: [
          '遺伝子組み換え技術（制限酵素・ベクター・形質転換）',
          'PCR法・DNAシーケンシング',
          'ゲノム編集（CRISPR-Cas9）',
          'クローン技術と倫理',
          'ニューロンの構造と興奮（静止電位・活動電位）',
          '興奮の伝導と伝達（シナプス・神経伝達物質）',
          '脳の構造と機能',
          '筋肉の収縮（アクチン・ミオシン・サルコメア）',
          '植物の光応答（光受容体・光周性・花芽形成）',
          '植物ホルモン（オーキシン・ジベレリン・アブシシン酸）',
          '動物の行動（走性・本能・学習・刷り込み）',
        ],
      },
    ],
  },
]

// ─────────────────────────────────────────────
//  アプリ設定
// ─────────────────────────────────────────────
export interface AppSettings {
  geminiApiKey: string
  geminiModel: string
  googleClientId: string
  googleClientSecret: string
  seibuturagBaseUrl: string
  gddataBaseUrl: string
}

export interface GoogleAuthState {
  accessToken: string
  expiresAt: number
}

export type ViewType = 'datasource' | 'generator' | 'questions' | 'settings'
