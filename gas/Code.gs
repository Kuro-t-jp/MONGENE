// ═══════════════════════════════════════════════════════════════
//  MONGENE - Google Apps Script サーバー
//  スプレッドシートへの読み書きとWebアプリ配信を担当
// ═══════════════════════════════════════════════════════════════

const SHEET_QUESTIONS = '問題';
const SHEET_PASSAGES  = '長文問題';
const SHEET_META      = 'mongene_meta';

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

    return JSON.stringify({
      questions,
      passageSets,
      dataSources:      meta.dataSources      || [],
      generationConfig: meta.generationConfig  || null,
      settings:         meta.settings          || null,
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

    // メタデータ（設定・設定・データソース等）
    writeMeta(ss, {
      dataSources:      state.dataSources      || [],
      generationConfig: state.generationConfig  || null,
      settings:         state.settings          || null,
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
