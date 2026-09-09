"use client";

import { List, Warning, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { LanguageToggle } from "./LanguageToggle";
import {
  BACKDROP,
  BUTTON_DESTRUCTIVE,
  BUTTON_QUIET,
  CHIP_BASE,
  CHIP_IDLE,
  CHIP_SELECTED,
  HUD_ICON_BUTTON,
  MENU_ITEM,
  PANEL_DARK,
  SECTION_LABEL,
} from "./ui-classes";

/** 한 줄에 둘이 나눠 앉는 항목 — 폭만 반씩, 나머지는 MENU_ITEM과 같다. */
const PAIR_ITEM_CLASS = `${MENU_ITEM} flex-1 justify-center text-center`;

export function HudMenu() {
  const { t } = useTranslation();
  const reset = useMemoryRoomStore((state) => state.reset);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
  const setContactOpen = useMemoryRoomStore((state) => state.setContactOpen);
  const setFeedbackOpen = useMemoryRoomStore((state) => state.setFeedbackOpen);
  const difficulty = useMemoryRoomStore((state) => state.difficulty);
  const setDifficulty = useMemoryRoomStore((state) => state.setDifficulty);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUiLock("hud-menu", open || confirming);
    return () => setUiLock("hud-menu", false);
  }, [open, confirming, setUiLock]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          playSound(open ? "close" : "open");
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-label={open ? t("menu.close") : t("menu.open")}
        // 열려 있는 동안은 패널과 같은 표면으로 서서 "이 버튼이 저 패널의 것"임을 말한다
        className={`${HUD_ICON_BUTTON} ${open ? "border-line bg-surface text-ivory" : ""}`}
      >
        {open ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-2 w-68 animate-fade-rise p-4 ${PANEL_DARK}`}>
          <p className={`px-1 ${SECTION_LABEL}`}>{t("language.label")}</p>
          <div className="mt-2">
            <LanguageToggle tone="dark" />
          </div>
          <p className={`mt-4 px-1 ${SECTION_LABEL}`}>{t("difficulty.label")}</p>
          {/* 이지=스킵 열림, 보통=스킵 숨김. 게이트는 useSkipEligible 한 곳 (minigames/shell) */}
          <fieldset className="mt-2 flex gap-1.5">
            <legend className="sr-only">{t("difficulty.label")}</legend>
            {(["easy", "normal"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  playSound("select");
                  setDifficulty(mode);
                }}
                aria-pressed={difficulty === mode}
                className={`${CHIP_BASE} ${difficulty === mode ? CHIP_SELECTED : CHIP_IDLE}`}
              >
                {t(`difficulty.${mode}`)}
              </button>
            ))}
          </fieldset>
          {/* 어느 쪽이 켜져 있는지 말로도 남긴다 — 칩 두 개만으로는 뜻이 안 읽힌다 */}
          <p className="mt-1.5 break-ko px-1 text-xs leading-normal text-ash">
            {t(difficulty === "easy" ? "difficulty.easyHint" : "difficulty.normalHint")}
          </p>
          {/* 소리 on/off는 메뉴 밖으로 나갔다 — SoundToggle 참고. */}
          {/* 수첩은 여기 없다 — 오른쪽 가장자리 손잡이(NotebookTab)가 유일한 입구다. */}
          <div className="my-3 h-px bg-line" />
          {/* 만든 사람 · 피드백은 성격이 같은 부속 화면이라 한 줄에 나란히 둔다 */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => {
                playSound("select");
                setOpen(false);
                setContactOpen(true);
              }}
              className={PAIR_ITEM_CLASS}
            >
              {t("hud.contact")}
            </button>
            <span aria-hidden className="mx-1 h-3.5 w-px flex-none bg-line" />
            <button
              type="button"
              onClick={() => {
                playSound("select");
                setOpen(false);
                setFeedbackOpen(true);
              }}
              className={PAIR_ITEM_CLASS}
            >
              {t("feedback.title")}
            </button>
          </div>
          {/* 리셋은 다른 항목과 갈라 세운다 — 되돌릴 수 없는 유일한 항목이다 */}
          <div className="my-3 h-px bg-line" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
            className={`${MENU_ITEM} text-ash hover:text-ember`}
          >
            {t("hud.reset")}
          </button>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-30 flex items-center justify-center overflow-hidden p-4">
          <div aria-hidden className={BACKDROP} />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            className={`relative w-full max-w-md animate-fade-rise p-6 ${PANEL_DARK}`}
          >
            <div className="flex items-start gap-3.5">
              {/* 되돌릴 수 없는 동작이라 아이콘으로 먼저 걸러준다 — 텍스트가 이미 설명하므로 장식 */}
              <span
                aria-hidden
                className="grid size-9 flex-none place-items-center rounded-full bg-ember/20 text-ember"
              >
                <Warning size={19} weight="fill" />
              </span>
              <div className="min-w-0">
                <h2
                  id="reset-dialog-title"
                  className="break-ko text-base font-medium leading-snug text-ivory"
                >
                  {t("reset.title")}
                </h2>
                <p className="mt-2 break-ko text-pretty text-sm leading-normal text-fog">
                  {t("reset.body")}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className={BUTTON_QUIET}>
                {t("reset.cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  playSound("close");
                  reset();
                  setConfirming(false);
                }}
                className={BUTTON_DESTRUCTIVE}
              >
                {t("reset.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
