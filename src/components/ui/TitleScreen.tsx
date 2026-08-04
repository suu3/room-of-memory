"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { LanguageToggle } from "./LanguageToggle";
import { LoadingOverlay } from "./LoadingOverlay";

/**
 * 시작 버튼을 누르고 방이 드러나기까지 로딩 화면을 보여주는 시간.
 *
 * 900ms였는데, 그 사이에 카메라가 방 안으로 내려앉기 시작하는 걸 로딩 화면이
 * 통째로 가렸다 — 연출을 넣어 놓고 그 앞을 막고 있던 셈이다. 씬은 타이틀 뒤에서
 * 이미 돌고 있으니 실제로 기다릴 것도 없다. 버튼이 눌렸다는 감각만 남기고 줄인다.
 */
const ENTER_DELAY_MS = 260;

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
  const resetRevision = useMemoryRoomStore((state) => state.resetRevision);
  /**
   * 저장된 진행. localStorage에서 되살아나므로 서버 렌더에는 없고, 첫 클라이언트
   * 렌더에서 채워진다 — 그래서 "0개면 아무것도 안 보여준다"가 곧 hydration 안전판이다.
   */
  const collectedCount = useMemoryRoomStore((state) => state.collected.length);
  const hasSave = collectedCount > 0;
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const enterTimerRef = useRef<number | null>(null);
  // 눌린 순간 바로 방이 드러나면 전환이 뚝 끊긴다. 로딩 화면을 한 박자 끼워 넣는다.
  // 리셋으로 타이틀에 돌아오면 다시 시작 버튼이 보여야 하므로 리비전에 묶어 둔다 —
  // 단순 boolean이면 리셋 후에도 true로 남아 로딩 화면에서 빠져나오지 못한다.
  const [enteringAtRevision, setEnteringAtRevision] = useState<number | null>(null);
  const entering = enteringAtRevision === resetRevision;

  useEffect(() => {
    setUiLock("title", !started);
    return () => setUiLock("title", false);
  }, [started, setUiLock]);

  useEffect(
    () => () => {
      if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!started) startButtonRef.current?.focus();
  }, [started]);

  if (started) return null;

  if (entering) return <LoadingOverlay label={t("scene.loading")} />;

  return (
    /*
     * 베일은 방을 가리는 게 아니라 글씨를 읽히게 하는 정도까지만.
     * bg-scene-void/80 + blur-md는 방을 거의 지워서, 타이틀 화면에 3D를 돌려 두는
     * 의미가 없었다. 흐림을 줄이고 어둠은 가운데로 모아(radial) 글자 뒤만 눌러 준다.
     */
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-10 px-6 backdrop-blur-[2px]">
      {/* 글자 뒤만 눌러 주는 어둠. 방 가장자리는 그대로 드러난다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(68% 54% at 50% 46%, color-mix(in srgb, var(--color-scene-void) 88%, transparent) 0%, color-mix(in srgb, var(--color-scene-void) 62%, transparent) 55%, color-mix(in srgb, var(--color-scene-void) 34%, transparent) 100%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-4 text-center">
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
          playSound("open");
          setEnteringAtRevision(resetRevision);
          enterTimerRef.current = window.setTimeout(startGame, ENTER_DELAY_MS);
        }}
        className="relative cursor-pointer rounded-full bg-paper px-12 py-3 text-sm font-bold tracking-[0.2em] text-ink shadow-panel transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-memory"
      >
        {t(hasSave ? "titleScreen.resume" : "titleScreen.start")}
      </button>

      {/* 이어하는 판이면 어디까지 왔는지 알려준다 — 눌러 보고 알게 하면 늦다 */}
      {hasSave ? (
        <p className="relative -mt-5 text-[0.6875rem] font-bold tracking-[0.18em] text-memory/70">
          {t("titleScreen.saved", { count: collectedCount })}
        </p>
      ) : null}

      {/* 짧은 게임이라는 걸 미리 알려주면 진입 문턱이 낮아진다 */}
      <p className="relative -mt-5 text-[0.6875rem] font-bold tracking-[0.18em] text-bone/40">
        {t("titleScreen.playtime")}
      </p>

      {/*
        무엇을 하는 게임인지 한 줄, 어떻게 조작하는지 한 줄.
        시작 버튼을 누른 뒤에는 알려줄 자리가 없다 — 방에 들어가면 화면은 씬이 다 쓴다.
      */}
      <div className="relative -mt-4 flex max-w-md flex-col items-center gap-2 text-center">
        <p className="text-sm leading-relaxed text-bone/70">{t("titleScreen.howTo")}</p>
        <p className="text-pretty text-[0.6875rem] leading-relaxed tracking-wider text-bone/40">
          {t("titleScreen.howToControls")}
        </p>
      </div>

      <div className="relative flex flex-col items-center gap-4">
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
