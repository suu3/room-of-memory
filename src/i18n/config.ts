import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "./locales/en/common.json";
import enMemoryRoom from "./locales/en/memory-room.json";
import jaCommon from "./locales/ja/common.json";
import jaMemoryRoom from "./locales/ja/memory-room.json";
import koCommon from "./locales/ko/common.json";
import koMemoryRoom from "./locales/ko/memory-room.json";

export const SUPPORTED_LOCALES = ["ko", "en", "ja"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ko";

export const resources = {
  ko: { common: koCommon, memoryRoom: koMemoryRoom },
  en: { common: enCommon, memoryRoom: enMemoryRoom },
  ja: { common: jaCommon, memoryRoom: jaMemoryRoom },
} as const;

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });
}

export { i18n };
