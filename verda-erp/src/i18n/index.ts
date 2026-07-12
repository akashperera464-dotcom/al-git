/**
 * Verda · i18next configuration (React Vite web app)
 * ------------------------------------------------------------------
 * Tri-lingual support: English (en) · Sinhala (si) · Tamil (ta).
 * Language is auto-detected (browser/localStorage) and the choice persists.
 * The native Expo shell mirrors this exact setup (app/src/i18n).
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import si from "./locales/si.json";
import ta from "./locales/ta.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", labelKey: "lang.en", flag: "🇬🇧" },
  { code: "si", labelKey: "lang.si", flag: "🇱🇰" },
  { code: "ta", labelKey: "lang.ta", flag: "🇮🇳" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      si: { translation: si },
      ta: { translation: ta },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: ["en", "si", "ta"],
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "verda.lang",
      caches: ["localStorage"],
    },
    react: { useSuspense: false },
  });

/** Sync the <html lang> attribute for accessibility / font shaping. */
i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
});

export default i18n;
