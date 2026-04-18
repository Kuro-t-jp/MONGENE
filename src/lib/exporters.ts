import type { Question, PassageSet } from '../types'
import { QUESTION_TYPE_CONFIGS, EXAM_LEVEL_CONFIGS } from '../types'
import { Document, Packer, Paragraph, TextRun } from 'docx'

function typeLabel(type: string) {
  return QUESTION_TYPE_CONFIGS.find((c) => c.id === type)?.label ?? type
}
function levelLabel(level: string) {
  return EXAM_LEVEL_CONFIGS.find((c) => c.id === level)?.label ?? level
}

// ─── Markdown ──────────────────────────────────────────────────────────────
export function exportToMarkdown(questions: Question[]): string {
  const lines: string[] = [
    '# 生成問題集',
    '',
    `生成日時: ${new Date().toLocaleString('ja-JP')}`,
    `問題数: ${questions.length}問`,
    '',
  ]

  questions.forEach((q, i) => {
    lines.push(`## 問${i + 1}　【${typeLabel(q.type)}】【${levelLabel(q.level)}】`)
    if (q.subject) lines.push(`> 科目: ${q.subject}`)
    lines.push('')
    lines.push(q.content)
    lines.push('')

    if (q.choices?.length) {
      q.choices.forEach((c) => lines.push(`${c.label}. ${c.text}`))
      lines.push('')
    }

    lines.push(`**正解:** ${q.correctAnswer}`)
    lines.push('')
    lines.push(`**解説:** ${q.explanation}`)
    lines.push('')

    if (q.tags.length) {
      lines.push(`*タグ: ${q.tags.join(', ')}*`)
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  })

  return lines.join('\n')
}

// ─── JSON ──────────────────────────────────────────────────────────────────
export function exportToJSON(questions: Question[]): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      count: questions.length,
      questions,
    },
    null,
    2
  )
}

// ─── Plain text ────────────────────────────────────────────────────────────
export function exportToText(questions: Question[]): string {
  const lines: string[] = [
    '問　題　集',
    `生成日時: ${new Date().toLocaleString('ja-JP')}`,
    `問題数: ${questions.length}問`,
    '',
    '═'.repeat(60),
    '',
  ]

  questions.forEach((q, i) => {
    lines.push(`問${i + 1}.（${typeLabel(q.type)}）`)
    lines.push(q.content)
    lines.push('')

    if (q.choices?.length) {
      q.choices.forEach((c) => lines.push(`　${c.label}. ${c.text}`))
      lines.push('')
    }

    lines.push(`【解答】${q.correctAnswer}`)
    lines.push(`【解説】${q.explanation}`)
    lines.push('')
    lines.push('─'.repeat(40))
    lines.push('')
  })

  return lines.join('\n')
}

// ─── Google Forms (Apps Script) ────────────────────────────────────────────
export function exportToGoogleForms(questions: Question[]): string {
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')

  const itemLines: string[] = []

  questions.forEach((q, i) => {
    const num = i + 1
    const title = escape(`問${num}．${q.content}`)

    if (q.type === 'multiple_choice_4' || q.type === 'multiple_choice_5' || q.type === 'true_false') {
      const choices = q.type === 'true_false'
        ? [{ label: '正', text: '正' }, { label: '誤', text: '誤' }]
        : (q.choices ?? [])

      itemLines.push(`  // ── 問${num} ─────────────────────────`)
      itemLines.push(`  var item${num} = form.addMultipleChoiceItem();`)
      itemLines.push(`  item${num}.setTitle('${title}');`)
      itemLines.push(`  item${num}.setRequired(true);`)
      itemLines.push(`  var choices${num} = [`)
      choices.forEach((c) => {
        const choiceText = escape(`${c.label}. ${c.text}`)
        const isCorrect = q.correctAnswer === c.label
        itemLines.push(`    item${num}.createChoice('${choiceText}', ${isCorrect}),`)
      })
      itemLines.push(`  ];`)
      itemLines.push(`  item${num}.setChoices(choices${num});`)
      itemLines.push(`  item${num}.setPoints(1);`)
      if (q.explanation) {
        itemLines.push(`  item${num}.setHelpText('解説: ${escape(q.explanation)}');`)
      }
    } else if (q.type === 'essay') {
      itemLines.push(`  // ── 問${num} ─────────────────────────`)
      itemLines.push(`  var item${num} = form.addParagraphTextItem();`)
      itemLines.push(`  item${num}.setTitle('${title}');`)
      itemLines.push(`  item${num}.setRequired(true);`)
      if (q.explanation) {
        itemLines.push(`  item${num}.setHelpText('正解例: ${escape(q.correctAnswer)}\\n解説: ${escape(q.explanation)}');`)
      }
    } else {
      // fill_blank / short_answer / calculation
      itemLines.push(`  // ── 問${num} ─────────────────────────`)
      itemLines.push(`  var item${num} = form.addTextItem();`)
      itemLines.push(`  item${num}.setTitle('${title}');`)
      itemLines.push(`  item${num}.setRequired(true);`)
      if (q.explanation) {
        itemLines.push(`  item${num}.setHelpText('正解: ${escape(q.correctAnswer)}\\n解説: ${escape(q.explanation)}');`)
      }
    }
    itemLines.push('')
  })

  const date = new Date().toLocaleString('ja-JP')
  return `/**
 * MONGENE 生成問題集 - Google Forms 作成スクリプト
 * 生成日時: ${date}
 * 問題数: ${questions.length}問
 *
 * 使い方:
 *   1. https://script.google.com を開き、新しいプロジェクトを作成
 *   2. このコードをエディタに貼り付けて保存
 *   3. 上部メニューから「実行」→「createForm」を選択して実行
 *   4. 権限の確認ダイアログが表示されたら許可する
 *   5. Googleドライブに新しいフォームが作成されます
 */
function createForm() {
  var form = FormApp.create('問題集（${date}）');
  form.setIsQuiz(true);
  form.setTitle('問題集');
  form.setDescription('MONGENE で生成した問題集です。（${questions.length}問）');
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setShowLinkToRespondAgain(true);

${itemLines.join('\n')}
  var url = form.getPublishedUrl();
  Logger.log('フォームが作成されました: ' + url);
  SpreadsheetApp.getUi ? undefined : Browser.msgBox('フォームURL: ' + url);
}
`
}

