/**
 * Verda · i18next configuration (React Native / Expo shell)
 * ------------------------------------------------------------------
 * Tri-lingual support: English (en) · Sinhala (si) · Tamil (ta).
 * Persists the choice in AsyncStorage (same key the web PWA uses:
 * 'verda.lang') so the WebView's PWA reads the same preference and the
 * shell + embedded web app stay in sync.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./locales/en.json";
import si from "./locales/si.json";
import ta from "./locales/ta.json";

export const STORAGE_KEY = "verda.lang";

export const SUPPORTED_LANGUAGES = [
  { code: "en", labelKey: "lang.en", flag: "🇬🇧" },
  { code: "si", labelKey: "lang.si", flag: "🇱🇰" },
  { code: "ta", labelKey: "lang.ta", flag: "🇮🇳" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    si: { translation: si },
    ta: { translation: ta },
  },
  lng: "en",
  fallbackLng: "en",
  supportedLngs: ["en", "si", "ta"],
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

// Hydrate the saved language (async, non-blocking).
void (async () => {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && ["en", "si", "ta"].includes(saved)) {
      await i18n.changeLanguage(saved);
    }
  } catch {
    /* ignore storage read errors */
  }
})();

// Persist any future language change.
i18n.on("languageChanged", (lng) => {
  void AsyncStorage.setItem(STORAGE_KEY, lng).catch(() => {});
});

export default i18n;
