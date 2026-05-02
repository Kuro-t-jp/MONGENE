use tauri::{Emitter, Manager};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn start_oauth_server(app: tauri::AppHandle) -> Result<u16, String> {
    use std::io::{Read, Write};
    use std::net::TcpListener;

    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    tauri::async_runtime::spawn_blocking(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut buf = [0u8; 8192];
            let n = stream.read(&mut buf).unwrap_or(0);
            let request = String::from_utf8_lossy(&buf[..n]);

            let code_opt = extract_oauth_param(&request, "code");
            let error_opt = extract_oauth_param(&request, "error");

            let html = if code_opt.is_some() {
                "<html><head><meta charset='utf-8'></head><body style='font-family:sans-serif;text-align:center;padding:60px;background:#0f0f23;color:#e0e0ff'><h2 style='color:#34d399'>&#x2705; 認証成功！</h2><p>このタブを閉じてアプリに戻ってください。</p></body></html>"
            } else {
                "<html><head><meta charset='utf-8'></head><body style='font-family:sans-serif;text-align:center;padding:60px;background:#0f0f23;color:#e0e0ff'><h2 style='color:#ef4444'>&#x274c; 認証エラー</h2><p>このタブを閉じて再度お試しください。</p></body></html>"
            };

            let _ = write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                html.as_bytes().len(),
                html
            );
            let _ = stream.flush();

            if let Some(code) = code_opt {
                let _ = app.emit("oauth-code", code);
            } else if let Some(err) = error_opt {
                let _ = app.emit("oauth-error", err);
            }
        }
    });

    Ok(port)
}

fn url_decode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex) = std::str::from_utf8(&bytes[i+1..i+3]) {
                if let Ok(b) = u8::from_str_radix(hex, 16) {
                    out.push(b as char);
                    i += 3;
                    continue;
                }
            }
        } else if bytes[i] == b'+' {
            out.push(' ');
            i += 1;
            continue;
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
}

fn extract_oauth_param(request: &str, param: &str) -> Option<String> {
    let path = request.lines().next()?.split_whitespace().nth(1)?;
    let query = path.split('?').nth(1)?;
    for kv in query.split('&') {
        let mut parts = kv.splitn(2, '=');
        if parts.next()? == param {
            return Some(url_decode(parts.next()?));
        }
    }
    None
}

fn is_safe_url(url: &str) -> bool {
    (url.starts_with("https://") || url.starts_with("http://"))
        && url.len() < 2048
        && !url.contains('\0')
        && !url.chars().any(|c| c.is_control())
}

// ページ上に「MONGENEに取り込む」ボタンを注入するスクリプト
const CAPTURE_INIT_SCRIPT: &str = r#"
(function () {
  'use strict';

  function addBtn() {
    if (document.getElementById('__mongene_capture_btn__')) return;
    const btn = document.createElement('button');
    btn.id    = '__mongene_capture_btn__';
    btn.innerHTML = '&#x1F4E5;&nbsp;MONGENEに取り込む';
    const S = btn.style;
    S.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px',
      'z-index:2147483647',
      'padding:14px 22px',
      'background:#6366f1', 'color:#fff',
      'border:none', 'border-radius:14px',
      'font-size:15px', 'font-weight:700',
      'cursor:pointer',
      'box-shadow:0 4px 24px rgba(99,102,241,0.55)',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
      'transition:background 0.15s',
    ].join(';');
    btn.onmouseenter = () => { btn.style.background = '#4f46e5'; };
    btn.onmouseleave = () => { btn.style.background = '#6366f1'; };

    btn.onclick = async () => {
      btn.innerHTML = '&#x23F3;&nbsp;取り込み中...';
      btn.disabled  = true;
      try {
        const title   = document.title || location.href;
        const walker  = document.createTreeWalker(
          document.body, NodeFilter.SHOW_TEXT,
          { acceptNode(n) {
              const p  = n.parentElement;
              if (!p) return NodeFilter.FILTER_REJECT;
              const cs = window.getComputedStyle(p);
              if (cs.display === 'none' || cs.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
              const tag = p.tagName.toUpperCase();
              if (['SCRIPT','STYLE','NOSCRIPT','TEMPLATE'].includes(tag)) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
          }}
        );
        const seen = new Set();
        let node, content = '';
        while ((node = walker.nextNode())) {
          const t = node.textContent.trim();
          if (t.length > 3 && !seen.has(t)) { seen.add(t); content += t + '\n'; }
        }
        // Tauri APIが注入されるまで最大3秒待機
        let tries = 0;
        while (!window.__TAURI__ && tries++ < 30) {
          await new Promise(r => setTimeout(r, 100));
        }
        if (!window.__TAURI__) throw new Error('Tauri API unavailable');
        await window.__TAURI__.core.invoke('store_captured_content', {
          title, content: content.slice(0, 400000)
        });
        btn.innerHTML = '&#x2705;&nbsp;取り込み完了！';
        setTimeout(() => window.close(), 1800);
      } catch (e) {
        btn.innerHTML = '&#x274C;&nbsp;' + String(e).slice(0, 60);
        btn.disabled  = false;
      }
    };
    (document.body || document.documentElement).appendChild(btn);
  }

  // DOMContentLoaded 以降に追加＋SPA 遷移でも再挿入
  if (document.body) { addBtn(); }
  else { document.addEventListener('DOMContentLoaded', addBtn); }
  const observer = new MutationObserver(() => addBtn());
  const startObs = () => observer.observe(document.body || document.documentElement, { childList: true });
  if (document.body) { startObs(); }
  else { document.addEventListener('DOMContentLoaded', startObs); }
})();
"#;

