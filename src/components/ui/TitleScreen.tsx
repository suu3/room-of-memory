"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { LanguageToggle } from "./LanguageToggle";
import { LoadingIndicator } from "./LoadingIndicator";
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
 * 로딩을 포기하고 시작 버튼을 여는 시각(ms).
 *
 * 진행률은 캔버스 청크가 보고한다 — 그 청크 자체를 못 받으면 아무도 보고하지
 * 않아 0에 멈춘다. 그 경우에도 게임은 시작할 수 있어야 한다. 방이 덜 예쁘게
 * 뜨는 것과 아예 못 들어가는 것은 다른 문제다.
 */
const LOAD_GIVE_UP_MS = 12_000;

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
  /*
   * 방을 이루는 glb는 타이틀 뒤에서 이미 받는 중이다. 다 받기 전에 들어가면 방이
   * 텅 빈 채로 시작해 가구가 하나씩 튀어나오므로, 그동안은 버튼을 잠그고 얼마나
   * 남았는지 보여준다 — 기다리게 하는 것보다 나쁜 건 왜 기다리는지 모르는 것이다.
   */
  const loadProgress = useMemoryRoomStore((state) => state.roomLoadProgress);
  const [gaveUp, setGaveUp] = useState(false);
  const ready = loadProgress >= 1 || gaveUp;
  const loadPercent = Math.round(loadProgress * 100);
  /** 셀 것이 생겼는가. 첫 모델이 들어오기 전에는 퍼센트가 거짓말이 된다. */
  const counting = loadPercent > 0;

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
    if (ready) return;
    const timer = window.setTimeout(() => setGaveUp(true), LOAD_GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [ready]);

  // 다 받고 나서 포커스를 준다 — 잠긴 버튼에 포커스를 박아 두면 키보드로 눌러 보고
  // 아무 일도 안 일어나는 걸 겪은 뒤에야 기다려야 한다는 걸 알게 된다.
  useEffect(() => {
    if (!started && ready) startButtonRef.current?.focus();
  }, [started, ready]);

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
      {/*
        간격이 위계를 만든다. DESIGN.md의 spacing 스케일에서 세 단만 쓴다 —
        한 덩어리 안은 8px(sm), 덩어리 사이는 32px(lg), 시작 버튼과 사이트 정보
        사이만 64px(xl). 크기를 세 종류로 묶어 두면 "어디까지가 한 말인지"가
        글을 읽기 전에 먼저 보인다. 중간값을 섞으면 그 경계가 흐려진다.
      */}
      <div className="relative flex min-h-full flex-col items-center justify-center gap-8 px-6 py-10">
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

        {/* 이름표와 제목. 눈썹 문구는 제목에 붙은 라벨이지 따로 하는 말이 아니다 */}
        <div className="relative flex flex-col items-center gap-2 text-center">
          <p className="font-pixel text-xs tracking-[0.4em] text-memory/80">
            {t("titleScreen.eyebrow")}
          </p>
          <h1 className="text-5xl font-bold tracking-tight text-paper md:text-6xl">{t("title")}</h1>
        </div>

        {/*
          이 게임이 무슨 이야기인지(tagline)와 그래서 무엇을 하는지(howTo)는 한 덩어리다 —
          떨어뜨려 놓으면 사이에 낀 것들이 설명을 끊는다. 같은 크기·같은 줄간격으로 붙여
          두 문장이 한 문단으로 읽히게 하고, 농도만 낮춰 앞 문장을 앞세운다.
        */}
        <div className="relative flex max-w-md flex-col items-center gap-2 text-center">
          <p className="max-w-sm break-ko text-pretty text-sm leading-relaxed text-bone/70">
            {t("titleScreen.tagline")}
          </p>
          <p className="break-ko text-pretty text-sm leading-relaxed text-bone/50">
            {t("titleScreen.howTo")}
          </p>
        </div>

        {/*
          누르기 전에 알아 두면 좋은 실무 정보 — 얼마나 걸리는지, 무엇으로 움직이는지.
          둘 다 같은 크기의 작은 글씨라 한 덩어리로 묶인다. 설명 문단과 섞이면
          "이야기"와 "사용법"이 한 목소리로 들린다.

          조작 안내는 "이동"과 "조사" 두 덩어리다. 한 문장으로 이어 두면 좁은 화면에서
          아무 데서나 끊겨 어느 쪽 설명인지 안 읽힌다 — 덩어리째 줄바꿈되도록 flex로 나눈다.
          문구는 기기를 따라간다 — 폰에서 WASD를 읽어 봐야 누를 키가 없다.

          시작 버튼 바로 위에 둔다. 누르고 나면 알려줄 자리가 없다 — 방에 들어가면
          화면은 씬이 다 쓴다.
        */}
        <div className="relative flex max-w-md flex-col items-center gap-2 text-center text-[0.6875rem] leading-relaxed">
          <p className="font-bold tracking-[0.18em] text-bone/40">{t("titleScreen.playtime")}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 tracking-wider text-bone/40">
            <span className="break-ko text-pretty">{hint("titleScreen.howToMove")}</span>
            <span className="break-ko text-pretty">{hint("titleScreen.howToExamine")}</span>
          </div>
        </div>

        {/*
          이 화면에서 눌러야 할 곳은 여기 하나다. 방 안의 기억 핫스팟과 같은 2.4s 호흡으로
          맥동시켜 "누를 수 있는 것"의 신호를 게임 전체에서 하나로 맞춘다.
        */}
        <div className="flex flex-col items-center gap-6">
          {/*
            후광은 버튼만 감싼다. 이 자리(-inset-y-5)를 바깥 열에 걸어 두면, 이어하는
            판에서 열이 저장 문구까지 길어지면서 후광도 같이 늘어나 글자가 맥동하는
            금빛 한가운데 들어앉는다 — 간격을 아무리 벌려도 버튼에 눌어붙어 보인다.
          */}
          <div className="relative">
            {/* 버튼 뒤에서 번지는 금빛. 버튼 자신이 아니라 별도 레이어라 hover 동작을 안 뺏는다.
                아직 받는 중이면 켜지 않는다 — 누르라는 신호를 눌리지 않는 버튼에 붙일 수 없다 */}
            {ready ? (
              <span
                aria-hidden
                className="start-glow animate-start-glow pointer-events-none absolute -inset-x-8 -inset-y-5 rounded-full blur-xl"
              />
            ) : null}
            <button
              ref={startButtonRef}
              type="button"
              disabled={!ready}
              onClick={() => {
                playSound("open");
                setEnteringAtRevision(resetRevision);
                enterTimerRef.current = window.setTimeout(startGame, ENTER_DELAY_MS);
              }}
              className={`relative rounded-full px-12 py-3 text-sm font-bold tracking-[0.2em] shadow-panel transition-transform focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-memory ${
                ready
                  ? "animate-start-pulse cursor-pointer bg-paper text-ink hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                  : "cursor-progress bg-paper/45 text-ink/60"
              }`}
            >
              {t(hasSave ? "titleScreen.resume" : "titleScreen.start")}
            </button>
          </div>

          {/*
            버튼 자리는 그대로 두고 아래에 로딩 표시를 붙인다. 화면을 통째로 덮으면
            이 화면에서 읽을 만한 것(제목·설명·조작법)을 가려 버린다 — 기다리는
            동안 읽으라고 쓴 글이다. 그림은 오버레이와 같은 달리는 아이를 쓴다.

            첫 모델이 다 들어오기 전에는 셀 것이 없어(로딩 매니저는 파일이 끝날
            때만 하나씩 센다) percent를 넘기지 않는다 — 0에 멈춘 바는 멈춘 것처럼
            보인다.
          */}
          {ready ? null : (
            <LoadingIndicator
              size="inline"
              percent={counting ? loadPercent : undefined}
              label={
                counting ? t("titleScreen.loading", { percent: loadPercent }) : t("scene.loading")
              }
            />
          )}

          {/* 이어하는 판이면 어디까지 왔는지 알려준다 — 눌러 보고 알게 하면 늦다 */}
          {hasSave ? (
            <p className="text-[0.6875rem] font-bold tracking-[0.18em] text-memory/70">
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
        <footer className="relative mt-8 flex flex-col items-center gap-2">
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
