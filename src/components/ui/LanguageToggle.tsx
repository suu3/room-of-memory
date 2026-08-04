"use client";

import { useTranslation } from "react-i18next";
import { type Locale, SUPPORTED_LOCALES } from "@/i18n/config";
import { selectLocale, useSettingsStore } from "@/store/settings";

const LOCALE_LABELS: Record<Locale, string> = { ko: "한", en: "EN", ja: "日" };

/** 어떤 바탕 위에 놓이는지. 글자색이 통째로 달라지므로 호출부가 정해 줘야 한다. */
export type LanguageToggleTone = "paper" | "dark";

const TONE_CLASS: Record<LanguageToggleTone, { active: string; idle: string }> = {
  /** 종이 패널 위 (HUD 메뉴). 잉크로 대비를 잡는다. */
  paper: {
    active: "border-ink bg-ink text-paper",
    idle: "border-ink/15 text-ink/60 hover:border-ink/40 hover:text-ink active:bg-ink/5",
  },
  /**
   * 어두운 배경 위 (타이틀 화면). 종이 알약을 깔면 시작 버튼과 재질이 같아져
   * 둘의 위계가 나란해 보인다 — 배경에 직접 얹고, 현재 언어는 채움이 아니라
   * 글자색(memory)으로만 표시한다.
   */
  dark: {
    active: "border-memory/40 text-memory",
    idle: "border-transparent text-bone/40 hover:border-bone/25 hover:text-bone/80 active:text-bone",
  },
};

export function LanguageToggle({ tone = "paper" }: { tone?: LanguageToggleTone }) {
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
          className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-bold tracking-widest transition-colors ${
            locale === code ? toneClass.active : toneClass.idle
          }`}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </fieldset>
  );
}
