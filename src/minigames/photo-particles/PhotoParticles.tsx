"use client";

import { type PointerEvent, useEffect, useRef, useState } from "react";
import {
  createParticleState,
  DEFAULT_STEP_OPTIONS,
  FACE_REGIONS,
  type ParticleState,
  type Pointer,
  type StepOptions,
  samplePhoto,
  spacingFor,
  stepParticles,
} from "./particles";

/**
 * 액자 사진을 입자로 그리는 층 (docs/visual-experiments.md 4장 "가족사진 액자").
 *
 * `photo-wipe`의 `revealed` 구간과 `photo-puzzle`을 맞춘 순간에 사진 자리에 얹힌다.
 * 사진을 오프스크린 캔버스에 표시 크기로 그려 격자로 뽑고(particles.ts), 입자 하나를
 * 격자 칸 크기 네모로 찍는다. 다 모이면 칸이 맞물려 사진이 서고, 커서가 스치면 그 자리가
 * 풀린다. 얼굴 입자는 `gathered`가 false인 동안 집으로 가지 않는다: 1차에서는 끝까지,
 * 2차 퍼즐에서는 맞춘 뒤 잠깐만.
 *
 * 레이아웃은 원래 자리에 있던 <img>가 그대로 맡는다. 같은 className을 받은 <img>를
 * 보이지 않게 두고(visibility) 그 위에 <canvas>를 absolute로 덮는다. 사진의 max-w/max-h
 * 규칙을 캔버스에 다시 적을 필요가 없고, 이미지 로드도 이 <img>가 한다.
 * `enabled=false`면 그 <img>만 보인다: 지금 화면 그대로가 폴백이다 (9장).
 *
 * 프레임마다 React 상태를 건드리지 않는다. 커서·옵션은 ref로 흐르고 rAF가 캔버스만 만진다.
 */
export interface PhotoParticlesProps {
  src: string;
  /** 사진의 기준 표시 크기(px). 샘플링 해상도와 입자 수를 정한다. 실제 표시는 CSS가 줄일 수 있다 */
  width: number;
  height: number;
  /** 얼굴 사각형을 고른다 (FACE_REGIONS) */
  gamePhase: 1 | 2;
  /** false면 평범한 <img> */
  enabled: boolean;
  /** true면 얼굴 입자도 집으로 간다 */
  gathered: boolean;
  /** 커서 반경 배율(0~1). 실험실 슬라이더용, 기본 1 */
  intensity?: number;
  /** 원래 <img>가 갖던 클래스. 크기 규칙이 여기 실려 온다 */
  className?: string;
}

/** 처음 흩어 놓는 거리(폭 단위). 사진 폭의 1/4쯤에서 날아와 모인다 */
const INITIAL_SCATTER = 0.25;
/** 고해상도 화면에서 캔버스 픽셀 수의 상한 */
const MAX_DPR = 2;
/** intensity 0에서도 남는 커서 반경 비율. 0이면 슬라이더 왼쪽 끝이 "효과 없음"과 같아진다 */
const RADIUS_FLOOR = 0.35;

function stepOptionsFor(gathered: boolean, intensity: number): StepOptions {
  const scale = RADIUS_FLOOR + (1 - RADIUS_FLOOR) * Math.min(1, Math.max(0, intensity));
  return {
    ...DEFAULT_STEP_OPTIONS,
    radius: DEFAULT_STEP_OPTIONS.radius * scale,
    faceSpring: gathered ? DEFAULT_STEP_OPTIONS.springStrength : 0,
    faceWander: gathered ? 0 : DEFAULT_STEP_OPTIONS.faceWander,
  };
}

