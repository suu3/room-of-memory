"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMemoryRoomStore } from "@/store/memory-room";

const CHIP_CLASS =
  "cursor-pointer rounded-full border border-bone/25 px-2.5 py-0.5 text-xs font-bold tracking-widest text-bone/60 transition-colors hover:border-bone/60 hover:text-bone";

export function HudActions() {
  const { t } = useTranslation();
  const reset = useMemoryRoomStore((state) => state.reset);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Link href="/contact" className={CHIP_CLASS}>
        {t("hud.contact")}
      </Link>
      <button type="button" onClick={() => setConfirming(true)} className={CHIP_CLASS}>
        {t("hud.reset")}
      </button>

      {confirming && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-scene-void/70 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            className="w-80 rounded-md border border-bone/15 bg-ink/90 p-6 shadow-panel"
          >
            <h2 id="reset-dialog-title" className="text-sm font-bold tracking-wide text-bone">
              {t("reset.title")}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-fog">{t("reset.body")}</p>
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
    </>
  );
}
