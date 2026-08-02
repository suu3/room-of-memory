"use client";

import { X } from "@phosphor-icons/react";
import Image from "next/image";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ASSETS } from "@/lib/assets";
import { useMemoryRoomStore } from "@/store/memory-room";

/** HUD 메뉴와 대사창 초상 두 곳에서 열리는 캐릭터 자료 모달. */
export function CharacterSheetModal() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const open = useMemoryRoomStore((state) => state.characterSheetOpen);
  const setOpen = useMemoryRoomStore((state) => state.setCharacterSheetOpen);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);

  useEffect(() => {
    setUiLock("character-sheet", open);
    return () => setUiLock("character-sheet", false);
  }, [open, setUiLock]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    // grid가 아니라 flex — grid의 auto row는 내용만큼 늘어나서 max-h-full이 무력해진다
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden p-4">
      <button
        type="button"
        aria-label={t("characterSheet.close")}
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-pointer bg-scene-void/70"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("characterSheet.title")}
        className="relative flex max-h-full w-full max-w-3xl animate-fade-rise flex-col rounded-lg border-2 border-bone bg-paper shadow-panel"
      >
        <div className="flex flex-none items-baseline justify-between gap-3 px-5 pb-3 pt-4">
          <div className="flex items-baseline gap-2.5">
            <span className="text-sm font-bold tracking-wide text-ink">
              {tRoom("characters.hero.name")}
            </span>
            <span className="text-xs tracking-widest text-ink/55">
              {tRoom("characters.hero.tag")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("characterSheet.close")}
            className="cursor-pointer text-ink/60 transition-colors hover:text-ink"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className="flex-none border-t-2 border-dashed border-ember/40" />
        {/* 시트는 세로로 길다 — 모달을 늘리지 말고 안쪽만 스크롤시킨다 */}
        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <Image
            src={ASSETS.images.characterHeroSheet}
            alt={t("characterSheet.alt")}
            width={1400}
            height={1570}
            sizes="(min-width: 768px) 672px, 100vw"
            className="mx-auto h-auto w-full max-w-2xl"
          />
        </div>
      </div>
    </div>
  );
}
