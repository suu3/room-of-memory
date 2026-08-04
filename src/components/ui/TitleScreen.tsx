"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
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
  const hint = useControlHint();
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
     * 바깥은 스크롤 그릇, 안쪽이 실제 레이아웃이다.
     *
     * 방(MemoryRoom)이 overflow-hidden이라, 화면이 낮으면 넘친 부분이 스크롤되는 게
     * 아니라 잘려 나갔다 — 가로로 눕힌 폰(667×375)에서 제목이 화면 위로 42px 잘리고
     * 조작 안내가 연락처를 덮었다. min-h-full + justify-center면 들어갈 때는 가운데
     * 정렬 그대로고, 안 들어갈 때만 안쪽이 늘어나며 스크롤이 생긴다.
     * (justify-center에 직접 overflow를 걸면 넘친 위쪽에 손이 닿지 않는다.)
     */
    <div className="absolute inset-0 z-40 overflow-y-auto overscroll-contain backdrop-blur-[2px]">
      <div className="relative flex min-h-full flex-col items-center justify-center gap-10 px-6 py-10">
        {/* 글자 뒤만 눌러 주는 어둠. 방 가장자리는 그대로 드러난다.
            베일은 방을 가리는 게 아니라 글씨를 읽히게 하는 정도까지만 — 흐림을 줄이고
            어둠은 가운데로 모아(radial) 글자 뒤만 눌러 준다. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(68% 54% at 50% 46%, color-mix(in srgb, var(--color-scene-void) 88%, transparent) 0%, color-mix(in srgb, var(--color-scene-void) 62%, transparent) 55%, color-mix(in srgb, var(--color-scene-void) 34%, transparent) 100%)",
          }}
        />

        {/*
          이 게임이 무슨 이야기인지(tagline)와 그래서 무엇을 하는지(howTo)는 한 덩어리다 —
          떨어뜨려 놓으면 사이에 낀 것들이 설명을 끊는다. 제목 아래에 붙여 한 번에 읽힌다.
        */}
        <div className="relative flex max-w-md flex-col items-center gap-4 text-center">
          <p className="font-pixel text-xs tracking-[0.4em] text-memory/80">
            {t("titleScreen.eyebrow")}
          </p>
          <h1 className="text-5xl font-bold tracking-tight text-paper md:text-6xl">{t("title")}</h1>
          <p className="max-w-sm break-ko text-pretty text-sm leading-relaxed text-bone/60">
            {t("titleScreen.tagline")}
          </p>
          <p className="break-ko text-pretty text-sm leading-relaxed text-bone/70">
            {t("titleScreen.howTo")}
          </p>
          {/* 짧은 게임이라는 걸 미리 알려주면 진입 문턱이 낮아진다 */}
          <p className="text-[0.6875rem] font-bold tracking-[0.18em] text-bone/40">
            {t("titleScreen.playtime")}
          </p>
        </div>

        {/*
          조작 안내는 "이동"과 "조사" 두 덩어리다. 한 문장으로 이어 두면 좁은 화면에서
          아무 데서나 끊겨 어느 쪽 설명인지 안 읽힌다 — 덩어리째 줄바꿈되도록 flex로 나눈다.
          문구는 기기를 따라간다 — 폰에서 WASD를 읽어 봐야 누를 키가 없다.

          시작 버튼 바로 위에 둔다. 누르고 나면 알려줄 자리가 없다 — 방에 들어가면
          화면은 씬이 다 쓴다.
        */}
        <div className="relative -mt-4 flex max-w-md flex-wrap items-center justify-center gap-x-5 gap-y-1 text-center text-[0.6875rem] leading-relaxed tracking-wider text-bone/40">
          <span className="break-ko text-pretty">{hint("titleScreen.howToMove")}</span>
          <span className="break-ko text-pretty">{hint("titleScreen.howToExamine")}</span>
        </div>

        {/*
          이 화면에서 눌러야 할 곳은 여기 하나다. 방 안의 기억 핫스팟과 같은 2.4s 호흡으로
          맥동시켜 "누를 수 있는 것"의 신호를 게임 전체에서 하나로 맞춘다.
        */}
        <div className="relative flex flex-col items-center gap-2">
          {/* 버튼 뒤에서 번지는 금빛. 버튼 자신이 아니라 별도 레이어라 hover 동작을 안 뺏는다 */}
          <span
            aria-hidden
            className="start-glow animate-start-glow pointer-events-none absolute -inset-x-8 -inset-y-5 rounded-full blur-xl"
          />
          <button
            ref={startButtonRef}
            type="button"
            onClick={() => {
              playSound("open");
              setEnteringAtRevision(resetRevision);
              enterTimerRef.current = window.setTimeout(startGame, ENTER_DELAY_MS);
            }}
            className="animate-start-pulse relative cursor-pointer rounded-full bg-paper px-12 py-3 text-sm font-bold tracking-[0.2em] text-ink shadow-panel transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-memory"
          >
            {t(hasSave ? "titleScreen.resume" : "titleScreen.start")}
          </button>

          {/* 이어하는 판이면 어디까지 왔는지 알려준다 — 눌러 보고 알게 하면 늦다 */}
          {hasSave ? (
            <p className="relative text-[0.6875rem] font-bold tracking-[0.18em] text-memory/70">
              {t("titleScreen.saved", { count: collectedCount })}
            </p>
          ) : null}
        </div>

        {/*
          여기서부터는 게임을 시작하는 흐름이 아니라 이 사이트에 대한 것이다 —
          시작 버튼 바로 아래 붙어 있으면 다음 단계처럼 읽힌다. 빈 자리를 한 번 크게
          두어 떼어 놓는다.

          화면 아래에 붙이지는 않는다. 절대 위치로 고정하면 폰의 주소창이 접혔다 펴질 때
          기준이 되는 높이가 흔들려 스크롤이 생긴다 — 그냥 흐름의 마지막에 둔다.
        */}
        <footer className="relative mt-14 flex flex-col items-center gap-3">
          {/*
            종이 알약을 깔면 시작 버튼과 재질이 같아져 둘의 위계가 나란해 보인다.
            어두운 배경 위에 직접 얹는 톤을 따로 둔다 (LanguageToggle의 tone).
          */}
          <LanguageToggle tone="dark" />
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="cursor-pointer rounded-sm px-2 py-1 text-xs font-bold tracking-widest text-bone/45 transition-colors hover:text-bone active:text-bone/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
          >
            {t("hud.contact")}
          </button>
        </footer>
      </div>
    </div>
  );
}
