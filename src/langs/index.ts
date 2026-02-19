import { createI18n } from "vue-i18n";

// 自动导入 common 和 characters 文件夹下的所有 JSON 文件
const commonFiles = import.meta.glob("./common/*.json", { eager: true, import: "default" });
const chapterFiles = import.meta.glob("./chapters/*.json", { eager: true, import: "default" });
const characterFiles = import.meta.glob("./characters/*.json", { eager: true, import: "default" });
const storylineFiles = import.meta.glob("./storylines/*.json", { eager: true, import: "default" });
const endingFiles = import.meta.glob("./endings/*.json", { eager: true, import: "default" });

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
mergeMessages(chapterFiles, "chapters");
mergeMessages(storylineFiles, "storylines");
mergeMessages(endingFiles, "endings");

// 获取初始语言：优先读取本地缓存，其次匹配浏览器语言
const getInitialLocale = (): string => {
  const savedLocale = localStorage.getItem("locale");
  if (savedLocale) return savedLocale;

  const navLang = navigator.language;
  if (!navLang) return "en-US";

  // 匹配项目中存在的语言代码
  if (navLang.startsWith("zh")) {
    return navLang.includes("HK") || navLang.includes("TW") || navLang.includes("MO") ? "zh-HK" : "zh-CN";
  }
  if (navLang.startsWith("ja")) return "ja-JP";
  if (navLang.startsWith("ko")) return "ko-KR";
  if (navLang.startsWith("en")) return "en-US";

  return "en-US";
};

const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: getInitialLocale(), // 使用探测函数初始化
  fallbackLocale: "en-US", // 备用语言
  messages,
});

export default i18n;
