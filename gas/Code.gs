// ═══════════════════════════════════════════════════════════════
//  MONGENE - Google Apps Script サーバー
//  スプレッドシートへの読み書きとWebアプリ配信を担当
// ═══════════════════════════════════════════════════════════════

const SHEET_QUESTIONS = '問題';
const SHEET_PASSAGES  = '長文問題';
const SHEET_META      = 'mongene_meta';
const WEBAPP_URL      = 'https://script.google.com/macros/s/AKfycby0mhSZu7RkWgOUR3W3UvXIbtXlwXmfk8elM4t5hMPHLi8ws7tH7hutjUT2qESkXm0m/exec';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

// ── 問題シートの列定義 ──
const Q_HEADERS = [
  'id', 'type', 'level', 'subject', 'content',
  'choices', 'correctAnswer', 'explanation', 'tags', 'createdAt', 'checked'
];

// ── 長文問題シートの列定義 ──
const P_HEADERS = [
  'id', 'title', 'passage', 'level', 'subject',
  'questions', 'createdAt', 'checked'
];

// ───────────────────────────────────────────────────────────────
//  onOpen: スプレッドシートを開いたときにカスタムメニューを追加
// ───────────────────────────────────────────────────────────────
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🧬 MONGENE')
    .addItem('🌐 Webアプリを開く', 'menuOpenWebApp')
    .addSeparator()
    .addItem('⚡ 問題を生成する',      'menuGenerateQuestions')
    .addItem('📋 問題を閲覧・管理する', 'menuBrowseQuestions')
    .addSeparator()
    .addSubMenu(ui.createMenu('📤 エクスポート')
      .addItem('📝 Google Formsに書き出す',    'menuExportToForms')
      .addItem('📄 Word(.docx)に書き出す',     'menuExportToWord')
      .addItem('📊 CSVシートを作成する',        'menuExportToCsv')
      .addItem('🗂️ JSONシートを作成する',       'menuExportToJson')
    )
    .addSubMenu(ui.createMenu('📊 統計・情報')
      .addItem('📈 データ件数を表示', 'menuShowStats')
      .addItem('ℹ️ バージョン情報',   'menuShowAbout')
    )
    .addSubMenu(ui.createMenu('🗂️ データ管理')
      .addItem('✅ チェック済み問題を削除',     'menuDeleteChecked')
      .addItem('🔄 全問題のチェックをリセット', 'menuResetChecked')
      .addItem('💾 バックアップシートを作成',   'menuCreateBackup')
      .addSeparator()
      .addItem('🗑️ 全データをリセット（要確認）', 'menuResetAllData')
    )
    .addSubMenu(ui.createMenu('🔧 ツール')
      .addItem('📋 シートを整形（フィルター追加）', 'menuFormatSheets')
      .addItem('🔍 データ整合性チェック',          'menuCheckIntegrity')
    )
    .addToUi();
}

// ───────────────────────────────────────────────────────────────
//  メニュー: Webアプリを開く
// ───────────────────────────────────────────────────────────────
function menuOpenWebApp() {
  var html = HtmlService.createHtmlOutput(
    '<style>' +
    'body{font-family:sans-serif;padding:20px;margin:0;}' +
    'a.btn{display:inline-block;padding:10px 24px;background:#4f46e5;color:#fff;' +
    'border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;}' +
    'p{color:#555;margin-bottom:16px;}' +
    '</style>' +
    '<p>Webアプリを新しいタブで開きます。</p>' +
    '<a class="btn" href="' + WEBAPP_URL + '" target="_blank">▶ MONGENE を開く</a>' +
    '<script>window.open("' + WEBAPP_URL + '","_blank");</script>'
  ).setWidth(340).setHeight(130);
  SpreadsheetApp.getUi().showModalDialog(html, 'MONGENE Webアプリ');
}

