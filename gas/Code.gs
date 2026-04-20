// ═══════════════════════════════════════════════════════════════
//  MONGENE - Google Apps Script (スタンドアロン版)
//  スプレッドシート不要 · PropertiesService でデータ保存
// ═══════════════════════════════════════════════════════════════

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

// ───────────────────────────────────────────────────────────────
//  データ保存: PropertiesService チャンキング
//  上限: プロパティ値 9KB、合計 500KB
// ───────────────────────────────────────────────────────────────
const _CHUNK = 8500;

function emptyData_() {
  return {
    questions:        [],
    passageSets:      [],
    dataSources:      [],
    generationConfig: null,
    settings:         {},
    urlHistory:       [],
  };
}

function loadData_() {
  var props = PropertiesService.getScriptProperties();
  var n = parseInt(props.getProperty('D_N') || '0');
  if (n === 0) return emptyData_();
  var json = '';
  for (var i = 0; i < n; i++) json += (props.getProperty('D' + i) || '');
  try { return JSON.parse(json); } catch (e) { return emptyData_(); }
}

function saveData_(data) {
  var props = PropertiesService.getScriptProperties();
  var old = parseInt(props.getProperty('D_N') || '0');
  for (var i = 0; i < old; i++) props.deleteProperty('D' + i);
  var json = JSON.stringify(data);
  var n = Math.ceil(json.length / _CHUNK) || 1;
  for (var j = 0; j < n; j++) {
    props.setProperty('D' + j, json.slice(j * _CHUNK, (j + 1) * _CHUNK));
  }
  props.setProperty('D_N', String(n));
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
    var data = loadData_();
    var storedApiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (storedApiKey) {
      data.settings = data.settings || {};
      data.settings.geminiApiKey = storedApiKey;
    }
    return JSON.stringify(data);
  } catch (err) {
    Logger.log('serverLoadState error: ' + err);
    return JSON.stringify(emptyData_());
  }
}

// ───────────────────────────────────────────────────────────────
//  serverSaveState: React アプリからのデータ書き込み
// ───────────────────────────────────────────────────────────────
function serverSaveState(stateJson) {
  try {
    var state = JSON.parse(stateJson);
    if (state.settings && state.settings.geminiApiKey) {
      PropertiesService.getScriptProperties()
        .setProperty('GEMINI_API_KEY', state.settings.geminiApiKey);
      var settingsWithoutKey = {};
      var keys = Object.keys(state.settings);
      for (var k = 0; k < keys.length; k++) {
        if (keys[k] !== 'geminiApiKey') settingsWithoutKey[keys[k]] = state.settings[keys[k]];
      }
      state.settings = settingsWithoutKey;
    }
    saveData_(state);
    return 'ok';
  } catch (err) {
    Logger.log('serverSaveState error: ' + err);
    return 'error: ' + err.toString();
  }
}

// ───────────────────────────────────────────────────────────────
//  serverGetStats: 統計情報
// ───────────────────────────────────────────────────────────────
function serverGetStats() {
  var data = loadData_();
  return JSON.stringify({
    questions:   (data.questions   || []).length,
    passageSets: (data.passageSets || []).length,
  });
}

// ───────────────────────────────────────────────────────────────
//  serverGetApiKey / serverSetApiKey
// ───────────────────────────────────────────────────────────────
function serverGetApiKey() {
  return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
}

function serverSetApiKey(key) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', String(key).trim());
  return 'ok';
}

