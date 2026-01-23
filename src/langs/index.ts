import { createI18n } from "vue-i18n";
import en from "./en.json";
import zh from "./zh.json";

const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: "zh", // 默认语言
  fallbackLocale: "en", // 备用语言
  messages: {
    zh,
    en,
  },
});

export default i18n;