// ───────────────────────────────────────────────────────────────
//  メニュー: 統計・情報
// ───────────────────────────────────────────────────────────────
function menuShowStats() {
  var ss          = SpreadsheetApp.getActiveSpreadsheet();
  var questions   = readSheet(ss, SHEET_QUESTIONS, Q_HEADERS, null);
  var passageSets = readSheet(ss, SHEET_PASSAGES,  P_HEADERS, null);

  var qChecked = questions.filter(function(q){
    return q.checked === 'true' || q.checked === true;
  }).length;
  var pChecked = passageSets.filter(function(p){
    return p.checked === 'true' || p.checked === true;
  }).length;

  // 科目別集計
  var subjects = {};
  questions.forEach(function(q){
    var s = (q.subject && String(q.subject).trim()) || '未設定';
    subjects[s] = (subjects[s] || 0) + 1;
  });

  // 問題タイプ別集計
  var types = {};
  questions.forEach(function(q){
    var t = (q.type && String(q.type).trim()) || '未設定';
    types[t] = (types[t] || 0) + 1;
  });

  var msg = '【MONGENE データ統計】\n\n';
  msg += '📝 問題数: '      + questions.length   + ' 件（チェック済み: ' + qChecked + ' 件）\n';
  msg += '📖 長文問題数: '  + passageSets.length + ' 件（チェック済み: ' + pChecked + ' 件）\n';

  if (Object.keys(subjects).length > 0) {
    msg += '\n📚 科目別問題数:\n';
    Object.keys(subjects).sort().forEach(function(s){
      msg += '  ' + s + ': ' + subjects[s] + ' 件\n';
    });
  }

  if (Object.keys(types).length > 0) {
    msg += '\n🏷️ タイプ別問題数:\n';
    Object.keys(types).sort().forEach(function(t){
      msg += '  ' + t + ': ' + types[t] + ' 件\n';
    });
  }

  SpreadsheetApp.getUi().alert('データ統計', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuShowAbout() {
  var msg = 'MONGENE - AI問題生成システム\n\n';
  msg += 'バージョン: 1.0.0\n\n';
  msg += '📄 Webアプリ URL:\n' + WEBAPP_URL + '\n\n';
  msg += 'データはこのスプレッドシートに自動保存されます。\n';
  msg += 'シート構成:\n  ・問題 … 個別問題\n  ・長文問題 … 長文+小問\n  ・mongene_meta … 設定等';
  SpreadsheetApp.getUi().alert('バージョン情報', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ───────────────────────────────────────────────────────────────
//  メニュー: データ管理
// ───────────────────────────────────────────────────────────────
function menuDeleteChecked() {
  var ui     = SpreadsheetApp.getUi();
  var result = ui.alert(
    'チェック済み問題の削除',
    'チェック済みの問題・長文問題を削除しますか？\nこの操作は元に戻せません。',
    ui.ButtonSet.OK_CANCEL
  );
  if (result !== ui.Button.OK) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var questions  = readSheet(ss, SHEET_QUESTIONS, Q_HEADERS, null);
  var remaining  = questions.filter(function(q){
    return !(q.checked === 'true' || q.checked === true);
  });
  writeSheet(ss, SHEET_QUESTIONS, Q_HEADERS, remaining, function(q){
    return Q_HEADERS.map(function(h){ return q[h] !== undefined ? q[h] : ''; });
  });

  var passages   = readSheet(ss, SHEET_PASSAGES, P_HEADERS, null);
  var remainingP = passages.filter(function(p){
    return !(p.checked === 'true' || p.checked === true);
  });
  writeSheet(ss, SHEET_PASSAGES, P_HEADERS, remainingP, function(p){
    return P_HEADERS.map(function(h){ return p[h] !== undefined ? p[h] : ''; });
  });

  var deleted = (questions.length - remaining.length) + (passages.length - remainingP.length);
  ui.alert('削除完了', deleted + ' 件のデータを削除しました。', ui.ButtonSet.OK);
}

function menuCreateBackup() {
  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'MMdd_HHmm');

  [SHEET_QUESTIONS, SHEET_PASSAGES, SHEET_META].forEach(function(name) {
    var src = ss.getSheetByName(name);
    if (!src) return;
    var backupName = name + '_bk_' + timestamp;
    var existing   = ss.getSheetByName(backupName);
    if (existing) ss.deleteSheet(existing);
    src.copyTo(ss).setName(backupName);
  });

  SpreadsheetApp.getUi().alert(
    'バックアップ完了',
    'バックアップシートを作成しました。\nシート名の末尾: _bk_' + timestamp,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function menuResetAllData() {
  var ui      = SpreadsheetApp.getUi();
  var result1 = ui.alert(
    '⚠️ 全データリセット',
    '【警告】全ての問題・設定データを削除します。\nこの操作は元に戻せません。\n\n本当に実行しますか？',
    ui.ButtonSet.OK_CANCEL
  );
  if (result1 !== ui.Button.OK) return;

  // 二重確認
  var result2 = ui.prompt(
    '最終確認',
    '本当に全データを削除する場合は「削除する」と入力してください：',
    ui.ButtonSet.OK_CANCEL
  );
  if (result2.getSelectedButton() !== ui.Button.OK || result2.getResponseText() !== '削除する') {
    ui.alert('キャンセルしました。', ui.ButtonSet.OK);
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  writeSheet(ss, SHEET_QUESTIONS, Q_HEADERS, [], function(q){ return []; });
  writeSheet(ss, SHEET_PASSAGES,  P_HEADERS, [], function(p){ return []; });
  var metaSheet = ss.getSheetByName(SHEET_META);
  if (metaSheet) metaSheet.clearContents();

  ui.alert('リセット完了', '全データを削除しました。', ui.ButtonSet.OK);
}

// ───────────────────────────────────────────────────────────────
//  メニュー: ツール
// ───────────────────────────────────────────────────────────────
function menuFormatSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  [
    { name: SHEET_QUESTIONS, headers: Q_HEADERS },
    { name: SHEET_PASSAGES,  headers: P_HEADERS },
  ].forEach(function(def) {
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) return;
    var lastRow = Math.max(sheet.getLastRow(), 1);
    var lastCol = def.headers.length;

    // ヘッダー行スタイル
    var headerRange = sheet.getRange(1, 1, 1, lastCol);
    headerRange
      .setBackground('#4f46e5')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setFontSize(11);

    // 既存フィルターを削除してから再設定
    var existingFilter = sheet.getFilter();
    if (existingFilter) existingFilter.remove();
    sheet.getRange(1, 1, lastRow, lastCol).createFilter();

    // 列幅自動調整
    sheet.autoResizeColumns(1, lastCol);

    // 行の交互色付け
    for (var r = 2; r <= lastRow; r++) {
      sheet.getRange(r, 1, 1, lastCol)
        .setBackground(r % 2 === 0 ? '#f3f4f6' : '#ffffff')
        .setFontColor('#111827');
    }

    // 先頭行を固定
    sheet.setFrozenRows(1);
  });

  SpreadsheetApp.getUi().alert('整形完了', 'シートの書式・フィルターを設定しました。', SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuCheckIntegrity() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var issues = [];

  var questions = readSheet(ss, SHEET_QUESTIONS, Q_HEADERS, null);
  questions.forEach(function(q, i) {
    if (!q.id)      issues.push('問題シート 行' + (i+2) + ': id が空');
    if (!q.content) issues.push('問題シート 行' + (i+2) + ': content が空');
    if (!q.type)    issues.push('問題シート 行' + (i+2) + ': type が空');
  });

  // ID重複チェック
  var qIds  = questions.map(function(q){ return String(q.id); });
  var qDups = qIds.filter(function(id, idx){ return qIds.indexOf(id) !== idx; });
  if (qDups.length > 0) issues.push('問題シート: ID重複 → ' + qDups.join(', '));

  var passages = readSheet(ss, SHEET_PASSAGES, P_HEADERS, null);
  passages.forEach(function(p, i) {
    if (!p.id)      issues.push('長文問題シート 行' + (i+2) + ': id が空');
    if (!p.passage) issues.push('長文問題シート 行' + (i+2) + ': passage が空');
  });

  var pIds  = passages.map(function(p){ return String(p.id); });
  var pDups = pIds.filter(function(id, idx){ return pIds.indexOf(id) !== idx; });
  if (pDups.length > 0) issues.push('長文問題シート: ID重複 → ' + pDups.join(', '));

  var msg;
  if (issues.length === 0) {
    msg = '✅ 問題は見つかりませんでした。\nデータは正常です（問題 ' + questions.length + ' 件・長文問題 ' + passages.length + ' 件）。';
  } else {
    msg = '⚠️ ' + issues.length + ' 件の問題が見つかりました:\n\n' + issues.slice(0, 20).join('\n');
    if (issues.length > 20) msg += '\n...（他 ' + (issues.length - 20) + ' 件）';
  }
  SpreadsheetApp.getUi().alert('データ整合性チェック', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ───────────────────────────────────────────────────────────────
//  問題生成 (Gemini API via UrlFetchApp)
// ───────────────────────────────────────────────────────────────
function menuGenerateQuestions() {
  var html = HtmlService.createHtmlOutputFromFile('GeneratorDialog')
    .setWidth(660).setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(html, '⚡ 問題生成');
}

function serverGetApiKey() {
  return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
}

function serverSetApiKey(key) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', String(key).trim());
  return 'ok';
}

function serverGenerateFromGAS(configJson) {
  var config = JSON.parse(configJson);
  var apiKey = config.apiKey || PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini APIキーが設定されていません。入力してください。');
  if (config.apiKey) {
    PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', config.apiKey.trim());
  }
  var model    = config.model || 'gemini-2.5-flash-lite';
  var isPass   = config.generationMode === 'passage';
  var prompt   = isPass ? buildPassagePrompt(config) : buildIndividualPrompt(config);
  var url      = GEMINI_API_BASE + model + ':generateContent?key=' + apiKey.trim();
  var response = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 16384 },
    }),
    muteHttpExceptions: true,
  });
  var code = response.getResponseCode();
  var body = response.getContentText();
  if (code !== 200) {
    var errData = safeParseJson(body);
    throw new Error('Gemini API エラー (' + code + '): ' +
      ((errData && errData.error && errData.error.message) || body.slice(0, 200)));
  }
  var parsed     = JSON.parse(body);
  var candidates = parsed.candidates;
  if (!candidates || candidates.length === 0) {
    var blockReason = (parsed.promptFeedback && parsed.promptFeedback.blockReason) || '不明';
    throw new Error('Gemini API: レスポンスが空です（安全フィルターによるブロックの可能性あり: ' + blockReason + '）');
  }
  var text = candidates[0].content.parts[0].text;
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var count = 0;
  if (isPass) {
    var sets = parseGeneratedPassages(text, config);
    var existP = readSheet(ss, SHEET_PASSAGES, P_HEADERS, null);
    writeSheet(ss, SHEET_PASSAGES, P_HEADERS, existP.concat(sets), function(p) {
      return [p.id, p.title, p.passage, p.level, p.subject, p.questions, p.createdAt, String(p.checked)];
    });
    count = sets.length;
  } else {
    var qs = parseGeneratedQuestions(text, config);
    var existQ = readSheet(ss, SHEET_QUESTIONS, Q_HEADERS, null);
    writeSheet(ss, SHEET_QUESTIONS, Q_HEADERS, existQ.concat(qs), function(q) {
      return [q.id, q.type, q.level, q.subject, q.content,
              q.choices, q.correctAnswer, q.explanation, q.tags, q.createdAt, String(q.checked)];
    });
    count = qs.length;
  }
  return JSON.stringify({ count: count, mode: isPass ? 'passage' : 'individual' });
}

function buildIndividualPrompt(config) {
  var count   = parseInt(config.count) || 5;
  var level   = config.level || 'high_exam';
  var qtype   = config.questionType || 'multiple_choice_4';
  var subject = config.subject || '';
  var source  = (config.sourceText || '').slice(0, 4000);
  var extra   = config.additionalInstructions || '';
  var LL = { high_exam:'高校入試', center_exam:'大学入試 共通テスト', university_exam:'大学入試 二次試験', custom: config.customLevel||'カスタム' };
  var TL = { multiple_choice_4:'4択', multiple_choice_5:'5択', true_false:'正誤', fill_in_blank:'空欄補充', short_answer:'短答', essay:'記述' };
  var isChoice  = qtype.startsWith('multiple_choice') || qtype === 'true_false';
  var numCh     = qtype === 'multiple_choice_5' ? 5 : (qtype === 'true_false' ? 2 : 4);
  var exChoices = ['選択肢A','選択肢B','選択肢C','選択肢D','選択肢E'].slice(0, numCh);
  var p = '優秀な教育者として、以下の条件で問題を' + count + '問作成してください。\n\n';
  p += '【難易度】' + (LL[level]||level) + '\n【形式】' + (TL[qtype]||qtype) + '\n';
  if (subject) p += '【科目・分野】' + subject + '\n';
  if (source)  p += '\n【参考テキスト】\n' + source + '\n';
  if (extra)   p += '\n【追加指示】' + extra + '\n';
  p += '\n以下のJSON形式のみで出力してください（説明文不要）:\n';
  p += '{"questions":[{"type":"' + qtype + '","level":"' + level + '","subject":"' + subject + '","content":"問題文",';
  if (isChoice) {
    p += '"choices":' + JSON.stringify(exChoices) + ',"correctAnswer":"' + exChoices[0] + '",';
  } else {
    p += '"choices":null,"correctAnswer":"正解",';
  }
  p += '"explanation":"解説","tags":["タグ"]}]}';
  return p;
}

function buildPassagePrompt(config) {
  var sc      = parseInt(config.passageCount) || 2;
  var qps     = parseInt(config.questionsPerPassage) || 5;
  var level   = config.level || 'high_exam';
  var qtype   = config.questionType || 'multiple_choice_4';
  var subject = config.subject || '';
  var source  = (config.sourceText || '').slice(0, 4000);
  var extra   = config.additionalInstructions || '';
  var LL = { high_exam:'高校入試', center_exam:'大学入試 共通テスト', university_exam:'大学入試 二次試験', custom: config.customLevel||'カスタム' };
  var p = '優秀な教育者として、長文読解問題セットを' + sc + 'セット作成してください。\n';
  p += '各セットに長文1つと設問を' + qps + '問含めてください。\n\n';
  p += '【難易度】' + (LL[level]||level) + '\n';
  if (subject) p += '【科目・分野】' + subject + '\n';
  if (source)  p += '\n【参考テキスト】\n' + source + '\n';
  if (extra)   p += '\n【追加指示】' + extra + '\n';
  p += '\n以下のJSON形式のみで出力してください:\n';
  p += '{"passageSets":[{"title":"タイトル","passage":"長文","level":"' + level + '","subject":"' + subject + '",';
  p += '"questions":[{"type":"' + qtype + '","content":"設問","choices":["A","B","C","D"],"correctAnswer":"A","explanation":"解説"}]}]}';
  return p;
}

function parseGeneratedQuestions(text, config) {
  var parsed;
  try {
    parsed = JSON.parse(extractJsonText(text));
  } catch (e) {
    throw new Error('AIの応答をJSONとして解析できませんでした。応答の先頭: ' + text.slice(0, 200));
  }
  var items = parsed.questions || parsed.items || (Array.isArray(parsed) ? parsed : []);
  return items.map(function(q) {
    return {
      id:            Utilities.getUuid(),
      type:          q.type          || config.questionType || 'multiple_choice_4',
      level:         q.level         || config.level        || 'high_exam',
      subject:       q.subject       || config.subject      || '',
      content:       q.content       || q.question          || '',
      choices:       q.choices       ? JSON.stringify(q.choices) : '',
      correctAnswer: q.correctAnswer || q.correct_answer    || '',
      explanation:   q.explanation   || '',
      tags:          JSON.stringify(q.tags || []),
      createdAt:     new Date().toISOString(),
      checked:       'false',
    };
  });
}

function parseGeneratedPassages(text, config) {
  var parsed;
  try {
    parsed = JSON.parse(extractJsonText(text));
  } catch (e) {
    throw new Error('AIの応答をJSONとして解析できませんでした。応答の先頭: ' + text.slice(0, 200));
  }
  var items = parsed.passageSets || parsed.passages || (Array.isArray(parsed) ? parsed : []);
  return items.map(function(p) {
    return {
      id:        Utilities.getUuid(),
      title:     p.title   || '無題',
      passage:   p.passage || '',
      level:     p.level   || config.level   || 'high_exam',
      subject:   p.subject || config.subject || '',
      questions: JSON.stringify(p.questions || []),
      createdAt: new Date().toISOString(),
      checked:   'false',
    };
  });
}

function extractJsonText(text) {
  var md = text.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (md) return md[1].trim();
  var s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s !== -1 && e > s) return text.slice(s, e + 1);
  return text;
}