// ─── Word (.docx) ──────────────────────────────────────────────────────────
export async function exportToDocx(questions: Question[]): Promise<Blob> {
  const date = new Date().toLocaleString('ja-JP')

  const children: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: '生成問題集', bold: true, size: 32 })], spacing: { after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: `生成日時: ${date}　問題数: ${questions.length}問`, size: 20 })], spacing: { after: 400 } }),
  ]

  questions.forEach((q, i) => {
    children.push(new Paragraph({
      children: [new TextRun({ text: `問${i + 1}　${typeLabel(q.type)}`, bold: true, size: 24 })],
      spacing: { before: 320, after: 120 },
    }))

    if (q.subject) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `科目: ${q.subject}`, size: 20 })],
        spacing: { after: 80 },
      }))
    }

    children.push(new Paragraph({
      children: [new TextRun({ text: q.content, size: 22 })],
      spacing: { after: 120 },
    }))

    if (q.choices?.length) {
      q.choices.forEach((c) => {
        children.push(new Paragraph({
          children: [new TextRun({ text: `${c.label}. ${c.text}`, size: 22 })],
          indent: { left: 480 },
          spacing: { after: 60 },
        }))
      })
    }

    children.push(new Paragraph({
      children: [new TextRun({ text: `正解: ${q.correctAnswer}`, bold: true, size: 20 })],
      spacing: { before: 120, after: 60 },
    }))
    children.push(new Paragraph({
      children: [new TextRun({ text: `解説: ${q.explanation}`, size: 20 })],
      spacing: { after: 60 },
    }))

    if (q.tags.length) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `タグ: ${q.tags.join(', ')}`, size: 18 })],
        spacing: { after: 60 },
      }))
    }

    children.push(new Paragraph({ children: [new TextRun({ text: '─'.repeat(30), size: 18 })], spacing: { after: 200 } }))
  })

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Hiragino Kaku Gothic ProN', size: 22 } } } },
    sections: [{ children }],
  })
  return Packer.toBlob(doc)
}

export async function exportPassagesToDocx(passageSets: PassageSet[]): Promise<Blob> {
  const date = new Date().toLocaleString('ja-JP')

  const children: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: '長文問題集', bold: true, size: 32 })], spacing: { after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: `生成日時: ${date}　セット数: ${passageSets.length}セット`, size: 20 })], spacing: { after: 400 } }),
  ]

  passageSets.forEach((ps, si) => {
    children.push(new Paragraph({
      children: [new TextRun({ text: `第${si + 1}問　${ps.title}`, bold: true, size: 28 })],
      spacing: { before: 400, after: 120 },
    }))

    if (ps.subject) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `科目: ${ps.subject}　レベル: ${levelLabel(ps.level)}`, size: 20 })],
        spacing: { after: 120 },
      }))
    }

    children.push(new Paragraph({
      children: [new TextRun({ text: '【本文】', bold: true, size: 22 })],
      spacing: { after: 80 },
    }))

    ps.passage.split('\n').forEach((line) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: line, size: 22 })],
        spacing: { after: 60 },
      }))
    })

    children.push(new Paragraph({ text: '', spacing: { after: 200 } }))

    ps.questions.forEach((sq, qi) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `問${qi + 1}　${typeLabel(sq.type)}`, bold: true, size: 24 })],
        spacing: { before: 200, after: 80 },
      }))

      children.push(new Paragraph({
        children: [new TextRun({ text: sq.content, size: 22 })],
        spacing: { after: 100 },
      }))

      if (sq.choices?.length) {
        sq.choices.forEach((c) => {
          children.push(new Paragraph({
            children: [new TextRun({ text: `${c.label}. ${c.text}`, size: 22 })],
            indent: { left: 480 },
            spacing: { after: 60 },
          }))
        })
      }

      children.push(new Paragraph({
        children: [new TextRun({ text: `正解: ${sq.correctAnswer}`, bold: true, size: 20 })],
        spacing: { before: 100, after: 60 },
      }))
      children.push(new Paragraph({
        children: [new TextRun({ text: `解説: ${sq.explanation}`, size: 20 })],
        spacing: { after: 120 },
      }))
    })

    children.push(new Paragraph({ children: [new TextRun({ text: '═'.repeat(30), size: 18 })], spacing: { after: 300 } }))
  })

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Hiragino Kaku Gothic ProN', size: 22 } } } },
    sections: [{ children }],
  })
  return Packer.toBlob(doc)
}

// ─── Download helper ───────────────────────────────────────────────────────
export function downloadFile(
  content: string,
  filename: string,
  mimeType = 'text/plain'
) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
