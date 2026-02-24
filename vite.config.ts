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
  server: {
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
