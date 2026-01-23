import { createI18n } from "vue-i18n";

// 自动导入 common 和 characters 文件夹下的所有 JSON 文件
const commonFiles = import.meta.glob("./common/*.json", { eager: true, import: "default" });
const characterFiles = import.meta.glob("./characters/*.json", { eager: true, import: "default" });

const messages: Record<string, any> = {};

// 合并语言包函数
const mergeMessages = (files: Record<string, any>, prefix: string) => {
  Object.keys(files).forEach((path) => {
    // 从路径中提取语言代码，例如 "./common/zh-CN.json" -> "zh-CN"
    const langMatch = path.match(new RegExp(`\\.\\/${prefix}\\/(.*)\\.json$`));
    if (langMatch) {
      const lang = langMatch[1]!;
      if (!messages[lang]) {
        messages[lang] = {};
      }
      Object.assign(messages[lang], files[path]);
    }
  });
};

mergeMessages(commonFiles, "common");
mergeMessages(characterFiles, "characters");

const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: "zh-CN", // 默认语言
  fallbackLocale: "en-US", // 备用语言
  messages,
});

export default i18n;
