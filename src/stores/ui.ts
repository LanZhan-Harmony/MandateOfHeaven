import { getCurrentWindow } from "@tauri-apps/api/window";
import { defineStore } from "pinia";
import { ref, watch } from "vue";
import i18n from "../langs";

export const useUIStore = defineStore("ui", () => {
  // 从 i18n 实例获取初始值（该实例已包含 localStorage 和 浏览器语言探测逻辑）
  const locale = ref(i18n.global.locale.value);
  const allLocales = ["en-US", "zh-CN", "zh-HK", "ko-KR", "ja-JP", "ru-RU"];

  // 监听语言变化，保存到 localStorage 并更新 i18n 实例
  watch(locale, (newLocale) => {
    localStorage.setItem("locale", newLocale);
    i18n.global.locale.value = newLocale;
  });

  // 播放速度索引，持久化到 localStorage
  const storedSpeedIndex = localStorage.getItem("playbackRateIndex");
  const playbackRateIndex = ref(storedSpeedIndex !== null ? parseInt(storedSpeedIndex, 10) : 1);
  watch(playbackRateIndex, (val) => localStorage.setItem("playbackRateIndex", val.toString()));

  // ── 全屏模式 ──────────────────────────────────────────────────────────
  const storedFullscreen = localStorage.getItem("fullscreen");
  const fullscreen = ref(storedFullscreen !== null ? storedFullscreen === "true" : true);

  watch(fullscreen, (val) => localStorage.setItem("fullscreen", val.toString()));

  /** 应用全屏状态 */
  async function applyFullscreen(enabled: boolean) {
    if ((window as any).__TAURI_INTERNALS__) {
      await getCurrentWindow().setFullscreen(enabled);
    } else if (enabled) {
      await document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    fullscreen.value = enabled;
  }

  /** 切换全屏状态 */
  async function toggleFullscreen() {
    await applyFullscreen(!fullscreen.value);
  }

  return {
    locale,
    allLocales,
    playbackRateIndex,
    fullscreen,
    applyFullscreen,
    toggleFullscreen,
  };
});