// ───────────────────────────────────────────────────────────────
//  問題ブラウザ
// ───────────────────────────────────────────────────────────────
function menuBrowseQuestions() {
  var html = HtmlService.createHtmlOutputFromFile('BrowserDialog')
    .setWidth(900).setHeight(660);
  SpreadsheetApp.getUi().showModalDialog(html, '📋 問題管理');
}

function serverGetAllQuestionsForBrowser() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var qs = readSheet(ss, SHEET_QUESTIONS, Q_HEADERS, function(row) {
    return {
      id:            String(row.id      || ''),
      type:          String(row.type    || ''),
      level:         String(row.level   || ''),
      subject:       String(row.subject || ''),
      content:       String(row.content || '').slice(0, 200),
      correctAnswer: String(row.correctAnswer || ''),
      checked:       row.checked === 'true' || row.checked === true,
    };
  });
  return JSON.stringify(qs);
}

function serverDeleteQuestionById(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var qs = readSheet(ss, SHEET_QUESTIONS, Q_HEADERS, null);
  writeSheet(ss, SHEET_QUESTIONS, Q_HEADERS,
    qs.filter(function(q) { return String(q.id) !== String(id); }),
    function(q) { return Q_HEADERS.map(function(h) { return q[h] !== undefined ? q[h] : ''; }); }
  );
  return 'ok';
}

