import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import pkg from "./package.json";

// https://vite.dev/config/
export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
  },
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // 预打包重型依赖，避免冷启动时浏览器逐个请求导致白屏
  optimizeDeps: {
    // 锁定扫描入口，防止 dep-scan 爬取 src-tauri/target/doc/ 下的数万个 HTML 文件
    // 导致 EMFILE: too many open files 错误
    entries: ["index.html"],
    include: ["video.js", "vue", "vue-router", "pinia", "vue-i18n", "@vueuse/core"],
  },
  build: {
    // 不把 public/（游戏媒体资产 ~930MB）复制进 dist/，
    // 否则 Tauri Android 编译时会把它们全部嵌入 native binary 导致 OOM。
    copyPublicDir: false,
  },
  server: {
    // 禁止 Vite 开发服务器访问/提供这些目录下的文件
    fs: {
      deny: ["src-tauri/target", "src-tauri/gen"],
    },
    // 排除无需 HMR 监听的大型目录，避免 chokidar 扫描数 GB 文件导致启动慢
    watch: {
      ignored: [
        "**/public/**", // 游戏资产（视频/音频/图片，~930 MB）
        "**/dist/**", // 前端构建输出
        "**/src-tauri/target/**", // Rust 编译产物（~22 GB）
        "**/src-tauri/gen/**", // Android 生成文件（~3.5 GB）
        "**/node_modules/**", // 依赖（chokidar 默认已忽略，显式声明更稳）
      ],
    },
    // 预热核心页面，服务就绪后立即编译，浏览器打开直接命中缓存
    warmup: {
      clientFiles: [
        "./src/App.vue",
        "./src/views/PlayerView.vue",
        "./src/views/MainMenuView.vue",
        "./src/components/StoryletPlayer.vue",
      ],
    },
    proxy: {
      "/api": {
        target: "https://prod.beifa.shyingyou.cn",
        changeOrigin: true,
        configure: (proxy, options) => {
          proxy.on("proxyReq", (proxyReq, req, res) => {
            // 浏览器会屏蔽 User-Agent 修改，我们在代理层强制注入
            proxyReq.setHeader(
              "User-Agent",
              "BeifaClientFull/1.1.16 (packaged:release) Electron/37.10.3 Chromium/138.0.7204.251 Node/22.21.1 win32/10.0.26200 (Windows_NT; x64; Windows 11 Pro for Workstations)",
            );
            proxyReq.setHeader("Locale", "zh_CN");

            // 如果浏览器请求没带 Cookie，我们注入一个初始的
            // 这样如果你在浏览器里清了 Cookie，它也能回血
            const initialCookie =
              "_session=RuiqQtzqqy7vrQIqbyW9SaGeNHztnhMGz6BodMxjX%2F%2BV7V2%2Fj81EocLCifhCTapK79H71i3B1Fat0LeqZJUx1tp4jrF5Kz6%2FsXGFuX7IfoRz%2B4d8aTFTRBgA40Kbkua%2BuofcgL2ELu1ZBKwQ5vPJw6fgAUjmid8H78NAxwc0GLdTjKHlr1M8YFizbuUNP1EA4ajdqKBmSKXkqQyRxAzT5qniYITiuZmqrVM%3D--k4e58DkIl1euDFkk--n0kxkQAvLI7yrw1iqsqjdQ%3D%3D";

            if (!req.headers.cookie || !req.headers.cookie.includes("_session=")) {
              proxyReq.setHeader("Cookie", initialCookie);
            }
          });
        },
      },
    },
  },
});
