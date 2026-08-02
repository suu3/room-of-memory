"use client";

import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 260;
const DURATION_MS = 1800;
/** 중력 (px/s²) — 튀어오른 조각이 포물선을 그리며 떨어진다 */
const GRAVITY = 1100;

interface Particle {
  vx: number;
  vy: number;
  size: number;
  color: string;
  spin: number;
  isRect: boolean;
}

function tokenColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * 미니게임 성공 축하 파티클 — 화면 중앙에서 금빛 조각이 한 번 튀고 스스로 정리된다.
 * 위치는 시간의 해석적 함수로 계산해 프레임 루프에서 상태 변이/할당이 없다.
 */
export function SuccessBurst({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onDoneRef.current();
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    context.scale(dpr, dpr);

    // memory(금빛) 위주 + paper/ember 소량 — 기억이 흩날리는 인상
    const palette = [
      tokenColor("--color-memory"),
      tokenColor("--color-memory"),
      tokenColor("--color-memory"),
      tokenColor("--color-paper"),
      tokenColor("--color-bone"),
      tokenColor("--color-ember"),
    ];
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => {
      // 사방으로 터진다. 위쪽으로 살짝 치우쳐야 떨어지는 맛이 산다
      const angle = Math.random() * Math.PI * 2;
      const speed = 420 + Math.random() * 980;
      return {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 220,
        size: 5 + Math.random() * 10,
        color: palette[Math.floor(Math.random() * palette.length)],
        spin: (Math.random() - 0.5) * 18,
        isRect: Math.random() < 0.6,
      };
    });

    const originX = width / 2;
    const originY = height * 0.5;
    let start = 0;
    let frame = 0;
    const loop = (now: number) => {
      if (start === 0) start = now;
      const elapsed = now - start;
      if (elapsed >= DURATION_MS) {
        context.clearRect(0, 0, width, height);
        onDoneRef.current();
        return;
      }
      const t = elapsed / 1000;
      const alpha = Math.max(
        0,
        1 - Math.max(0, (elapsed - DURATION_MS * 0.5) / (DURATION_MS * 0.5)),
      );
      context.clearRect(0, 0, width, height);
      context.globalAlpha = alpha;
      for (const p of particles) {
        const x = originX + p.vx * t;
        const y = originY + p.vy * t + 0.5 * GRAVITY * t * t;
        context.save();
        context.translate(x, y);
        context.rotate(p.spin * t);
        context.fillStyle = p.color;
        if (p.isRect) {
          context.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        } else {
          context.beginPath();
          context.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          context.fill();
        }
        context.restore();
      }
      context.globalAlpha = 1;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-50 size-full"
    />
  );
}
