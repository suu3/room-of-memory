"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SuccessBurst } from "@/components/ui/SuccessBurst";
import { ASSETS } from "@/lib/assets";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, useOnceCompleter, useSkipEligible } from "../shell";
import { createWipeGrid, wipeCircle } from "./wipe-grid";

const CLEAR_RATIO = 0.7;
const TIME_LIMIT_S = 40;
const SKIP_AFTER_MS = 15_000;
/** 파티클(rAF)이 멈춘 탭에서도 결과 대사로 넘어가게 하는 하드 폴백. */
const BURST_FALLBACK_MS = 2_000;
/** 사진이 커진 만큼 헝겊도 키운다 — 한 번에 닦이는 비율은 그대로. */
const WIPE_RADIUS = 42;
const CLOTH_STEP = 24;
/** 격자 한 칸의 목표 크기(px). 사진 비율이 달라도 셀 밀도가 비슷하게 유지된다. */
const CELL_PX = 16;

/**
 * 페이즈별 사진. 표시 크기는 원본 비율 그대로라 캔버스에 꽉 채워 그리면 왜곡이 없다.
 * 1차는 부모 얼굴이 그늘에 묻힌 사진, 2차는 얼굴이 드러난 사진.
 */
const PHOTOS = {
  1: { src: ASSETS.images.mgPhotoWipePhase1, width: 620, height: 508, tint: "--color-bone" },
  2: { src: ASSETS.images.mgPhotoWipePhase2, width: 560, height: 516, tint: "--color-memory" },
} as const;

function tokenColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** 뿌옇게 덮인 액자 사진을 닦아 선명도 70% 이상 만들면 클리어. 제한 시간 초과 시 실패. */
export function PhotoWipeMinigame({ onComplete, gamePhase = 1 }: MinigameProps) {
  const { t } = useTranslation();
  const photo = PHOTOS[gamePhase];
  const complete = useOnceCompleter(onComplete);
  const [progress, setProgress] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(TIME_LIMIT_S);
  const [cloth, setCloth] = useState({ x: photo.width / 2, y: photo.height / 2 });
  /** 프로스트 레이어를 그린 뒤에야 타이머가 돈다 — 로딩 시간을 플레이 시간에서 깎지 않는다. */
  const [ready, setReady] = useState(false);
  /** 성공 직후 단계: 사진이 완전히 드러나고 결과 대사가 뜬다. 닫는 건 플레이어 몫. */
  const [revealed, setRevealed] = useState(false);
  const [burstDone, setBurstDone] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef(
    createWipeGrid(Math.round(photo.width / CELL_PX), Math.round(photo.height / CELL_PX)),
  );
  const progressRef = useRef(0);
  const skipEligible = useSkipEligible(SKIP_AFTER_MS);

  // 프로스트 레이어: 같은 사진을 흐리게 깐 먼지 막. 닦기 전에도 형태만 희미하게 비친다
  useEffect(() => {
    let settled = false;
    const image = new Image();
    const paint = () => {
      if (settled) return;
      settled = true;
      const context = canvasRef.current?.getContext("2d");
      if (context) {
        context.filter = "blur(9px)";
        // 블러가 가장자리를 빨아들이지 않도록 캔버스보다 조금 크게 그린다
        context.drawImage(image, -12, -12, photo.width + 24, photo.height + 24);
        context.filter = "none";
        context.globalAlpha = 0.62;
        context.fillStyle = tokenColor(photo.tint);
        context.fillRect(0, 0, photo.width, photo.height);
        context.globalAlpha = 1;
      }
      setReady(true);
    };
    // 이미지를 못 받아도 진행이 막히면 안 된다 — 프로스트 없이라도 플레이는 계속된다
    const giveUp = () => {
      if (settled) return;
      settled = true;
      setReady(true);
    };
    image.onload = paint;
    image.onerror = giveUp;
    image.src = photo.src;
    // 캐시에서 즉시 온 이미지는 onload가 뜨지 않는다
    if (image.complete && image.naturalWidth > 0) paint();
    return () => {
      settled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [photo]);

  /** 성공(또는 스킵) — 남은 먼지를 전부 걷고 사진을 보여주는 단계로 넘어간다. */
  const revealRef = useRef(() => {});
  revealRef.current = () => {
    if (revealed) return;
    const context = canvasRef.current?.getContext("2d");
    context?.clearRect(0, 0, photo.width, photo.height);
    setRevealed(true);
  };

  const wipeAtRef = useRef((_x: number, _y: number) => {});
  wipeAtRef.current = (x: number, y: number) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context || !ready || revealed) return;
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(x, y, WIPE_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = "source-over";

    const wiped = wipeCircle(gridRef.current, photo, x, y, WIPE_RADIUS);
    if (wiped - progressRef.current >= 0.01 || wiped >= CLEAR_RATIO) {
      progressRef.current = wiped;
      setProgress(wiped);
      if (wiped >= CLEAR_RATIO) revealRef.current();
    }
  };

  // 제한 시간
  useEffect(() => {
    if (!ready || revealed) return;
    const timer = setInterval(() => {
      setSecondsLeft((seconds) => {
        if (seconds <= 1) {
          clearInterval(timer);
          complete({ cleared: false, score: Math.round(progressRef.current * 100) });
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [complete, ready, revealed]);

  // 파티클이 다 터진 뒤에 결과를 보고한다 — 결과 대사는 이 화면을 뒤에 두고 뜬다.
  // 파티클은 rAF 기반이라 탭이 백그라운드면 끝나지 않는다 → setTimeout 폴백을 함께 건다.
  useEffect(() => {
    if (!revealed) return;
    if (burstDone) {
      complete({ cleared: true, score: Math.round(progressRef.current * 100), celebrated: true });
      return;
    }
    const fallback = setTimeout(() => setBurstDone(true), BURST_FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [burstDone, complete, revealed]);

  // 키보드: 방향키로 헝겊 이동, Space로 닦기
  useEffect(() => {
    // 결과 대사 단계에서는 Space/방향키를 대사창에 넘긴다
    if (revealed) return;
    const onKey = (event: KeyboardEvent) => {
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-CLOTH_STEP, 0],
        ArrowRight: [CLOTH_STEP, 0],
        ArrowUp: [0, -CLOTH_STEP],
        ArrowDown: [0, CLOTH_STEP],
      };
      if (event.code === "Space") {
        event.preventDefault();
        setCloth((position) => {
          wipeAtRef.current(position.x, position.y);
          return position;
        });
        return;
      }
      const move = moves[event.code];
      if (!move) return;
      event.preventDefault();
      setCloth((position) => ({
        x: Math.min(photo.width, Math.max(0, position.x + move[0])),
        y: Math.min(photo.height, Math.max(0, position.y + move[1])),
      }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photo, revealed]);

  const pointerWipe = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.type === "pointermove" && (event.buttons & 1) === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * photo.width;
    const y = ((event.clientY - rect.top) / rect.height) * photo.height;
    wipeAtRef.current(x, y);
    setCloth({ x, y });
  };

  // 성공 뒤: 패널 껍데기를 걷고 사진만 크게 남긴다. 결과 대사는 방의 대사창이 맡는다
  if (revealed) {
    return (
      <>
        <div className="relative animate-fade-rise rounded-sm border-8 border-scene-olive bg-scene-deep shadow-panel">
          {/* biome-ignore lint/performance/noImgElement: 미니게임 전용 에셋이라 next/image 래퍼가 필요 없다. */}
          <img
            src={photo.src}
            alt=""
            aria-hidden="true"
            className="block max-h-[58vh] w-auto max-w-[86vw]"
          />
        </div>
        {/* 파티클은 액자 밖으로도 튀어야 하니 화면 전체를 덮는 레이어에서 터뜨린다 */}
        {!burstDone && (
          <div className="pointer-events-none fixed inset-0 z-50">
            <SuccessBurst onDone={() => setBurstDone(true)} />
          </div>
        )}
      </>
    );
  }

  return (
    <MinigameShell
      size="lg"
      title={t("minigame.photoWipe.title")}
      help={t("minigame.photoWipe.help")}
      stats={
        <>
          <span>{t("minigame.clarity", { percent: Math.round(progress * 100) })}</span>
          <span>{t("minigame.timeLeft", { seconds: secondsLeft })}</span>
        </>
      }
      skipVisible={skipEligible}
      onSkip={() => revealRef.current()}
    >
      <div className="relative mx-auto w-fit rounded-sm border-8 border-scene-olive bg-scene-deep shadow-panel">
        {/* 원본 사진 (선명) — 닦인 영역으로 드러난다 */}
        {/* biome-ignore lint/performance/noImgElement: 캔버스와 픽셀 정렬이 필요해 next/image의 래퍼를 쓰지 않는다. */}
        <img
          src={photo.src}
          alt=""
          aria-hidden="true"
          width={photo.width}
          height={photo.height}
          className="block"
        />
        {/* 프로스트 레이어 — 닦아서 지운다 */}
        <canvas
          ref={canvasRef}
          width={photo.width}
          height={photo.height}
          onPointerDown={pointerWipe}
          onPointerMove={pointerWipe}
          className="absolute inset-0 cursor-crosshair touch-none"
        />
        {/* 헝겊 커서 (키보드 조작 표시) */}
        <div
          aria-hidden
          className="pointer-events-none absolute size-12 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-dashed border-memory/80"
          style={{ left: cloth.x, top: cloth.y }}
        />
      </div>
    </MinigameShell>
  );
}
