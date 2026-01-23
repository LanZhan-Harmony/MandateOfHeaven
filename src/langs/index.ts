import { createI18n } from "vue-i18n";
import en from "./common/en-US.json";
import zh from "./common/zh-CN.json";

const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: "zh-CN", // 默认语言
  fallbackLocale: "en-US", // 备用语言
  messages: {
    "zh-CN": zh,
    "en-US": en,
  },
});

export default i18n;