// ───────────────────────────────────────────────────────────────
//  serverGenerateFromGAS: 問題生成 → 保存
// ───────────────────────────────────────────────────────────────
function serverGenerateFromGAS(configJson) {
  var config = JSON.parse(configJson);
  var apiKey = config.apiKey ||
    PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini APIキーが設定されていません。');
  if (config.apiKey) {
    PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', config.apiKey.trim());
  }

  var model  = config.model || 'gemini-2.5-flash-lite';
  var isPass = config.generationMode === 'passage';
  var prompt = isPass ? buildPassagePrompt(config) : buildIndividualPrompt(config);
  var url    = GEMINI_API_BASE + model + ':generateContent?key=' + apiKey.trim();

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
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
    throw new Error('Gemini API: レスポンスが空です（ブロック: ' + blockReason + '）');
  }

  var text  = candidates[0].content.parts[0].text;
  var data  = loadData_();
  var count = 0;

  if (isPass) {
    var sets = parseGeneratedPassages(text, config);
    data.passageSets = (data.passageSets || []).concat(sets);
    count = sets.length;
  } else {
    var qs = parseGeneratedQuestions(text, config);
    data.questions = (data.questions || []).concat(qs);
    count = qs.length;
  }

  saveData_(data);
  return JSON.stringify({ count: count, mode: isPass ? 'passage' : 'individual' });
}

// ───────────────────────────────────────────────────────────────
//  serverExtractTextFromFile: OCR (Gemini Vision API)
// ───────────────────────────────────────────────────────────────
function serverExtractTextFromFile(base64Data, mimeType, fileName) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini APIキーが設定されていません。');

  if (mimeType === 'text/plain') {
    try {
      return Utilities.newBlob(Utilities.base64Decode(base64Data)).getDataAsString('UTF-8');
    } catch (e) {
      throw new Error('テキストファイルの読み込みに失敗しました: ' + e.message);
    }
  }

  var model   = 'gemini-2.0-flash';
  var url     = GEMINI_API_BASE + model + ':generateContent?key=' + apiKey.trim();
  var payload = {
    contents: [{
      parts: [
        { inlineData: { mimeType: mimeType, data: base64Data } },
        { text: 'このファイルに含まれるテキストをすべて正確に抽出してください。書式や段落構造は可能な限り維持し、余計な説明・コメントは一切不要です。テキストのみ出力してください。' }
      ]
    }],
    generationConfig: { temperature: 0, maxOutputTokens: 8192 }
  };

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  var body = response.getContentText();
  if (code !== 200) {
    var errData = safeParseJson(body);
    throw new Error('Gemini OCR エラー (' + code + '): ' +
      ((errData && errData.error && errData.error.message) || body.slice(0, 200)));
  }
  var result = JSON.parse(body);
  if (!result.candidates || result.candidates.length === 0) {
    throw new Error('テキスト抽出に失敗しました（空のレスポンス）');
  }
  return result.candidates[0].content.parts[0].text;
}

