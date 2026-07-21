import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: ["en", "ar", "sv", "fr", "de", "es", "tr", "ur"],
    ns: ["translation"],
    defaultNS: "translation",
    backend: {
      loadPath: `${BASE}/locales/{{lng}}/{{ns}}.json`,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "settings_lang",
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

const RTL_LANGS = ["ar", "ur"];

export function applyDirection(lang: string) {
  const dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";
  document.documentElement.dir = dir;
  document.documentElement.lang = lang === "ar" ? "ar-u-nu-latn" : lang;
  document.documentElement.setAttribute("data-dir", dir);
}

export default i18n;
