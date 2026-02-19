import { defineStore } from "pinia";
import { ref, watch } from "vue";
import i18n from "../langs";

export const useUIStore = defineStore("ui", () => {
  // 从 i18n 实例获取初始值（该实例已包含 localStorage 和 浏览器语言探测逻辑）
  const locale = ref(i18n.global.locale.value);

  // 监听语言变化，保存到 localStorage 并更新 i18n 实例
  watch(locale, (newLocale) => {
    localStorage.setItem("locale", newLocale);
    i18n.global.locale.value = newLocale;
  });

  return {
    locale,
  };
});