function serverToggleQuestionById(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var qs = readSheet(ss, SHEET_QUESTIONS, Q_HEADERS, null).map(function(q) {
    if (String(q.id) === String(id)) {
      q.checked = (q.checked === 'true' || q.checked === true) ? 'false' : 'true';
    }
    return q;
  });
  writeSheet(ss, SHEET_QUESTIONS, Q_HEADERS, qs,
    function(q) { return Q_HEADERS.map(function(h) { return q[h] !== undefined ? q[h] : ''; }); }
  );
  return 'ok';
}

function menuResetChecked() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var qs = readSheet(ss, SHEET_QUESTIONS, Q_HEADERS, null);
  qs.forEach(function(q) { q.checked = 'false'; });
  writeSheet(ss, SHEET_QUESTIONS, Q_HEADERS, qs,
    function(q) { return Q_HEADERS.map(function(h) { return q[h] !== undefined ? q[h] : ''; }); }
  );
  SpreadsheetApp.getUi().alert('完了', '全問題のチェックをリセットしました。', SpreadsheetApp.getUi().ButtonSet.OK);
}

// ───────────────────────────────────────────────────────────────
//  エクスポート
// ───────────────────────────────────────────────────────────────
function menuExportToForms() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var qs = readSheet(ss, SHEET_QUESTIONS, Q_HEADERS, null);
  if (qs.length === 0) { SpreadsheetApp.getUi().alert('問題がありません', '先に問題を生成してください。', SpreadsheetApp.getUi().ButtonSet.OK); return; }
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Google Forms 書き出し', '問題 ' + qs.length + ' 件をGoogle Formsに書き出しますか？（最大50問）', ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
  var ts   = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
  var form = FormApp.create('MONGENE 問題セット ' + ts);
  form.setDescription('MONGENE で生成した問題セット').setIsQuiz(true);
  var added = 0;
  for (var i = 0; i < qs.length && i < 50; i++) {
    var q = qs[i];
    var content = String(q.content || '').trim();
    if (!content) continue;
    var choices = q.choices ? safeParseJson(q.choices) : null;
    if (Array.isArray(choices) && choices.length > 0) {
      var mc = form.addMultipleChoiceItem().setTitle(content).setRequired(true);
      mc.setChoices(choices.map(function(c) {
        return mc.createChoice(String(c), String(c) === String(q.correctAnswer || ''));
      })).setPoints(1);
    } else {
      form.addTextItem().setTitle(content).setRequired(true);
    }
    added++;
  }
  var editUrl = form.getEditUrl(), pubUrl = form.getPublishedUrl();
  var html = HtmlService.createHtmlOutput(
    '<style>body{font-family:sans-serif;padding:20px;}a{color:#4f46e5;display:block;margin:10px 0;font-weight:bold;font-size:14px;}</style>' +
    '<p style="margin-bottom:12px">✅ <b>' + added + ' 問</b>を書き出しました。</p>' +
    '<a href="' + editUrl + '" target="_blank">📝 フォームを編集する</a>' +
    '<a href="' + pubUrl  + '" target="_blank">🌐 回答フォームを開く</a>' +
    '<script>window.open("' + editUrl + '","_blank");</script>'
  ).setWidth(380).setHeight(180);
  SpreadsheetApp.getUi().showModalDialog(html, 'Google Forms 書き出し完了');
}

