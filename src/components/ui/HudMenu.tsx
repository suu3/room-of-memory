"use client";

import { List, Warning, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { LanguageToggle } from "./LanguageToggle";

const ITEM_CLASS =
  "block w-full cursor-pointer rounded-md px-2.5 py-2 text-left text-xs font-bold tracking-widest text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink active:bg-ink/10";

const CHIP_CLASS =
  "cursor-pointer rounded-full border border-ink/15 px-4 py-1.5 text-xs font-bold tracking-widest text-ink/60 transition-all hover:border-ink/40 hover:text-ink active:translate-y-px active:bg-ink/5";

export function HudMenu() {
  const { t } = useTranslation();
  const reset = useMemoryRoomStore((state) => state.reset);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
  const setCharacterSheetOpen = useMemoryRoomStore((state) => state.setCharacterSheetOpen);
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
        className="grid size-10 cursor-pointer place-items-center rounded-full border border-bone bg-paper text-ink/80 shadow-chip transition-all hover:-translate-y-0.5 hover:border-memory hover:text-ink active:translate-y-0 active:scale-95"
      >
        {open ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-68 animate-fade-rise rounded-xl border border-bone bg-paper p-5 shadow-panel">
          <p className="px-0.5 text-xs font-bold tracking-widest text-ink/50">
            {t("language.label")}
          </p>
          <div className="mt-2">
            <LanguageToggle />
          </div>
          <p className="mt-4 px-0.5 text-xs font-bold tracking-widest text-ink/50">
            {t("difficulty.label")}
          </p>
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
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-bold tracking-widest transition-colors ${
                  difficulty === mode
                    ? "border-ink bg-ink text-paper"
                    : "border-ink/15 text-ink/60 hover:border-ink/40 hover:text-ink active:bg-ink/5"
                }`}
              >
                {t(`difficulty.${mode}`)}
              </button>
            ))}
          </fieldset>
          {/* 어느 쪽이 켜져 있는지 말로도 남긴다 — 칩 두 개만으로는 뜻이 안 읽힌다 */}
          <p className="mt-1.5 px-0.5 text-[0.6875rem] leading-relaxed text-ink/45">
            {t(difficulty === "easy" ? "difficulty.easyHint" : "difficulty.normalHint")}
          </p>
          {/* 소리 on/off는 메뉴 밖으로 나갔다 — SoundToggle 참고. */}
          <div className="my-3 h-px bg-ink/10" />
          <button
            type="button"
            onClick={() => {
              playSound("select");
              setOpen(false);
              setCharacterSheetOpen(true);
            }}
            className={ITEM_CLASS}
          >
            {t("hud.characterSheet")}
          </button>
          <button
            type="button"
            onClick={() => {
              playSound("select");
              setOpen(false);
              setContactOpen(true);
            }}
            className={ITEM_CLASS}
          >
            {t("hud.contact")}
          </button>
          <button
            type="button"
            onClick={() => {
              playSound("select");
              setOpen(false);
              setFeedbackOpen(true);
            }}
            className={ITEM_CLASS}
          >
            {t("feedback.title")}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
            className={ITEM_CLASS}
          >
            {t("hud.reset")}
          </button>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-30 flex items-center justify-center overflow-hidden p-4 bg-scene-void/70 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            className="w-full max-w-md animate-fade-rise rounded-xl border border-bone bg-paper p-7 shadow-panel"
          >
            <div className="flex items-start gap-3.5">
              {/* 되돌릴 수 없는 동작이라 아이콘으로 먼저 걸러준다 — 텍스트가 이미 설명하므로 장식 */}
              <span
                aria-hidden
                className="grid size-9 flex-none place-items-center rounded-full bg-ember/12 text-ember"
              >
                <Warning size={19} weight="fill" />
              </span>
              <div className="min-w-0">
                <h2
                  id="reset-dialog-title"
                  className="break-ko text-base font-bold tracking-tight text-ink"
                >
                  {t("reset.title")}
                </h2>
                <p className="mt-2.5 break-ko text-pretty text-sm leading-relaxed text-ink/70">
                  {t("reset.body")}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className={CHIP_CLASS}>
                {t("reset.cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  playSound("close");
                  reset();
                  setConfirming(false);
                }}
                className="cursor-pointer rounded-full bg-ink px-4 py-1.5 text-xs font-bold tracking-widest text-paper transition-all hover:bg-ink/85 active:translate-y-px active:bg-ink"
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
