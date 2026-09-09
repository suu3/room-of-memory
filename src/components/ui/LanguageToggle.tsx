"use client";

import { useTranslation } from "react-i18next";
import { type Locale, SUPPORTED_LOCALES } from "@/i18n/config";
import { selectLocale, useSettingsStore } from "@/store/settings";
import {
  CHIP_BASE,
  CHIP_IDLE,
  CHIP_IDLE_PAPER,
  CHIP_SELECTED,
  CHIP_SELECTED_PAPER,
} from "./ui-classes";

const LOCALE_LABELS: Record<Locale, string> = { ko: "한", en: "EN", ja: "日" };

/** 어떤 바탕 위에 놓이는지. 글자색이 통째로 달라지므로 호출부가 정해 줘야 한다. */
export type LanguageToggleTone = "paper" | "dark";

const TONE_CLASS: Record<LanguageToggleTone, { active: string; idle: string }> = {
  /** 종이 패널 위. 잉크로 대비를 잡는다. */
  paper: { active: CHIP_SELECTED_PAPER, idle: CHIP_IDLE_PAPER },
  /** 어두운 패널·타이틀 화면. 현재 언어는 금빛 채움으로 — 선택은 금빛의 자리다. */
  dark: { active: CHIP_SELECTED, idle: CHIP_IDLE },
};

export function LanguageToggle({ tone = "dark" }: { tone?: LanguageToggleTone }) {
  const { t } = useTranslation();
  const locale = useSettingsStore(selectLocale);
  const setLocale = useSettingsStore((state) => state.setLocale);
  const toneClass = TONE_CLASS[tone];

  return (
    <fieldset className="flex gap-1.5">
      <legend className="sr-only">{t("language.label")}</legend>
      {SUPPORTED_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`${CHIP_BASE} ${locale === code ? toneClass.active : toneClass.idle}`}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </fieldset>
  );
}
