"use client";

import { type RefObject, useEffect, useRef } from "react";
import { pruneRipples, type Ripple, rippleAlpha, rippleBlotAlpha, rippleRadius } from "./ripple";

/**
 * 필드 위에 얹는 잉크 파문 층 (docs/visual-experiments.md 4장 "사인볼+글러브").
 *
 * 배경 그림·하늘 띠 위, 투수·공·HUD 아래에 놓인 <canvas> 하나다. 타점에서 잉크가
 * 번지듯 동심원 링 셋과 중심 얼룩을 `multiply`로 긋는다: 잉크는 필드를 **어둡게**만
 * 한다. 물리·GPU 없이 Canvas 2D 링 + 알파만이라 예산 등급 `cheap`이다.
 *
 * 그리는 루프는 살아 있는 파문이 있을 때만 돈다. 첫 파문에서 rAF를 걸고, 다 지워지면
 * 캔버스를 비우고 멈춘다. 미니게임의 공 루프와 별개라 안타가 없는 동안은 비용이 0이다.
 *
 * 파문을 넣는 손잡이(`spawn`)는 ref로 내준다. 공의 위치가 setState가 아니라 ref로
 * 도는 게임이라(index.tsx의 rAF 루프), 안타 순간에 상태를 건드리지 않고 파문을
 * 얹으려면 같은 문법이 맞다.
 */
export interface InkRippleHandle {
  /** 필드 기준 좌표(0~1)에 파문 하나를 얹는다 */
  spawn(x: number, y: number): void;
}

export interface InkRippleLayerProps {
  /** 부모가 만든 ref. 마운트되면 `spawn`이 들어오고 언마운트되면 null이 된다 */
  handleRef: RefObject<InkRippleHandle | null>;
  /** 감쇠(0~1). 1이 가장 빨리 잔다 (ripple.ts) */
  decay: number;
  /** false면 캔버스 자체를 그리지 않는다: 지금 화면 그대로가 폴백이다 */
  enabled: boolean;
}

/** 필드 짧은 변에 대한 파문의 최대 반지름 비율. 링 박스(size-24)보다 조금 크게 */
const MAX_RADIUS_RATIO = 0.3;
/** 링 셋의 반지름 비율과 굵기(px). 바깥이 가장 가늘고 안쪽이 굵다: 잉크가 밀린 가장자리 */
const RINGS: readonly { radius: number; width: number; alpha: number }[] = [
  { radius: 1, width: 1.5, alpha: 0.55 },
  { radius: 0.72, width: 2.5, alpha: 0.7 },
  { radius: 0.46, width: 3.5, alpha: 0.85 },
];
/** 중심 얼룩의 반지름 비율(최대 반지름 기준)과 최대 알파 */
const BLOT_RADIUS_RATIO = 0.42;
const BLOT_ALPHA = 0.75;
/** 고해상도 화면에서 캔버스 픽셀 수의 상한. 3배 화면에서 잉크 링 때문에 픽셀을 9배 쓰지 않는다 */
const MAX_DPR = 2;

export function InkRippleLayer({ handleRef, decay, enabled }: InkRippleLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** 감쇠는 라운드 중에도 바뀔 수 있다(진행도). 루프가 매 프레임 최신값을 읽도록 ref로 */
  const decayRef = useRef(decay);
  decayRef.current = decay;

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    // 잉크 색은 토큰에서. 캔버스에 text-ink를 입혀 두고 계산된 color를 읽으면
    // 브라우저가 var()를 rgb()로 풀어 준다. 못 읽는 환경(테스트)에서는 그리지 않는다
    const ink = window.getComputedStyle(canvas).color;
    if (!ink) return;

    let ripples: Ripple[] = [];
    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };
    resize();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(() => resize()) : null;
    observer?.observe(canvas);

    const draw = (now: number) => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "multiply";
      context.strokeStyle = ink;
      context.lineCap = "round";
      const maxRadius = Math.min(width, height) * MAX_RADIUS_RATIO;
      const currentDecay = decayRef.current;
      for (const ripple of ripples) {
        const age = now - ripple.bornAt;
        const centerX = ripple.x * width;
        const centerY = ripple.y * height;
        const spread = rippleRadius(age, currentDecay) * maxRadius;
        const alpha = rippleAlpha(age, currentDecay);
        for (const ring of RINGS) {
          const radius = spread * ring.radius;
          if (radius < ring.width) continue;
          context.globalAlpha = alpha * ring.alpha;
          context.lineWidth = ring.width;
          context.beginPath();
          context.arc(centerX, centerY, radius, 0, Math.PI * 2);
          context.stroke();
        }
        // 중심 얼룩: 링보다 먼저 잔다. 가운데가 오래 남으면 파문이 아니라 점으로 읽힌다
        const blotRadius = Math.max(1, spread * BLOT_RADIUS_RATIO);
        const gradient = context.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          blotRadius,
        );
        gradient.addColorStop(0, ink);
        gradient.addColorStop(1, "transparent");
        context.globalAlpha = rippleBlotAlpha(age, currentDecay) * BLOT_ALPHA;
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(centerX, centerY, blotRadius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    const loop = (now: number) => {
      ripples = pruneRipples(ripples, now, decayRef.current);
      draw(now);
      if (ripples.length === 0) {
        // 다 잤다: 루프를 멈춘다. 다음 안타의 spawn이 다시 건다
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(loop);
    };

    handleRef.current = {
      spawn(x, y) {
        ripples.push({ x, y, bornAt: performance.now() });
        if (frame === 0) frame = requestAnimationFrame(loop);
      },
    };

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      observer?.disconnect();
      handleRef.current = null;
      ripples = [];
    };
  }, [enabled, handleRef]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full text-ink"
    />
  );
}
