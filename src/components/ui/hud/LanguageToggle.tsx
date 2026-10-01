"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type Locale, SUPPORTED_LOCALES } from "@/i18n/config";
import { selectLocale, useSettingsStore } from "@/store/settings";
import {
  CHIP_BASE,
  CHIP_IDLE,
  CHIP_IDLE_PAPER,
  CHIP_SELECTED,
  CHIP_SELECTED_PAPER,
  FOCUS_RING,
  HUD_CHOICE_BASE,
  HUD_CHOICE_IDLE,
  HUD_CHOICE_SELECTED,
} from "../shared/ui-classes";

const LOCALE_LABELS: Record<Locale, string> = { ko: "한", en: "EN", ja: "日" };

/** 어떤 바탕 위에 놓이는지. 글자색이 통째로 달라지므로 호출부가 정해 줘야 한다. */
export type LanguageToggleTone = "paper" | "dark" | "bare" | "hud";

const TONE_CLASS: Record<LanguageToggleTone, { base: string; active: string; idle: string }> = {
  /** 종이 패널 위. 잉크로 대비를 잡는다. */
  paper: { base: CHIP_BASE, active: CHIP_SELECTED_PAPER, idle: CHIP_IDLE_PAPER },
  /** 어두운 패널(HUD 메뉴). 현재 언어는 금빛 채움으로: 선택은 금빛의 자리다. */
  dark: { base: CHIP_BASE, active: CHIP_SELECTED, idle: CHIP_IDLE },
  /**
   * 타이틀 화면. 상자 없이 글자와 밑줄만: 세 개의 박스가 서면 메뉴 아래 조작부가
   * 하나 더 생긴다. 밑줄은 늘 있고 색만 바뀌므로 hover에서 자리가 안 움직인다.
   */
  bare: {
    // 밑줄은 항목마다 그리지 않고 하나(.lang-underline)가 고른 글자 밑으로 미끄러져 간다
    base: `cursor-pointer px-1.5 pb-1 pt-0.5 text-sm font-medium transition-colors duration-150 ${FOCUS_RING}`,
    active: "text-ivory",
    idle: "text-fog hover:text-ivory active:text-ivory",
  },
  /** 넓은 화면에서 펼친 HUD 메뉴 줄(HudMenu inline). 장면 위에 글자와 밑줄만 선다 */
  hud: { base: HUD_CHOICE_BASE, active: HUD_CHOICE_SELECTED, idle: HUD_CHOICE_IDLE },
};

export function LanguageToggle({ tone = "dark" }: { tone?: LanguageToggleTone }) {
  const { t } = useTranslation();
  const locale = useSettingsStore(selectLocale);
  const setLocale = useSettingsStore((state) => state.setLocale);
  const toneClass = TONE_CLASS[tone];
  const buttonsRef = useRef<Partial<Record<Locale, HTMLButtonElement | null>>>({});
  /** bare 톤의 밑줄 자리. 고른 버튼을 재서 놓고, 바뀌면 CSS transition이 미끄러뜨린다 */
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (tone !== "bare") return;
    const measure = () => {
      const button = buttonsRef.current[locale];
      if (!button) return;
      setUnderline({ left: button.offsetLeft, width: button.offsetWidth });
    };
    measure();
    // 폰트가 늦게 오거나 창이 바뀌면 글자 폭이 달라진다
    window.addEventListener("resize", measure);
    document.fonts?.addEventListener?.("loadingdone", measure);
    return () => {
      window.removeEventListener("resize", measure);
      document.fonts?.removeEventListener?.("loadingdone", measure);
    };
  }, [tone, locale]);

  return (
    <fieldset
      className={
        tone === "bare"
          ? "relative flex gap-4"
          : tone === "hud"
            ? "flex gap-[0.25em]"
            : "flex gap-1.5"
      }
    >
      <legend className="sr-only">{t("language.label")}</legend>
      {SUPPORTED_LOCALES.map((code) => (
        <button
          key={code}
          ref={(element) => {
            buttonsRef.current[code] = element;
          }}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`${toneClass.base} ${locale === code ? toneClass.active : toneClass.idle}`}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
      {tone === "bare" && underline && (
        <span
          aria-hidden
          className="lang-underline pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-memory"
          style={{ left: underline.left, width: underline.width }}
        />
      )}
    </fieldset>
  );
}