export function PhotoParticles({
  src,
  width,
  height,
  gamePhase,
  enabled,
  gathered,
  intensity = 1,
  className = "",
}: PhotoParticlesProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<Pointer>({ x: 0, y: 0, active: false });
  /** gathered·intensity는 루프 중에 바뀐다. 매 프레임 최신값을 읽도록 ref로 */
  const optionsRef = useRef(stepOptionsFor(gathered, intensity));
  optionsRef.current = stepOptionsFor(gathered, intensity);
  /** 사진을 못 받았거나 픽셀을 못 읽으면(캔버스 오염 등) 그냥 사진을 보여준다 */
  const [failed, setFailed] = useState(false);

  // src는 <img>가 읽지만 사진이 바뀌면 샘플을 다시 떠야 한다. 같은 <img>에 새 load가 와도
  // build는 이미 선 상태를 보고 물러나므로, src가 바뀌면 effect를 다시 돌려 상태를 비운다.
  // biome-ignore lint/correctness/useExhaustiveDependencies(src): 위 설명.
  useEffect(() => {
    if (!enabled) return;
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let state: ParticleState | null = null;
    let colors: string[] = [];
    let spacing = 1;
    let frame = 0;
    let last = 0;
    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = 1;
    let disposed = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cssWidth = rect.width;
      cssHeight = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.max(1, Math.round(cssWidth * dpr));
      canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    };
    resize();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(() => resize()) : null;
    observer?.observe(canvas);

    const draw = () => {
      if (!state) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, cssWidth, cssHeight);
      // 입자 좌표는 폭 단위: 표시 폭을 곱하면 CSS px. 네모는 격자 칸 크기라 모이면 맞물린다.
      // 칸을 반 픽셀 키워 두면 스케일 반올림으로 생기는 실금이 안 보인다
      const scale = cssWidth;
      const dot = (spacing * cssWidth) / Math.max(1, width) + 0.5;
      const half = dot / 2;
      const xs = state.x;
      const ys = state.y;
      for (let i = 0; i < state.count; i += 1) {
        context.fillStyle = colors[i];
        context.fillRect(xs[i] * scale - half, ys[i] * scale - half, dot, dot);
      }
    };

    const loop = (now: number) => {
      if (disposed) return;
      const dt = last === 0 ? 1 / 60 : (now - last) / 1000;
      last = now;
      if (state) {
        stepParticles(state, dt, pointerRef.current, optionsRef.current);
        draw();
      }
      frame = requestAnimationFrame(loop);
    };

    const build = () => {
      if (disposed || state) return;
      const offscreen = document.createElement("canvas");
      offscreen.width = Math.max(1, Math.round(width));
      offscreen.height = Math.max(1, Math.round(height));
      const offscreenContext = offscreen.getContext("2d");
      if (!offscreenContext) {
        setFailed(true);
        return;
      }
      let pixels: ImageData;
      try {
        offscreenContext.drawImage(image, 0, 0, offscreen.width, offscreen.height);
        pixels = offscreenContext.getImageData(0, 0, offscreen.width, offscreen.height);
      } catch {
        // 다른 출처의 사진이면 픽셀을 못 읽는다. 에셋은 전부 같은 출처지만, 막히면 사진으로
        setFailed(true);
        return;
      }
      spacing = spacingFor(offscreen.width, offscreen.height);
      const sample = samplePhoto(pixels, spacing);
      state = createParticleState(sample, {
        width: offscreen.width,
        height: offscreen.height,
        regions: FACE_REGIONS[gamePhase],
        scatter: INITIAL_SCATTER,
      });
      // 색 문자열은 한 번만 만든다. 프레임마다 5천 개를 조립하면 그리기보다 문자열이 비싸다
      colors = new Array<string>(sample.count);
      for (let i = 0; i < sample.count; i += 1) {
        const r = sample.r[i];
        const g = sample.g[i];
        const b = sample.b[i];
        const a = sample.alpha[i];
        colors[i] = a < 1 ? `rgba(${r},${g},${b},${a.toFixed(3)})` : `rgb(${r},${g},${b})`;
      }
      if (frame === 0) frame = requestAnimationFrame(loop);
    };

    const fail = () => {
      if (!disposed) setFailed(true);
    };
    image.addEventListener("load", build);
    image.addEventListener("error", fail);
    // 캐시에서 즉시 온 사진은 load가 뜨지 않는다 (photo-wipe의 프로스트와 같은 처리)
    if (image.complete && image.naturalWidth > 0) build();

    return () => {
      disposed = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      observer?.disconnect();
      image.removeEventListener("load", build);
      image.removeEventListener("error", fail);
      state = null;
      colors = [];
    };
  }, [enabled, src, width, height, gamePhase]);

  const active = enabled && !failed;

  /** 캔버스 좌표 → 폭 단위. 두 축 모두 폭으로 나눈다 (particles.ts의 단위) */
  const pointerAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    pointerRef.current = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.width,
      active: true,
    };
  };
  const pointerGone = () => {
    pointerRef.current = { ...pointerRef.current, active: false };
  };
  /** 손가락은 떼면 없어진다. 마우스는 떼도 그 자리에 있으니 pointerleave만 본다 */
  const pointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType !== "mouse") pointerGone();
  };

  if (!active) {
    return (
      // biome-ignore lint/performance/noImgElement: 미니게임 전용 에셋이라 next/image 래퍼가 필요 없다.
      <img src={src} alt="" aria-hidden="true" className={className} />
    );
  }

  return (
    <div className="relative">
      {/* biome-ignore lint/performance/noImgElement: 픽셀을 읽어야 하는 원본이라 next/image 래퍼를 쓰지 않는다. */}
      <img
        ref={imageRef}
        src={src}
        alt=""
        aria-hidden="true"
        className={className}
        style={{ visibility: "hidden" }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        onPointerMove={pointerAt}
        onPointerDown={pointerAt}
        onPointerUp={pointerUp}
        onPointerCancel={pointerGone}
        onPointerLeave={pointerGone}
        className="absolute inset-0 size-full touch-none"
      />
    </div>
  );
}