/// アプリ内ブラウザで任意のHTTPSページを開く。
/// 初回ログインが必要なサービス（NotebookLM 等）も利用可。
#[tauri::command]
async fn open_notebooklm_window(app: tauri::AppHandle, url: String) -> Result<(), String> {
    if !is_safe_url(&url) {
        return Err("無効なURLです（https:// または http:// のみ対応）".to_string());
    }
    let parsed: url::Url = url.parse().map_err(|_| "URLのパースに失敗しました".to_string())?;

    // すでにウィンドウが開いていればフォーカスして返す
    if let Some(w) = app.get_webview_window("nlm-browser") {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }

    tauri::WebviewWindowBuilder::new(
        &app,
        "nlm-browser",
        tauri::WebviewUrl::External(parsed),
    )
    .title("MONGENE - ページ取り込み（初回はGoogleログインが必要です）")
    .inner_size(1280.0, 860.0)
    .initialization_script(CAPTURE_INIT_SCRIPT)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// アプリ内ブラウザから取り込んだコンテンツを main ウィンドウへ転送する
#[tauri::command]
async fn store_captured_content(
    app: tauri::AppHandle,
    title: String,
    content: String,
) -> Result<(), String> {
    app.emit("content-captured", serde_json::json!({ "title": title, "content": content }))
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn is_safe_filename(name: &str) -> bool {
    !name.is_empty()
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains("..")
        && name.chars().all(|c| !c.is_control())
}

#[tauri::command]
async fn save_bytes_to_downloads(filename: String, data: Vec<u8>) -> Result<String, String> {
    use std::path::PathBuf;
    if !is_safe_filename(&filename) {
        return Err("無効なファイル名です".to_string());
    }
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let path = PathBuf::from(home).join("Downloads").join(&filename);
    std::fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn save_text_to_downloads(filename: String, content: String) -> Result<String, String> {
    use std::path::PathBuf;
    if !is_safe_filename(&filename) {
        return Err("無効なファイル名です".to_string());
    }
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let path = PathBuf::from(home).join("Downloads").join(&filename);
    let bytes = content.as_bytes();
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(format!("{} ({} bytes)", path.to_string_lossy(), bytes.len()))
}

/// SEIBUTURAG への GET リクエストを Rust 経由で中継（CORS 回避）
#[tauri::command]
async fn seibuturag_get(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status().as_u16()));
    }
    res.text().await.map_err(|e| e.to_string())
}

/// SEIBUTURAG への POST リクエストを Rust 経由で中継（CORS 回避）
#[tauri::command]
async fn seibuturag_post(url: String, body: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let res = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status().as_u16()));
    }
    res.text().await.map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            start_oauth_server,
            save_bytes_to_downloads,
            save_text_to_downloads,
            open_notebooklm_window,
            store_captured_content,
            seibuturag_get,
            seibuturag_post,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