function menuExportToWord() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var qs = readSheet(ss, SHEET_QUESTIONS, Q_HEADERS, null);
  if (qs.length === 0) {
    SpreadsheetApp.getUi().alert('問題がありません', '先に問題を生成してください。', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  var ui = SpreadsheetApp.getUi();
  if (ui.alert(
    'Word (.docx) 書き出し',
    '問題 ' + qs.length + ' 件をGoogle Docに書き出しますか？\n（Googleドキュメントとして保存後、Word形式でダウンロードできます）',
    ui.ButtonSet.OK_CANCEL
  ) !== ui.Button.OK) return;

  var TYPE_LABELS  = { multiple_choice_4:'4択', multiple_choice_5:'5択', true_false:'正誤',
                       fill_in_blank:'穴埋め', short_answer:'短答', essay:'論述' };
  var LEVEL_LABELS = { high_exam:'高校入試', center_exam:'大学入試（共通テスト）',
                       university_exam:'大学入試（二次試験）', custom:'カスタム' };

  var ts  = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
  var doc = DocumentApp.create('MONGENE 問題セット ' + ts);
  var body = doc.getBody();

  // タイトル
  var title = body.appendParagraph('MONGENE 問題セット');
  title.setHeading(DocumentApp.ParagraphHeading.TITLE);

  body.appendParagraph('生成日時: ' + ts + '　問題数: ' + qs.length + ' 件')
    .setItalic(true);
  body.appendParagraph('');

  // 科目別グループ化
  var groups = {};
  var groupOrder = [];
  qs.forEach(function(q) {
    var s = (q.subject && String(q.subject).trim()) || '未分類';
    if (!groups[s]) { groups[s] = []; groupOrder.push(s); }
    groups[s].push(q);
  });

  groupOrder.forEach(function(subject) {
    var list = groups[subject];

    // 科目見出し
    body.appendParagraph(subject)
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);

    list.forEach(function(q, idx) {
      var typeLabel  = TYPE_LABELS[q.type]   || q.type  || '';
      var levelLabel = LEVEL_LABELS[q.level] || q.level || '';

      // 問題番号・形式・難易度
      var header = body.appendParagraph(
        '問 ' + (idx + 1) + '　[' + typeLabel + ']　[' + levelLabel + ']'
      );
      header.setHeading(DocumentApp.ParagraphHeading.HEADING2);

      // 問題文
      body.appendParagraph(String(q.content || '')).setLeftIndent(18);

      // 選択肢
      var choices = q.choices ? safeParseJson(q.choices) : null;
      if (Array.isArray(choices) && choices.length > 0) {
        choices.forEach(function(c, ci) {
          body.appendParagraph('　' + String.fromCharCode(9312 + ci) + ' ' + String(c))
            .setLeftIndent(36);
        });
      }

      // 正解・解説
      body.appendParagraph('');
      var ansLine = body.appendParagraph('【正解】' + String(q.correctAnswer || ''));
      ansLine.editAsText().setBold(true);

      if (q.explanation) {
        body.appendParagraph('【解説】' + String(q.explanation))
          .setItalic(true).setLeftIndent(18);
      }

      body.appendParagraph('');
    });
  });

  doc.saveAndClose();

  var docId      = doc.getId();
  var editUrl    = 'https://docs.google.com/document/d/' + docId + '/edit';
  var docxUrl    = 'https://docs.google.com/document/d/' + docId + '/export?format=docx';

  var html = HtmlService.createHtmlOutput(
    '<style>body{font-family:sans-serif;padding:20px;}a{color:#4f46e5;display:block;margin:10px 0;font-weight:bold;font-size:14px;}</style>' +
    '<p style="margin-bottom:12px">✅ <b>' + qs.length + ' 問</b>を書き出しました。</p>' +
    '<a href="' + editUrl + '" target="_blank">📄 Googleドキュメントで開く</a>' +
    '<a href="' + docxUrl + '" target="_blank">⬇️ Word (.docx) としてダウンロード</a>' +
    '<script>window.open("' + editUrl + '","_blank");<\/script>'
  ).setWidth(400).setHeight(180);
  SpreadsheetApp.getUi().showModalDialog(html, 'Word 書き出し完了');
}

