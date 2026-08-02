"use client";

import { List, Warning, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
        onClick={() => setOpen(!open)}
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
          <div className="my-3 h-px bg-ink/10" />
          <button
            type="button"
            onClick={() => {
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
                <h2 id="reset-dialog-title" className="text-base font-bold tracking-tight text-ink">
                  {t("reset.title")}
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-ink/70">{t("reset.body")}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className={CHIP_CLASS}>
                {t("reset.cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
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
