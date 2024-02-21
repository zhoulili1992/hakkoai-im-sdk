import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import enUS from './locales/en_US'
import jaJP from './locales/ja_JP'
import elementEnLocale from "element-plus/es/locale/lang/en";
import elementJaLocale from "element-plus/es/locale/lang/ja";
import elementZhLocale from "element-plus/es/locale/lang/zh-cn";
const messages = {
  en: {
    ...elementEnLocale,
    ...enUS,
  },
  ja: {
    ...elementJaLocale,
    ...jaJP,
  },
  zh: {
    ...elementZhLocale,
    ...zhCN,
  },
};

export const getLocale = async () => {
  const pageLanguage = "zh";
  if (pageLanguage) {
    return pageLanguage;
  }
  const language = navigator.language.toLowerCase();
  const locales = Object.keys(messages);
  for (const locale of locales) {
    if (language.indexOf(locale) > -1) {
      return locale;
    }
  }
  // Default language is zh
  return "zh";
};

const i18n = createI18n({
  legacy: false,
  locale: await getLocale(), // 默认语言
  messages,
});

export default i18n
