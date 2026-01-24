import i18n from "@/langs";
import { defineStore } from "pinia";
import { ref, watch } from "vue";

export const useUIStore = defineStore("ui", () => {
  // 从 localStorage 读取语言，默认为 'zh-CN'
  const locale = ref(localStorage.getItem("locale") || "zh-CN");

  // 监听语言变化，保存到 localStorage 并更新 i18n 实例
  watch(locale, (newLocale) => {
    localStorage.setItem("locale", newLocale);
    i18n.global.locale.value = newLocale;
  });

  return {
    locale,
  };
});