function menuExportToCsv() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var qs = readSheet(ss, SHEET_QUESTIONS, Q_HEADERS, null);
  if (qs.length === 0) { SpreadsheetApp.getUi().alert('問題がありません', '先に問題を生成してください。', SpreadsheetApp.getUi().ButtonSet.OK); return; }
  var ts   = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'MMdd_HHmm');
  var name = 'CSV_' + ts;
  var hdrs = ['No','問題文','形式','難易度','科目','選択肢','正解','解説','タグ'];
  var ex   = ss.getSheetByName(name); if (ex) ss.deleteSheet(ex);
  var sheet = ss.insertSheet(name);
  var rows  = [hdrs];
  qs.forEach(function(q, i) {
    var ch = q.choices ? safeParseJson(q.choices) : [];
    var tg = q.tags    ? safeParseJson(q.tags)    : [];
    rows.push([i+1, q.content||'', q.type||'', q.level||'', q.subject||'',
      Array.isArray(ch)?ch.join(' / '):'', q.correctAnswer||'', q.explanation||'',
      Array.isArray(tg)?tg.join(', '):'']);
  });
  sheet.getRange(1,1,rows.length,hdrs.length).setValues(rows);
  sheet.getRange(1,1,1,hdrs.length).setBackground('#4f46e5').setFontColor('#fff').setFontWeight('bold');
  sheet.autoResizeColumns(1, hdrs.length); sheet.setFrozenRows(1);
  ss.setActiveSheet(sheet);
  SpreadsheetApp.getUi().alert('完了', name + ' に ' + qs.length + ' 件を書き出しました。', SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuExportToJson() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var qs = readSheet(ss, SHEET_QUESTIONS, Q_HEADERS, function(row) {
    return { id:row.id, type:row.type, level:row.level, subject:row.subject, content:row.content,
      choices:row.choices?safeParseJson(row.choices):null, correctAnswer:row.correctAnswer,
      explanation:row.explanation, tags:row.tags?safeParseJson(row.tags):[],
      createdAt:String(row.createdAt), checked:row.checked==='true'||row.checked===true };
  });
  if (qs.length === 0) { SpreadsheetApp.getUi().alert('問題がありません', '先に問題を生成してください。', SpreadsheetApp.getUi().ButtonSet.OK); return; }
  var ts   = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'MMdd_HHmm');
  var name = 'JSON_' + ts;
  var ex   = ss.getSheetByName(name); if (ex) ss.deleteSheet(ex);
  var sheet = ss.insertSheet(name);
  var rows  = JSON.stringify({ questions:qs, exportedAt:new Date().toISOString() }, null, 2)
                  .split('\n').map(function(l) { return [l]; });
  sheet.getRange(1,1,rows.length,1).setValues(rows);
  sheet.setColumnWidth(1, 900);
  ss.setActiveSheet(sheet);
  SpreadsheetApp.getUi().alert('完了', name + ' に ' + qs.length + ' 件をJSON書き出しました。', SpreadsheetApp.getUi().ButtonSet.OK);
}

