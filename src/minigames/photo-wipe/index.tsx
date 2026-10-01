"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SuccessBurst } from "@/components/ui/minigame/SuccessBurst";
import { useControlHint } from "@/i18n/control-hint";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";
import { CLOTH_CURSOR } from "./cloth";
import { PhotoFrame } from "./frame";
import { createWipeGrid, wipeCircle } from "./wipe-grid";

/**
 * 이만큼 닦아야 끝난다. 2026-09-26에 70%→50%로 낮췄다가, 절반도 안 닦은 느낌에서 끝나
 * 허전하다는 피드백으로 80%로 올렸다 (2026-09-28). 대신 시간 제한을 없앴다: 먼지를 닦는
 * 손에 초시계를 붙이면 사진을 보는 게 아니라 시간과 싸우게 된다.
 */
const CLEAR_RATIO = 0.8;
const SKIP_AFTER_MS = 10_000;
/**
 * 파티클(rAF)이 멈춘 탭에서도 결과 대사로 넘어가게 하는 하드 폴백.
 * SuccessBurst가 스스로 끝나는 시간(2.3초)보다 넉넉히 뒤여야 한다. 짧으면
 * 정상적인 탭에서도 폴백이 먼저 터져 빛입자가 다 떠오르기 전에 잘린다.
 */
const BURST_FALLBACK_MS = 2_900;
/** 사진이 커진 만큼 헝겊도 키운다. 한 번에 닦이는 비율은 그대로. */
const WIPE_RADIUS = 42;
/** 격자 한 칸의 목표 크기(px). 사진 비율이 달라도 셀 밀도가 비슷하게 유지된다. */
const CELL_PX = 16;

/**
 * 페이즈별 사진. 표시 크기는 원본 비율 그대로라 캔버스에 꽉 채워 그리면 왜곡이 없다.
 * 1차는 부모 얼굴이 틀 밖으로 잘린 사진, 2차는 셋이 다 들어온 사진.
 */
const PHOTOS = {
  // 원본 1313×1198 (1.10:1) · 1402×1122 (1.25:1). 비율이 어긋나면 캔버스가 사진을 늘려 그린다
  1: { src: ASSETS.images.mgPhotoWipePhase1, width: 560, height: 511, tint: "--color-bone" },
  2: { src: ASSETS.images.mgPhotoWipePhase2, width: 620, height: 496, tint: "--color-memory" },
} as const;

function tokenColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** 뿌옇게 덮인 액자 사진을 닦아 선명도 80% 이상 만들면 클리어. 시간 제한도 실패도 없다. */
export function PhotoWipeMinigame({ onComplete, onSettled, gamePhase = 1 }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const photo = PHOTOS[gamePhase === 1 ? 1 : 2];
  const complete = useOnceCompleter(onComplete);
  const [progress, setProgress] = useState(0);
  /** 프로스트 레이어를 그린 뒤에야 닦을 수 있다. */
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
    // 이미지를 못 받아도 진행이 막히면 안 된다. 프로스트 없이라도 플레이는 계속된다
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

  /** 성공(또는 스킵): 남은 먼지를 전부 걷고 사진을 보여주는 단계로 넘어간다. */
  const revealRef = useRef(() => {});
  revealRef.current = () => {
    if (revealed) return;
    const context = canvasRef.current?.getContext("2d");
    context?.clearRect(0, 0, photo.width, photo.height);
    // 여기서부터 파티클이 끝날 때까지 최대 2초: 그 사이 바깥 클릭으로
    // 다 닦은 사진이 수집도 안 된 채 사라지면 안 된다.
    onSettled?.();
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
      // 문지를 때마다 울리면 시끄럽다. 5% 구간을 넘길 때만 한 번씩.
      // 스무 번 울리는 동안 음높이가 고정이면 마찰이 아니라 계측음으로 들린다.
      if (Math.floor(wiped * 20) > Math.floor(progressRef.current * 20))
        playSound("wipe", { variation: 0.14 });
      progressRef.current = wiped;
      setProgress(wiped);
      if (wiped >= CLEAR_RATIO) revealRef.current();
    }
  };

  // 파티클이 다 터진 뒤에 결과를 보고한다. 결과 대사는 이 화면을 뒤에 두고 뜬다.
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

  /**
   * 손으로 문지르는 동작이라 마우스·터치 전용이다. 방향키로 헝겊을 옮기는 건
   * "닦는다"는 감각과 맞지 않아서 뺐다. 키보드 사용자는 스킵 버튼으로 넘어간다.
   */
  const pointerWipe = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.type === "pointermove" && (event.buttons & 1) === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * photo.width;
    const y = ((event.clientY - rect.top) / rect.height) * photo.height;
    wipeAtRef.current(x, y);
  };

  // 성공 뒤: 패널 껍데기를 걷고 사진만 크게 남긴다. 결과 대사는 방의 대사창이 맡는다
  if (revealed) {
    return (
      <>
        <div className="animate-fade-rise">
          <PhotoFrame>
            {/* biome-ignore lint/performance/noImgElement: 미니게임 전용 에셋이라 next/image 래퍼가 필요 없다. */}
            <img
              src={photo.src}
              alt=""
              aria-hidden="true"
              className="block max-h-[58vh] w-auto max-w-[86vw]"
            />
          </PhotoFrame>
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
      help={hint("minigame.photoWipe.help")}
      stats={
        <MinigameStat label={t("minigame.labelClarity")} value={`${Math.round(progress * 100)}%`} />
      }
      skipVisible={skipEligible}
      onSkip={() => revealRef.current()}
    >
      <PhotoFrame>
        {/*
          원본 사진 (선명): 닦인 영역으로 드러난다.
          원본 폭을 기본값으로 두되 좁은 화면에서는 줄어들게 한다. 캔버스는 이 이미지 위에
          absolute inset-0으로 겹치고, 닦기 좌표는 getBoundingClientRect 비율로 환산하므로
          표시 크기가 줄어도 판정은 그대로다.
        */}
        {/* biome-ignore lint/performance/noImgElement: 캔버스와 픽셀 정렬이 필요해 next/image의 래퍼를 쓰지 않는다. */}
        <img
          src={photo.src}
          alt=""
          aria-hidden="true"
          width={photo.width}
          height={photo.height}
          /*
            먼지 막이 깔리기 전까지는 감춘다. useEffect는 브라우저가 한 번 그린
            뒤에 도니까, 캐시에 있는 사진이면 선명한 원본이 한 프레임 번쩍이고
            그 위에 먼지가 덮인다. 깜빡임이기도 하고 답을 미리 보여주는 것이기도 하다.
          */
          /*
           * 폭만 잡으면 낮은 창에서 액자가 화면 밖으로 내려간다. 그렇다고 max-height를
           * 얹으면 폭이 고정이라 세로만 잘려 사진이 납작해지고, 폭까지 auto로 풀면
           * 액자(w-fit)가 사진보다 넓어져 먼지 층이 사진 밖으로 삐져나온다.
           *
           * 그래서 **세로 제한을 폭 하나로 환산해** 정한다: 원래 폭 · 창에 들어갈 폭 ·
           * 남은 높이를 비율로 되돌린 폭 셋 중 제일 작은 것. 높이는 auto라 비율이
           * 그대로 따라오고, 폭이 확정이라 액자(w-fit)도 사진에 딱 맞게 줄어든다.
           *
           * 자리를 `100%`가 아니라 창 단위(svw)로 재는 것이 중요하다. 퍼센트는 액자를
           * 재는 중에 풀려야 하는 값이라 브라우저가 확정으로 치지 않고, 그러면 액자가
           * 사진보다 넓어져 먼지 층이 사진 밖으로 삐져나온다.
           *
           * 빼는 7rem은 패널 여백과 액자 몰딩·매트가 먹는 가로, 12rem은 설명 칸과
           * 몰딩·매트가 먹는 세로다.
           */
          className={`block h-auto ${ready ? "" : "invisible"}`}
          style={{
            width: `min(${photo.width}px, calc(94svw - 7rem), calc((94svh - 12rem) * ${(
              photo.width / photo.height
            ).toFixed(4)}))`,
          }}
        />
        {/*
          프로스트 레이어: 닦아서 지운다. 커서가 곧 행주다.
          size-full이 없으면 안 된다: 절대 배치된 <canvas>는 replaced element라
          width가 auto일 때 CSS가 intrinsic 크기(width 속성값 620px)를 그대로 쓴다.
          inset-0은 그걸 못 이겨서, 사진이 좁은 화면에 맞춰 줄어들어도 캔버스만
          원본 폭으로 남아 액자 밖으로 삐져나갔다 (모바일 블러 오버플로우).
        */}
        <canvas
          ref={canvasRef}
          width={photo.width}
          height={photo.height}
          onPointerDown={pointerWipe}
          onPointerMove={pointerWipe}
          className="absolute inset-0 size-full touch-none"
          style={{ cursor: CLOTH_CURSOR }}
        />
      </PhotoFrame>
    </MinigameShell>
  );
}
