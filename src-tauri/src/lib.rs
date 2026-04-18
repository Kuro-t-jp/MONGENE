use tauri::Emitter;

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

fn extract_oauth_param(request: &str, param: &str) -> Option<String> {
    let path = request.lines().next()?.split_whitespace().nth(1)?;
    let query = path.split('?').nth(1)?;
    for kv in query.split('&') {
        let mut parts = kv.splitn(2, '=');
        if parts.next()? == param {
            return Some(parts.next()?.to_string());
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, start_oauth_server])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
