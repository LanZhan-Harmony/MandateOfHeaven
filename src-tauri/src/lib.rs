#[cfg(desktop)]
use http_range::HttpRange;
#[cfg(desktop)]
use std::collections::HashMap;
#[cfg(desktop)]
use std::sync::{Arc, Mutex};
use tauri::http::Response;

#[cfg(desktop)]
use tauri::Manager;

/// 已加载资源的缓存条目
#[cfg(desktop)]
struct CachedAsset {
  bytes: Arc<Vec<u8>>,
  mime: String,
}

/// 根据文件扩展名猜测 MIME 类型（避免引入额外依赖）
#[cfg(desktop)]
fn mime_from_ext(path: &str) -> &'static str {
  match path.rsplit('.').next().unwrap_or("").to_lowercase().as_str() {
    "mp4" => "video/mp4",
    "webm" => "video/webm",
    "mp3" => "audio/mpeg",
    "ogg" => "audio/ogg",
    "wav" => "audio/wav",
    "png" => "image/png",
    "jpg" | "jpeg" => "image/jpeg",
    "gif" => "image/gif",
    "webp" => "image/webp",
    "svg" => "image/svg+xml",
    "vtt" => "text/vtt",
    "srt" => "text/plain",
    "json" => "application/json",
    _ => "application/octet-stream",
  }
}

#[tauri::command]
fn exit_app(app_handle: tauri::AppHandle) {
  app_handle.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // 缓存：避免每次 Range 请求都重新解压/加载整个文件
  // key = 路径, value = (字节数据, MIME 类型)
  #[cfg(desktop)]
  let asset_cache: Arc<Mutex<HashMap<String, CachedAsset>>> = Arc::default();

  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .invoke_handler(tauri::generate_handler![exit_app])
    .register_uri_scheme_protocol("stream", move |ctx, request| {
      let uri_path = request.uri().path();
      let path = uri_path.to_string();

      // ── 移动端 ────────────────────────────────────────────────────────────
      // 媒体资产不再嵌入 APK native binary（否则链接器 OOM）。
      // Android 请使用服务器 URL 代替 stream:// 协议。
      #[cfg(mobile)]
      {
        let _ = (ctx, path);
        return Response::builder()
          .status(404)
          .header("Access-Control-Allow-Origin", "*")
          .body(b"stream protocol not available on mobile; use server URL".to_vec())
          .unwrap();
      }

      // ── 桌面端 ────────────────────────────────────────────────────────────
      // 从 resource_dir/public/ 读取文件（文件系统，不编译进二进制）。
      // tauri.conf.json 中 bundle.resources 将 public/ 复制到 resource_dir。
      #[cfg(desktop)]
      {
        // 快速查缓存（短时间持锁，避免阻塞其他请求）
        let cached = {
          let cache = asset_cache.lock().unwrap();
          cache.get(&path).map(|e| (e.bytes.clone(), e.mime.clone()))
        };

        let (bytes, mime) = if let Some(hit) = cached {
          hit
        } else {
          // 构造文件系统路径：resource_dir/public/<rel_path>
          let resource_dir = match ctx.app_handle().path().resource_dir() {
            Ok(d) => d,
            Err(e) => {
              return Response::builder()
                .status(500)
                .header("Access-Control-Allow-Origin", "*")
                .body(format!("Failed to resolve resource dir: {e}").into_bytes())
                .unwrap();
            }
          };
          // uri_path 形如 /chapters/xxx/video.mp4，去掉前导 / 再拼路径
          let rel = path.trim_start_matches('/');
          let file_path = resource_dir.join(rel);

          let data = match std::fs::read(&file_path) {
            Ok(d) => d,
            Err(e) => {
              return Response::builder()
                .status(404)
                .header("Access-Control-Allow-Origin", "*")
                .body(format!("Asset not found: {path} ({e})").into_bytes())
                .unwrap();
            }
          };

          let bytes = Arc::new(data);
          let mime = mime_from_ext(&path).to_string();

          // IO 完成后再短暂持锁写入缓存
          {
            let mut cache = asset_cache.lock().unwrap();
            // 限制缓存大小（最多保留 3 个文件，与前端预加载数量一致）
            while cache.len() >= 3 {
              if let Some(key) = cache.keys().next().cloned() {
                cache.remove(&key);
              }
            }
            cache.insert(
              path.clone(),
              CachedAsset {
                bytes: bytes.clone(),
                mime: mime.clone(),
              },
            );
          }

          (bytes, mime)
        };

        let file_len = bytes.len() as u64;

        // 解析 Range 请求头
        let range_header = request
          .headers()
          .get("range")
          .and_then(|v| v.to_str().ok());

        match range_header {
          Some(range_str) => {
            let ranges = match HttpRange::parse(range_str, file_len) {
              Ok(r) => r,
              Err(_) => {
                return Response::builder()
                  .status(416)
                  .header("Content-Range", format!("bytes */{file_len}"))
                  .header("Access-Control-Allow-Origin", "*")
                  .body(Vec::new())
                  .unwrap();
              }
            };
            let r = &ranges[0];
            let start = r.start as usize;
            let len = r.length as usize;
            let end = start + len - 1;

            Response::builder()
              .status(206)
              .header("Content-Type", &mime)
              .header("Accept-Ranges", "bytes")
              .header("Access-Control-Allow-Origin", "*")
              .header("Access-Control-Expose-Headers", "content-range")
              .header(
                "Content-Range",
                format!("bytes {start}-{end}/{file_len}"),
              )
              .header("Content-Length", len.to_string())
              .body(bytes[start..start + len].to_vec())
              .unwrap()
          }
          None => Response::builder()
            .status(200)
            .header("Content-Type", &mime)
            .header("Accept-Ranges", "bytes")
            .header("Access-Control-Allow-Origin", "*")
            .header("Content-Length", file_len.to_string())
            .body(bytes.to_vec())
            .unwrap(),
        }
      }
    })
    .setup(|app| {
      // 日志始终开启（Stdout → logcat + LogDir → 文件），方便 Android 排查问题
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Debug)
          .targets([
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
              file_name: None,
            }),
          ])
          .max_file_size(5_000_000) // 5 MB 日志轮转
          .build(),
      )?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
