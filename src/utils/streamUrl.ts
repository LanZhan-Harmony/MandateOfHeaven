/**
 * 将相对路径转换为支持 Range 请求的流媒体 URL。
 *
 * - Tauri 生产环境：使用自定义 `stream` 协议（支持 206 Partial Content）
 * - Dev / 浏览器：直接返回原路径（Vite 开发服务器天然支持 Range）
 */
export function toStreamUrl(path: string): string {
  if (!(window as any).__TAURI_INTERNALS__ || import.meta.env.DEV) {
    return path;
  }

  // Android: 通过本地 HTTP 服务器提供视频/音频，彻底绕过 shouldInterceptRequest 对大文件的限制
  if (/android/i.test(navigator.userAgent)) {
    return `http://127.0.0.1:18765${path}`;
  }

  // Desktop Tauri production:
  // - Windows: http://<scheme>.localhost/
  // - macOS / Linux: <scheme>://localhost/
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return `http://stream.localhost${path}`;
  }
  return `stream://localhost${path}`;
}
