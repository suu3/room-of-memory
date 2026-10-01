"use client";

import {
  ArrowCounterClockwise,
  ArrowRight,
  ChatCircleText,
  DownloadSimple,
  Play,
} from "@phosphor-icons/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import { blurDataUrlOf } from "@/lib/image-blur";
import { EXIT_BEAT_MS } from "@/scenes/memory-room/first-person";
import { useMemoryRoomStore } from "@/store/memory-room";
import { EndingConfetti } from "./EndingConfetti";
import { BUTTON_PRIMARY, BUTTON_QUIET } from "./ui-classes";

/**
 * door: 문이 열리고 도해가 문턱을 넘어 나가는 몇 초 (투명, 3D가 보인다. 길이는 EXIT_BEAT_MS)
 * film: 엔딩 영상
 * card: 영상이 끝난 뒤의 마무리 카드
 */
type EndingStage = "door" | "film" | "card";

/**
 * 현관문을 연 뒤의 엔딩.
 *
 * 문이 열리고 도해가 빛 속으로 걸어 나가는 뒷모습을 본 뒤(Player·FirstPersonRig의 exit)
 * 엔딩 영상을 튼다. 영상의 마지막 컷(배트를 쥐고 문을
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
  const setSceneCovered = useMemoryRoomStore((state) => state.setSceneCovered);
  const setFeedbackOpen = useMemoryRoomStore((state) => state.setFeedbackOpen);
  const [stage, setStage] = useState<EndingStage>("door");
  const [blocked, setBlocked] = useState(false);
  /** 영상을 못 받았는가. 문턱을 넘는 중에 실패해도 걷기를 끊지 않고, 영상 박자에 카드로 간다. */
  const [filmFailed, setFilmFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setUiLock("ending", endingStarted);
    return () => setUiLock("ending", false);
  }, [endingStarted, setUiLock]);

  // 영상·카드가 방을 덮는 동안 3D는 그리지 않는다. 뒤에서 도는 방(god rays 포함)이
  // 영상 디코딩과 GPU를 다퉈 재생이 끊긴다. 문 박자에는 방이 보여야 하므로 그린다
  useEffect(() => {
    setSceneCovered(endingStarted && stage !== "door");
    return () => setSceneCovered(false);
  }, [endingStarted, stage, setSceneCovered]);

  // 문턱을 다 넘은 뒤에 영상으로 넘어간다.
  useEffect(() => {
    if (!endingStarted) {
      setStage("door");
      setBlocked(false);
      setFilmFailed(false);
      return;
    }
    const timer = window.setTimeout(() => setStage("film"), EXIT_BEAT_MS);
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
    if (stage !== "film") return;
    if (filmFailed) setStage("card");
    else play();
  }, [stage, play, filmFailed]);

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
      // 빛으로 물든 화면에서 어두운 영상으로 넘어가는 겹은 이 상자 하나다. 예전에는 배경색과
      // 영상이 따로 떠올라 두 겹이 곱해졌고, 밝은 화면이 처음 0.2초에 뚝 꺼졌다. 상자째로
      // 1.5초에 걸쳐 일정한 속도로 덮는다 (밝은 화면이 한순간에 꺼지지 않게, 광과민 배려)
      className={`absolute inset-0 z-50 bg-scene-void transition-opacity duration-1500 ease-linear ${
        stage === "door" ? "pointer-events-none opacity-0" : "opacity-100"
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
        onError={() => setFilmFailed(true)}
        // 문턱 동안에는 상자가 투명이라 영상은 처음부터 불투명하게 둔다 (위 주석)
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-1000 ${
          stage === "card" ? "pointer-events-none opacity-0" : "opacity-100"
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
              placeholder="blur"
              blurDataURL={blurDataUrlOf(ASSETS.images.endingThanks)}
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
            {/*
              다 깬 사람에게 묻는 자리. 메뉴의 피드백과 같은 창을 연다 (FeedbackModal: 엔딩에서
              열면 "기타"가 먼저 골라지고, 진행 정보에 ending:done이 붙는다). 버튼 줄에 넣지 않고
              아래 한 줄로 둔다: "처음으로"와 나란히 서면 끝내는 버튼들 사이에 묻힌다.
            */}
            <button
              type="button"
              onClick={() => {
                playSound("select");
                setFeedbackOpen(true);
              }}
              className={`${BUTTON_QUIET} px-5 py-2.5`}
            >
              <ChatCircleText size={15} weight="bold" />
              {t("ending.feedback")}
            </button>
          </div>
          <EndingConfetti />
        </div>
      ) : null}
    </div>
  );
}
