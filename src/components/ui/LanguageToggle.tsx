"use client";

import { useTranslation } from "react-i18next";
import { type Locale, SUPPORTED_LOCALES } from "@/i18n/config";
import { selectLocale, useSettingsStore } from "@/store/settings";

const LOCALE_LABELS: Record<Locale, string> = { ko: "한", en: "EN", ja: "日" };

export function LanguageToggle() {
  const { t } = useTranslation();
  const locale = useSettingsStore(selectLocale);
  const setLocale = useSettingsStore((state) => state.setLocale);

  return (
    <fieldset className="flex gap-1.5">
      <legend className="sr-only">{t("language.label")}</legend>
      {SUPPORTED_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`cursor-pointer rounded-full border-2 px-2.5 py-0.5 text-xs font-bold tracking-widest transition-colors ${
            locale === code
              ? "border-ember bg-ember text-paper"
              : "border-ink/20 text-ink/60 hover:border-ink/50 hover:text-ink"
          }`}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </fieldset>
  );
}
