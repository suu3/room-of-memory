"use client";

import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  ChatCircleTextIcon,
  DownloadSimpleIcon,
  FilmStripIcon,
  PlayIcon,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { filmsPath } from "@/i18n/locale-routes";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import { blurDataUrlOf } from "@/lib/image-blur";
import { EXIT_BEAT_MS } from "@/scenes/memory-room/camera/first-person";
import { useMemoryRoomStore } from "@/store/memory-room";
import { selectLocale, useSettingsStore } from "@/store/settings";
import { BUTTON_PRIMARY, BUTTON_QUIET, FOCUS_RING } from "../shared/ui-classes";
import { EndingConfetti } from "./EndingConfetti";

/**
 * door: 문이 열리고 도해가 문턱을 넘어 나가는 몇 초 (투명, 3D가 보인다. 길이는 EXIT_BEAT_MS)
 * film: 엔딩 영상
 * card: 영상이 끝난 뒤의 마무리 카드
 */
type EndingStage = "door" | "film" | "card";

/**
 * "처음으로"를 누른 뒤의 화면 덮개.
 * out: 카드가 어둠에 잠긴다. in: 그 어둠이 걷히며 타이틀이 떠오른다.
 */
type Leave = "idle" | "out" | "in";
/** 덮개가 덮이고 걷히는 길이 (아래 덮개의 duration-700과 같은 값). */
const LEAVE_FADE_MS = 700;

/**
 * 현관문을 연 뒤의 엔딩.
 *
 * 문이 열리고 도해가 빛 속으로 걸어 나가는 뒷모습을 본 뒤(Player·FirstPersonRig의 exit)
 * 엔딩 영상을 튼다. 영상의 마지막 컷(배트를 쥐고 문을
 * 열고 나가는 장면)이 방금 한 동작과 이어진다. 끝나거나 건너뛰면 색종이와 함께
 * 카드가 서고, "처음으로"가 타이틀로 돌려보낸다 (store.reset). 카드에서 타이틀로는
 * 뚝 끊지 않고 어둠을 한 번 거친다: 덮개가 덮인 뒤에 reset 하고, 타이틀 위에서 걷힌다.
 *
 * 소리째 재생은 문을 누른 클릭이 남긴 사용자 활성화에 기댄다. 브라우저가 그래도
 * 막으면(iOS 등) 재생 버튼을 세워 한 번 더 누르게 한다. 영상을 못 받으면 카드로 간다.
 */
