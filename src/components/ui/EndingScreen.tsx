"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMemoryRoomStore } from "@/store/memory-room";

/** 문이 열리는 걸 보여주고 나서 화면을 덮는다 — 배트를 쥔 손과 문이 이어져 보이도록. */
const DOOR_BEAT_MS = 1800;

/**
 * 배트를 쥔 뒤의 엔딩.
 *
 * 기획상 여기서 엔딩 영상이 재생되고, 영상의 마지막 컷(배트를 쥐고 문을 열고 나가는
 * 장면)이 방금 한 동작과 그대로 이어진다. 영상이 들어오기 전까지는 같은 자리에서
 * 같은 박자로 넘어가는 카드로 대신한다 — 영상이 준비되면 이 카드를 갈아끼우면 된다.
 */
export function EndingScreen() {
  const { t } = useTranslation();
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);
  const reset = useMemoryRoomStore((state) => state.reset);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    setUiLock("ending", endingStarted);
    return () => setUiLock("ending", false);
  }, [endingStarted, setUiLock]);

  // 문이 열리는 한 박자를 보여준 뒤에 카드를 올린다.
  useEffect(() => {
    if (!endingStarted) {
      setShowCard(false);
      return;
    }
    const timer = window.setTimeout(() => setShowCard(true), DOOR_BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [endingStarted]);

  if (!endingStarted) return null;

  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center gap-8 px-6 transition-all duration-1000 ${
        showCard ? "bg-scene-void/95 backdrop-blur-md" : "pointer-events-none bg-transparent"
      }`}
    >
      {showCard ? (
        <div className="flex animate-fade-rise flex-col items-center gap-7 text-center">
          <p className="font-pixel text-xs tracking-[0.4em] text-memory/80">
            {t("ending.eyebrow")}
          </p>
          <h2 className="max-w-lg text-pretty text-3xl font-bold leading-snug tracking-tight text-paper md:text-4xl">
            {t("ending.line")}
          </h2>
          <p className="max-w-md text-pretty text-sm leading-relaxed text-bone/55">
            {t("ending.note")}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 flex cursor-pointer items-center gap-2 rounded-full bg-paper px-9 py-3 text-sm font-bold tracking-[0.2em] text-ink shadow-panel transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-memory"
          >
            {t("ending.again")}
            <ArrowRight size={15} weight="bold" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
