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
              "_session=rhVH54%2FcMxT3OStH%2B8mPbaO2mrZL8lLQw1p7MKwtRXmHYComn3Y0h%2BByq8WbcyGUt5ZVsMWwVc%2BmA3kP9eySzjTJfTNtpmkxdn0wCpsOjjg2JHffVdWWOqtJMylZxIZWxHzqvvOR9VGPneDVMwOUJazherpz%2Fb81yfmQkOnvWb8KjejSgk3ppvcs9QBDCdTR2A9uGtRtZaQ7AS4uDJMNb3wnW1CPGDianQI%3D--He4qG2rEreLyaBdH--TttKxwdX%2FaUQ4XRAF4dQxA%3D%3D";

            if (!req.headers.cookie || !req.headers.cookie.includes("_session=")) {
              proxyReq.setHeader("Cookie", initialCookie);
            }
          });
        },
      },
    },
  },
});