export function EndingScreen() {
  const { t } = useTranslation();
  const locale = useSettingsStore(selectLocale);
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
  const [leave, setLeave] = useState<Leave>("idle");
  const videoRef = useRef<HTMLVideoElement>(null);

  // 덮개가 다 덮인 뒤에 판을 비우고, 타이틀 위에서 걷는다
  useEffect(() => {
    if (leave === "idle") return;
    const timer = window.setTimeout(() => {
      if (leave === "out") {
        reset();
        setLeave("in");
      } else {
        setLeave("idle");
      }
    }, LEAVE_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [leave, reset]);

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

  const filmVisible = stage === "film";

  /*
   * 덮개는 엔딩이 꺼진 뒤에도(reset 뒤) 타이틀 위에 남아 걷혀야 하므로 엔딩 상자 밖에 둔다.
   * 늘 마운트해 두는 이유: 투명에서 시작해야 덮이는 전환이 돈다. 덮이는 동안에는 눌림을
   * 막고(두 번 누르기), 걷히는 동안에는 타이틀을 바로 누를 수 있게 비켜 준다.
   */
  const cover = (
    <div
      aria-hidden
      className={`absolute inset-0 z-50 bg-scene-void transition-opacity duration-700 ease-in-out ${
        leave === "out" ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    />
  );

  if (!endingStarted) return cover;

  return (
    <>
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

        {/*
        자동재생이 막혔을 때의 재생 버튼. 멈춘 첫 프레임 위에 서므로 화면을 한 겹 눌러
        어느 장면에서도 읽히게 하고, 영상 플레이어의 둥근 유리 버튼 하나로 세운다.
        금빛 채움 사각 버튼은 영상 위에서 그림을 가리는 딱지처럼 보였다. 글자까지가 한 버튼이다.
      */}
        {filmVisible && blocked ? (
          <div className="absolute inset-0 flex animate-backdrop-in items-center justify-center bg-scene-void/45">
            <button
              type="button"
              onClick={play}
              className={`group flex cursor-pointer flex-col items-center gap-3 rounded-md p-2 ${FOCUS_RING}`}
            >
              <span className="grid size-20 place-items-center rounded-full border border-ivory/30 bg-scene-void/55 text-ivory backdrop-blur-sm transition-colors duration-150 group-hover:border-memory/70 group-hover:bg-scene-void/70 group-hover:text-memory group-active:bg-scene-void/80">
                {/* 삼각형은 무게가 왼쪽에 쏠려 있어 조금 오른쪽으로 밀어야 가운데로 보인다 */}
                <PlayIcon size={30} weight="fill" className="ml-1" />
              </span>
              <span className="monologue-text text-sm font-medium tracking-[0.06em] text-ivory/85 transition-colors duration-150 group-hover:text-ivory">
                {t("ending.play")}
              </span>
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
            <ArrowRightIcon size={15} weight="bold" />
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
              <p className="font-pixel text-xs tracking-[0.3em] text-memory">
                {t("ending.eyebrow")}
              </p>
              <h2 className="max-w-lg break-ko text-pretty font-pixel text-3xl leading-snug text-ivory md:text-4xl">
                {t("ending.line")}
              </h2>
              <p className="break-ko text-pretty text-base text-fog">{t("ending.congrats")}</p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={replay} className={`${BUTTON_QUIET} px-6 py-3`}>
                  <ArrowCounterClockwiseIcon size={15} weight="bold" />
                  {t("ending.replay")}
                </button>
                <a
                  href={ASSETS.images.endingThanks}
                  download="room-of-memory-thank-you.webp"
                  className={`${BUTTON_QUIET} px-6 py-3`}
                >
                  <DownloadSimpleIcon size={15} weight="bold" />
                  {t("ending.saveImage")}
                </a>
                <button
                  type="button"
                  onClick={() => setLeave("out")}
                  disabled={leave !== "idle"}
                  className={`${BUTTON_PRIMARY} px-8 py-3`}
                >
                  {t("ending.again")}
                  <ArrowRightIcon size={15} weight="bold" />
                </button>
              </div>
              {/*
              다 깬 사람에게 묻는 자리. 메뉴의 피드백과 같은 창을 연다 (FeedbackModal: 엔딩에서
              열면 "기타"가 먼저 골라지고, 진행 정보에 ending:done이 붙는다). 버튼 줄에 넣지 않고
              아래 한 줄로 둔다: "처음으로"와 나란히 서면 끝내는 버튼들 사이에 묻힌다.
            */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {/*
                영상 모아보기(/films · /en/films · /ja/films)는 새 탭으로 연다. 같은 탭에서 떠나면 캔버스가 내려가고,
                돌아왔을 때는 타이틀이고, 이어하기를 눌러야 엔딩이 문턱부터 다시 돈다. 카드는 이 탭에 그대로 둔다.
              */}
                <Link
                  href={filmsPath(locale)}
                  target="_blank"
                  rel="noopener"
                  onClick={() => playSound("select")}
                  className={`${BUTTON_QUIET} px-5 py-2.5`}
                >
                  <FilmStripIcon size={15} weight="bold" />
                  {t("ending.films")}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    playSound("select");
                    setFeedbackOpen(true);
                  }}
                  className={`${BUTTON_QUIET} px-5 py-2.5`}
                >
                  <ChatCircleTextIcon size={15} weight="bold" />
                  {t("ending.feedback")}
                </button>
              </div>
            </div>
            <EndingConfetti />
          </div>
        ) : null}
      </div>
      {cover}
    </>
  );
}
