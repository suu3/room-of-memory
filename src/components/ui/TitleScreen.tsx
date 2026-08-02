"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMemoryRoomStore } from "@/store/memory-room";
import { LanguageToggle } from "./LanguageToggle";
import { LoadingOverlay } from "./LoadingOverlay";

/** 시작 버튼을 누르고 방이 드러나기까지 로딩 화면을 보여주는 시간. */
const ENTER_DELAY_MS = 900;

/**
 * 게임 시작 화면. 방을 새로 마운트하지 않고 그 위에 덮는다 —
 * 뒤에서 3D 씬이 이미 돌고 있어야 "시작"을 누른 순간 지연 없이 들어간다.
 */
export function TitleScreen() {
  const { t } = useTranslation();
  const started = useMemoryRoomStore((state) => state.started);
  const startGame = useMemoryRoomStore((state) => state.startGame);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
  const setContactOpen = useMemoryRoomStore((state) => state.setContactOpen);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  // 눌린 순간 바로 방이 드러나면 전환이 뚝 끊긴다. 로딩 화면을 한 박자 끼워 넣는다.
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    setUiLock("title", !started);
    return () => setUiLock("title", false);
  }, [started, setUiLock]);

  useEffect(() => {
    if (!started) startButtonRef.current?.focus();
  }, [started]);

  if (started) return null;

  if (entering) return <LoadingOverlay label={t("scene.loading")} />;

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-10 bg-scene-void/80 px-6 backdrop-blur-md">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="font-pixel text-xs tracking-[0.4em] text-memory/80">
          {t("titleScreen.eyebrow")}
        </p>
        <h1 className="text-5xl font-bold tracking-tight text-paper md:text-6xl">{t("title")}</h1>
        <p className="max-w-sm text-pretty text-sm leading-relaxed text-bone/60">
          {t("titleScreen.tagline")}
        </p>
      </div>

      <button
        ref={startButtonRef}
        type="button"
        onClick={() => {
          setEntering(true);
          window.setTimeout(startGame, ENTER_DELAY_MS);
        }}
        className="cursor-pointer rounded-full bg-paper px-12 py-3 text-sm font-bold tracking-[0.2em] text-ink shadow-panel transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-memory"
      >
        {t("titleScreen.start")}
      </button>

      {/* 짧은 게임이라는 걸 미리 알려주면 진입 문턱이 낮아진다 */}
      <p className="-mt-5 text-[0.6875rem] font-bold tracking-[0.18em] text-bone/40">
        {t("titleScreen.playtime")}
      </p>

      <div className="flex flex-col items-center gap-4">
        {/* 언어 토글은 종이 패널 위에 놓이도록 설계됐다 — 어두운 배경에 직접 두면 글씨가 안 보인다 */}
        <div className="rounded-full border border-bone/20 bg-paper px-3 py-2 shadow-chip">
          <LanguageToggle />
        </div>
        <button
          type="button"
          onClick={() => setContactOpen(true)}
          className="cursor-pointer text-xs font-bold tracking-widest text-bone/45 transition-colors hover:text-bone active:text-bone/70"
        >
          {t("hud.contact")}
        </button>
      </div>
    </div>
  );
}
