import type { Plugin } from "vite";

/**
 * Vite 构建插件：将 public/ 静态资源路径重写为 Tauri stream 协议 URL。
 *
 * 问题背景：
 *   copyPublicDir: false → dist/ 中无 public/ 资源 → Tauri 内置 asset handler 找不到图片/字体。
 *   但 bundle.resources 仍会把 public/ 复制到 resource_dir，
 *   而 stream:// 协议 handler（lib.rs）已能从 resource_dir 读取任意文件。
 *
 * 解决思路：
 *   仅在 production build 时，把源码中所有指向 public/ 子目录的路径
 *   （如 /common/images/xxx.png）自动加上 stream 协议前缀
 *   （如 http://stream.localhost/common/images/xxx.png），
 *   让 Tauri WebView 走 stream 协议而非内置 asset 查找。
 *
 * 不影响：
 *   - dev 模式（Vite 开发服务器天然支持 public/ 静态资源）
 *   - Android（AssetHelper.kt 在 Rust 之前拦截请求）
 *   - 已使用 toStreamUrl() 的视频/音频
 */

/** public/ 下需要被重写的一级子目录 */
const PUBLIC_DIRS = ["common", "chapters", "characters", "achievements", "storylines"];

const STREAM_ORIGIN = "http://stream.localhost";

/**
 * 构建一个正则，匹配对 public/ 子目录的路径引用。
 *
 * 匹配以下上下文中的路径：
 *   url("/common/...")          — CSS url() 带引号
 *   url(/common/...)            — CSS url() 无引号
 *   src="/common/..."           — HTML 属性
 *   "/common/..."               — JS 双引号字符串
 *   '/common/...'               — JS 单引号字符串
 *   `/characters/...`           — JS 模板字面量
 *
 * 策略：匹配 "前导字符 + /knownDir/" 模式
 *   前导字符 = " | ' | ` | (      （引号、反引号或左括号）
 *   路径 = /knownDir/             （已知的一级目录）
 *
 * 捕获组：
 *   $1 = 前导上下文字符
 *   $2 = /knownDir/ 路径起始
 */
function buildRewriteRegex(): RegExp {
  const dirs = PUBLIC_DIRS.join("|");
  return new RegExp(`(["'\`(])(\\/(${dirs})\\/)`, "g");
}

export function tauriPublicAssetPlugin(): Plugin {
  const rewriteRe = buildRewriteRegex();

  return {
    name: "tauri-public-asset-rewrite",
    apply: "build",
    enforce: "pre",

    transform(code, id) {
      // 只处理前端源码文件
      if (!/\.(vue|ts|tsx|js|jsx|css|scss|less)(\?.*)?$/.test(id)) {
        return null;
      }

      // 跳过 node_modules
      if (id.includes("node_modules")) {
        return null;
      }

      // 快速检查：文件中是否包含任何需要重写的目录名
      if (!PUBLIC_DIRS.some((dir) => code.includes(`/${dir}/`))) {
        return null;
      }

      // 替换：在前导字符和路径之间插入 stream 协议前缀
      // ("  +  /common/  →  ("  +  http://stream.localhost/common/
      const rewritten = code.replace(rewriteRe, (match, prefix, path, _dir, offset, wholeString) => {
        // 跳过 ES 导入/导出及 require 语句，避免生成非法的外部 ES 模块导致浏览器 MIME 检查报错
        const before = (wholeString as any).substring(0, offset as number).trimEnd();
        if (
          before.endsWith("from") ||
          before.endsWith("import") ||
          before.endsWith("import(") ||
          before.endsWith("require") ||
          before.endsWith("require(")
        ) {
          return match;
        }
        return `${prefix}${STREAM_ORIGIN}${path}`;
      });

      if (rewritten === code) {
        return null;
      }

      return {
        code: rewritten,
        map: null,
      };
    },
  };
}