// ───────────────────────────────────────────────────────────────
//  プロンプトビルダー
// ───────────────────────────────────────────────────────────────
function buildIndividualPrompt(config) {
  var count   = parseInt(config.count) || 5;
  var level   = config.level || 'high_exam';
  var qtype   = config.questionType || 'multiple_choice_4';
  var subject = config.subject || '';
  var nlmUrl  = config.notebookLmUrl || '';
  var source  = (config.sourceText || '').slice(0, 4000);
  var extra   = config.additionalInstructions || '';
  if (!source && nlmUrl) source = fetchUrlText_(nlmUrl).slice(0, 4000);

  var LL = {
    high_exam:       '高校入試',
    center_exam:     '大学入試 共通テスト',
    university_exam: '大学入試 二次試験',
    custom:          config.customLevel || 'カスタム',
  };
  var TL = {
    multiple_choice_4: '4択', multiple_choice_5: '5択',
    true_false: '正誤', fill_in_blank: '空欄補充',
    short_answer: '短答', essay: '記述',
  };
  var isChoice  = qtype.startsWith('multiple_choice') || qtype === 'true_false';
  var numCh     = qtype === 'multiple_choice_5' ? 5 : (qtype === 'true_false' ? 2 : 4);
  var exChoices = ['選択肢A', '選択肢B', '選択肢C', '選択肢D', '選択肢E'].slice(0, numCh);

  var p = '優秀な教育者として、以下の条件で問題を' + count + '問作成してください。\n\n';
  p += '【難易度】' + (LL[level] || level) + '\n【形式】' + (TL[qtype] || qtype) + '\n';
  if (subject) p += '【科目・分野】' + subject + '\n';
  if (source)  p += '\n【参考テキスト】\n' + source + '\n';
  if (!source && nlmUrl) p += '\n【参照URL】' + nlmUrl + '\n';
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
  var nlmUrl  = config.notebookLmUrl || '';
  var source  = (config.sourceText || '').slice(0, 4000);
  var extra   = config.additionalInstructions || '';
  if (!source && nlmUrl) source = fetchUrlText_(nlmUrl).slice(0, 4000);

  var LL = {
    high_exam:       '高校入試',
    center_exam:     '大学入試 共通テスト',
    university_exam: '大学入試 二次試験',
    custom:          config.customLevel || 'カスタム',
  };
  var p = '優秀な教育者として、長文読解問題セットを' + sc + 'セット作成してください。\n';
  p += '各セットに長文1つと設問を' + qps + '問含めてください。\n\n';
  p += '【難易度】' + (LL[level] || level) + '\n';
  if (subject) p += '【科目・分野】' + subject + '\n';
  if (source)  p += '\n【参考テキスト】\n' + source + '\n';
  if (!source && nlmUrl) p += '\n【参照URL】' + nlmUrl + '\n';
  if (extra)   p += '\n【追加指示】' + extra + '\n';
  p += '\n以下のJSON形式のみで出力してください:\n';
  p += '{"passageSets":[{"title":"タイトル","passage":"長文","level":"' + level + '","subject":"' + subject + '",';
  p += '"questions":[{"type":"' + qtype + '","content":"設問","choices":["A","B","C","D"],"correctAnswer":"A","explanation":"解説"}]}]}';
  return p;
}

// ───────────────────────────────────────────────────────────────
//  URL テキスト取得（公開ページのみ、認証付きは空文字を返す）
// ───────────────────────────────────────────────────────────────
function fetchUrlText_(url) {
  if (!url) return '';
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) return '';
    var html = res.getContentText();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s{2,}/g, ' ').trim();
  } catch (e) {
    return '';
  }
}

// ───────────────────────────────────────────────────────────────
//  パーサー
// ───────────────────────────────────────────────────────────────
function parseGeneratedQuestions(text, config) {
  var parsed;
  try {
    parsed = JSON.parse(extractJsonText(text));
  } catch (e) {
    throw new Error('AIの応答をJSONとして解析できませんでした: ' + text.slice(0, 200));
  }
  var items = parsed.questions || parsed.items || (Array.isArray(parsed) ? parsed : []);
  return items.map(function (q) {
    return {
      id:            Utilities.getUuid(),
      type:          q.type          || config.questionType || 'multiple_choice_4',
      level:         q.level         || config.level        || 'high_exam',
      subject:       q.subject       || config.subject      || '',
      content:       q.content       || q.question          || '',
      choices:       q.choices       || null,
      correctAnswer: q.correctAnswer || q.correct_answer    || '',
      explanation:   q.explanation   || '',
      tags:          q.tags          || [],
      createdAt:     new Date().toISOString(),
      checked:       false,
    };
  });
}

function parseGeneratedPassages(text, config) {
  var parsed;
  try {
    parsed = JSON.parse(extractJsonText(text));
  } catch (e) {
    throw new Error('AIの応答をJSONとして解析できませんでした: ' + text.slice(0, 200));
  }
  var items = parsed.passageSets || parsed.passages || (Array.isArray(parsed) ? parsed : []);
  return items.map(function (p) {
    return {
      id:        Utilities.getUuid(),
      title:     p.title   || '無題',
      passage:   p.passage || '',
      level:     p.level   || config.level   || 'high_exam',
      subject:   p.subject || config.subject || '',
      questions: p.questions || [],
      createdAt: new Date().toISOString(),
      checked:   false,
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

function safeParseJson(val) {
  try { return JSON.parse(String(val)); } catch (e) { return val; }
}
