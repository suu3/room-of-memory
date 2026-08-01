"use client";

import { List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMemoryRoomStore } from "@/store/memory-room";
import { LanguageToggle } from "./LanguageToggle";

const ITEM_CLASS =
  "block w-full cursor-pointer rounded-md px-2.5 py-2 text-left text-xs font-bold tracking-widest text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink";

const CHIP_CLASS =
  "cursor-pointer rounded-full border-2 border-ink/20 px-2.5 py-0.5 text-xs font-bold tracking-widest text-ink/60 transition-colors hover:border-ink/50 hover:text-ink";

export function HudMenu() {
  const { t } = useTranslation();
  const reset = useMemoryRoomStore((state) => state.reset);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
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
        className="grid size-10 cursor-pointer place-items-center rounded-full border-2 border-bone bg-paper text-ink/80 shadow-chip transition-all hover:-translate-y-0.5 hover:border-memory hover:text-ink"
      >
        {open ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 rotate-1 animate-fade-rise rounded-lg border-2 border-bone bg-paper p-4 shadow-panel">
          <p className="px-0.5 text-xs font-bold tracking-widest text-ink/50">
            {t("language.label")}
          </p>
          <div className="mt-2">
            <LanguageToggle />
          </div>
          <div className="my-3 border-t-2 border-dashed border-ink/10" />
          <Link href="/contact" onClick={() => setOpen(false)} className={ITEM_CLASS}>
            {t("hud.contact")}
          </Link>
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
        <div className="fixed inset-0 z-30 grid place-items-center bg-scene-void/70 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            className="w-80 -rotate-1 rounded-lg border-2 border-bone bg-paper p-6 shadow-panel"
          >
            <h2 id="reset-dialog-title" className="text-sm font-bold tracking-wide text-ink">
              {t("reset.title")}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-ink/70">{t("reset.body")}</p>
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
                className="cursor-pointer rounded-full border border-ember bg-ember px-2.5 py-0.5 text-xs font-bold tracking-widest text-paper transition-colors hover:opacity-90"
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
