"use client";

import { ArrowCounterClockwise, ArrowRight, DownloadSimple, Play } from "@phosphor-icons/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { EndingConfetti } from "./EndingConfetti";
import { BUTTON_PRIMARY, BUTTON_QUIET } from "./ui-classes";

/** 문이 열리는 걸 보여주고 나서 화면을 덮는다. 배트를 쥔 손과 문이 이어져 보이도록. */
const DOOR_BEAT_MS = 1800;

/**
 * door: 문이 열리는 한 박자 (투명, 3D가 보인다)
 * film: 엔딩 영상
 * card: 영상이 끝난 뒤의 마무리 카드
 */
type EndingStage = "door" | "film" | "card";

/**
 * 현관문을 연 뒤의 엔딩.
 *
 * 문이 열리는 박자를 보여준 뒤 엔딩 영상을 튼다. 영상의 마지막 컷(배트를 쥐고 문을
 * 열고 나가는 장면)이 방금 한 동작과 이어진다. 끝나거나 건너뛰면 색종이와 함께
 * 카드가 서고, "처음으로"가 타이틀로 돌려보낸다 (store.reset).
 *
 * 소리째 재생은 문을 누른 클릭이 남긴 사용자 활성화에 기댄다. 브라우저가 그래도
 * 막으면(iOS 등) 재생 버튼을 세워 한 번 더 누르게 한다. 영상을 못 받으면 카드로 간다.
 */
export function EndingScreen() {
  const { t } = useTranslation();
  const endingStarted = useMemoryRoomStore((state) => state.endingStarted);
  const soundMuted = useMemoryRoomStore((state) => state.soundMuted);
  const reset = useMemoryRoomStore((state) => state.reset);
  const setUiLock = useMemoryRoomStore((state) => state.setUiLock);
  const [stage, setStage] = useState<EndingStage>("door");
  const [blocked, setBlocked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setUiLock("ending", endingStarted);
    return () => setUiLock("ending", false);
  }, [endingStarted, setUiLock]);

  // 문이 열리는 한 박자를 보여준 뒤에 영상으로 넘어간다.
  useEffect(() => {
    if (!endingStarted) {
      setStage("door");
      setBlocked(false);
      return;
    }
    const timer = window.setTimeout(() => setStage("film"), DOOR_BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [endingStarted]);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setBlocked(false);
    video.play().catch((error: unknown) => {
      // 자동재생 정책에 막혔다: 눌러서 틀게 한다. 그 밖의 실패는 onError가 카드로 보낸다
      if (error instanceof DOMException && error.name === "NotAllowedError") setBlocked(true);
    });
  }, []);

  useEffect(() => {
    if (stage === "film") play();
  }, [stage, play]);

  // 카드가 서는 순간 색종이와 함께 축하음. 움직임 줄이기로 색종이를 안 그려도 소리는 난다
  useEffect(() => {
    if (stage === "card") playSound("confetti");
  }, [stage]);

  const replay = useCallback(() => {
    const video = videoRef.current;
    if (video) video.currentTime = 0;
    setStage("film");
    play();
  }, [play]);

  if (!endingStarted) return null;

  const filmVisible = stage === "film";

  return (
    <div
      className={`absolute inset-0 z-50 transition-colors duration-1000 ${
        stage === "door" ? "pointer-events-none bg-transparent" : "bg-scene-void"
      }`}
    >
      {/*
        문이 열리는 동안 미리 마운트해 받아 둔다. 영상 박자가 올 때 첫 프레임이 이미 와 있도록.
      */}
      <video
        ref={videoRef}
        src={ASSETS.video.endingFilm}
        preload="auto"
        playsInline
        muted={soundMuted}
        onEnded={() => setStage("card")}
        onError={() => setStage("card")}
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-1000 ${
          filmVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {filmVisible && blocked ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <button type="button" onClick={play} className={`${BUTTON_PRIMARY} px-8 py-3`}>
            <Play size={15} weight="fill" />
            {t("ending.play")}
          </button>
        </div>
      ) : null}

      {filmVisible ? (
        <button
          type="button"
          onClick={() => {
            videoRef.current?.pause();
            setStage("card");
          }}
          className={`${BUTTON_QUIET} absolute right-6 bottom-6 animate-fade-rise`}
        >
          {t("playback.skip")}
          <ArrowRight size={15} weight="bold" />
        </button>
      ) : null}

      {stage === "card" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-scene-void/95 px-6 backdrop-blur-md">
          <div className="flex animate-fade-rise flex-col items-center gap-5 text-center">
            {/*
              제작자가 그린 인사 그림. 흰 바탕째 종이 한 장처럼 올린다. 높이를 못박아 두는
              이유: 그림은 카드가 선 뒤에 받아지므로, max-h만 걸면 받기 전엔 0이었다가
              뜨는 순간 문구와 버튼이 아래로 밀린다. width/height 비율이 폭을 잡는다.
            */}
            <Image
              src={ASSETS.images.endingThanks}
              alt={t("ending.thanksAlt")}
              width={1160}
              height={1533}
              className="h-[34dvh] w-auto rounded-md shadow-panel"
            />
            <p className="font-pixel text-xs tracking-[0.3em] text-memory">{t("ending.eyebrow")}</p>
            <h2 className="max-w-lg break-ko text-pretty font-pixel text-3xl leading-snug text-ivory md:text-4xl">
              {t("ending.line")}
            </h2>
            <p className="break-ko text-pretty text-base text-fog">{t("ending.congrats")}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={replay} className={`${BUTTON_QUIET} px-6 py-3`}>
                <ArrowCounterClockwise size={15} weight="bold" />
                {t("ending.replay")}
              </button>
              <a
                href={ASSETS.images.endingThanks}
                download="room-of-memory-thank-you.webp"
                className={`${BUTTON_QUIET} px-6 py-3`}
              >
                <DownloadSimple size={15} weight="bold" />
                {t("ending.saveImage")}
              </a>
              <button type="button" onClick={reset} className={`${BUTTON_PRIMARY} px-8 py-3`}>
                {t("ending.again")}
                <ArrowRight size={15} weight="bold" />
              </button>
            </div>
          </div>
          <EndingConfetti />
        </div>
      ) : null}
    </div>
  );
}