// ───────────────────────────────────────────────────────────────
//  doGet: Webアプリとして React アプリを配信
// ───────────────────────────────────────────────────────────────
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('MONGENE - 問題生成システム')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ───────────────────────────────────────────────────────────────
//  serverLoadState: React アプリからのデータ読み込み
// ───────────────────────────────────────────────────────────────
function serverLoadState() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const questions = readSheet(ss, SHEET_QUESTIONS, Q_HEADERS, (row) => {
      return {
        id:            row.id,
        type:          row.type,
        level:         row.level,
        subject:       row.subject,
        content:       row.content,
        choices:       row.choices ? safeParseJson(row.choices) : undefined,
        correctAnswer: row.correctAnswer,
        explanation:   row.explanation,
        tags:          row.tags ? safeParseJson(row.tags) : [],
        createdAt:     String(row.createdAt),
        checked:       row.checked === 'true' || row.checked === true,
      };
    });

    const passageSets = readSheet(ss, SHEET_PASSAGES, P_HEADERS, (row) => {
      return {
        id:        row.id,
        title:     row.title,
        passage:   row.passage,
        level:     row.level,
        subject:   row.subject,
        questions: row.questions ? safeParseJson(row.questions) : [],
        createdAt: String(row.createdAt),
        checked:   row.checked === 'true' || row.checked === true,
      };
    });

    const meta = readMeta(ss);

    // セキュリティ: APIキーはスクリプトプロパティから復元する
    var settings = meta.settings || null;
    var storedApiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (storedApiKey) {
      settings = settings ? Object.assign({}, settings, { geminiApiKey: storedApiKey }) : { geminiApiKey: storedApiKey };
    }

    return JSON.stringify({
      questions,
      passageSets,
      dataSources:      meta.dataSources      || [],
      generationConfig: meta.generationConfig  || null,
      settings:         settings,
      urlHistory:       meta.urlHistory        || [],
    });
  } catch (err) {
    Logger.log('serverLoadState error: ' + err.toString());
    return JSON.stringify({
      questions: [], passageSets: [], dataSources: [],
      generationConfig: null, settings: null, urlHistory: [],
    });
  }
}

