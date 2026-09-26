"use client";

import { useEffect, useRef } from "react";

/**
 * 엔딩 영상이 끝난 뒤 카드 위로 쏟아지는 색종이.
 *
 * SuccessBurst는 빈방에서 컨페티가 터지는 게 톤에 안 맞아 떠오르는 입자로 바꿨지만,
 * 여기는 도해가 문을 열고 나간 뒤다. 게임을 끝까지 온 사람을 축하하는 자리라
 * 이쪽은 진짜 색종이로 간다. 위에서 한 번 쏟아지고 바닥으로 빠져나가면 멈춘다.
 *
 * 색은 DESIGN.md 토큰에서 읽는다. 움직임 줄이기 설정이면 아예 그리지 않는다.
 */

const PIECE_COUNT = 160;
/** 조각이 태어나는 구간(초). 한꺼번에 나오면 판이 떨어지는 것처럼 보인다. */
const SPAWN_SPAN_S = 1.6;
const GRAVITY = 260;
/** 공기 저항: 속도가 이 값 쪽으로 수렴한다 (px/s). 종이는 끝없이 빨라지지 않는다. */
const TERMINAL_VY = 220;
const COLOR_TOKENS = [
  "--color-memory",
  "--color-ivory",
  "--color-ember",
  "--color-scene-sun",
  "--color-fog",
];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  angle: number;
  spin: number;
  /** 종이가 뒤집히며 납작해졌다 펴지는 위상. */
  flip: number;
  flipSpeed: number;
  sway: number;
  birth: number;
  color: string;
}

function tokenColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function EndingConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = COLOR_TOKENS.map(tokenColor).filter(Boolean);
    if (colors.length === 0) return;
    const width = canvas.clientWidth;
    const pieces: Piece[] = Array.from({ length: PIECE_COUNT }, () => ({
      x: Math.random() * width,
      y: -20 - Math.random() * 60,
      vx: (Math.random() - 0.5) * 120,
      vy: 40 + Math.random() * 120,
      width: 6 + Math.random() * 6,
      height: 9 + Math.random() * 8,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 8,
      flip: Math.random() * Math.PI * 2,
      flipSpeed: 4 + Math.random() * 6,
      sway: 20 + Math.random() * 40,
      birth: Math.random() * SPAWN_SPAN_S,
      color: colors[Math.floor(Math.random() * colors.length)] ?? colors[0],
    }));

    let frame = 0;
    let last = performance.now();
    let elapsed = 0;
    const tick = (now: number) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += delta;
      const height = canvas.clientHeight;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, canvas.clientWidth, height);

      let alive = 0;
      for (const piece of pieces) {
        if (elapsed < piece.birth) {
          alive++;
          continue;
        }
        if (piece.y > height + 30) continue;
        alive++;
        piece.vy += GRAVITY * delta;
        piece.vy += (TERMINAL_VY - piece.vy) * Math.min(1, delta * 1.5);
        piece.vx *= 1 - Math.min(1, delta * 0.8);
        piece.x += (piece.vx + Math.sin(piece.flip) * piece.sway) * delta;
        piece.y += piece.vy * delta;
        piece.angle += piece.spin * delta;
        piece.flip += piece.flipSpeed * delta;

        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.angle);
        context.scale(1, Math.cos(piece.flip));
        context.fillStyle = piece.color;
        context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
        context.restore();
      }
      if (alive > 0) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