// ───────────────────────────────────────────────────────────────
//  serverSaveState: React アプリからのデータ書き込み
// ───────────────────────────────────────────────────────────────
function serverSaveState(stateJson) {
  try {
    const state = JSON.parse(stateJson);
    const ss    = SpreadsheetApp.getActiveSpreadsheet();

    // 問題シート
    writeSheet(ss, SHEET_QUESTIONS, Q_HEADERS, state.questions || [], (q) => [
      q.id, q.type, q.level, q.subject, q.content,
      q.choices ? JSON.stringify(q.choices) : '',
      q.correctAnswer,
      q.explanation,
      JSON.stringify(q.tags || []),
      q.createdAt,
      String(q.checked),
    ]);

    // 長文問題シート
    writeSheet(ss, SHEET_PASSAGES, P_HEADERS, state.passageSets || [], (p) => [
      p.id, p.title, p.passage, p.level, p.subject,
      JSON.stringify(p.questions || []),
      p.createdAt,
      String(p.checked),
    ]);

    // メタデータ（設定・データソース等）
    // セキュリティ: APIキーはスクリプトプロパティに保存するためシートには書かない
    var settingsToSave = null;
    if (state.settings) {
      settingsToSave = {};
      var settingsKeys = Object.keys(state.settings);
      for (var k = 0; k < settingsKeys.length; k++) {
        if (settingsKeys[k] !== 'geminiApiKey') {
          settingsToSave[settingsKeys[k]] = state.settings[settingsKeys[k]];
        }
      }
    }
    writeMeta(ss, {
      dataSources:      state.dataSources      || [],
      generationConfig: state.generationConfig  || null,
      settings:         settingsToSave,
      urlHistory:       state.urlHistory        || [],
    });

    return 'ok';
  } catch (err) {
    Logger.log('serverSaveState error: ' + err.toString());
    return 'error: ' + err.toString();
  }
}

// ───────────────────────────────────────────────────────────────
//  ヘルパー関数
// ───────────────────────────────────────────────────────────────

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function readSheet(ss, name, headers, transform) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];

  var range = sheet.getDataRange();
  var data  = range.getValues();
  if (data.length <= 1) return [];

  var results = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j] !== undefined ? data[i][j] : '';
    }
    if (!row.id) continue;
    results.push(transform ? transform(row) : row);
  }
  return results;
}

function writeSheet(ss, name, headers, items, toRow) {
  var sheet = getOrCreateSheet(ss, name);
  sheet.clearContents();

  if (items.length === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  var rows = [headers];
  for (var i = 0; i < items.length; i++) {
    rows.push(toRow(items[i]));
  }
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);

  // 列幅を自動調整（見やすさのため）
  sheet.autoResizeColumns(1, headers.length);
}

function readMeta(ss) {
  var sheet = ss.getSheetByName(SHEET_META);
  if (!sheet) return {};

  var data = sheet.getDataRange().getValues();
  var meta = {};
  for (var i = 0; i < data.length; i++) {
    var key = data[i][0];
    var val = data[i][1];
    if (key && val) {
      meta[key] = safeParseJson(val);
    }
  }
  return meta;
}

function writeMeta(ss, meta) {
  var sheet = getOrCreateSheet(ss, SHEET_META);
  sheet.clearContents();

  var rows = [];
  var keys = Object.keys(meta);
  for (var i = 0; i < keys.length; i++) {
    rows.push([keys[i], JSON.stringify(meta[keys[i]])]);
  }
  if (rows.length > 0) {
    sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  }
}

function safeParseJson(val) {
  try {
    return JSON.parse(String(val));
  } catch (e) {
    return val;
  }
}
