"use client";

import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 220;
const DURATION_MS = 1900;
/** 중력 (px/s²) — 튀어오른 조각이 포물선을 그리며 떨어진다 */
const GRAVITY = 1100;
/**
 * 공기 저항 계수(1/s). 0이면 조각이 등속으로 화면 밖까지 쭉 뻗어나가서
 * 폭죽이 아니라 방사형 줄무늬처럼 보인다. 처음에 확 퍼졌다가 이내 느려져야
 * "터졌다"는 인상이 남는다.
 */
const DRAG = 2.6;
/** 중앙 섬광이 사라지는 시각(초). 조각이 퍼지기 시작할 때쯤 꺼진다. */
const FLASH_S = 0.34;
/** 글로우 스프라이트 한 변(px). 실제 조각보다 크게 그려 번짐을 만든다. */
const GLOW_SPRITE_PX = 48;

type Shape = "rect" | "dot" | "streak";

interface Particle {
  vx: number;
  vy: number;
  size: number;
  color: string;
  spin: number;
  shape: Shape;
  /** 이 조각이 꺼지기 시작하는 시점(0~1). 다 같이 사라지면 뚝 끊긴 느낌이 난다. */
  fadeFrom: number;
  glow: number;
}

function tokenColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * 토큰 hex를 알파 붙은 rgb()로. 그라디언트 끝점에 키워드 `transparent`를 쓰면
 * 캔버스가 rgba(0,0,0,0)으로 읽어서 검정을 거쳐 사라진다 — 금빛 번짐 둘레에
 * 거뭇한 테가 생긴다. 같은 색의 알파 0으로 끝내야 색을 유지한 채 꺼진다.
 */
function withAlpha(color: string, alpha: number): string {
  const hex = color.trim().replace("#", "");
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return color;
  const full = hex.length === 3 ? hex.replace(/./g, (digit) => digit + digit) : hex;
  const value = Number.parseInt(full, 16);
  return `rgb(${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255} / ${alpha})`;
}

/**
 * 색마다 하나씩 만들어 두는 방사형 글로우 스프라이트.
 * 조각마다 shadowBlur를 켜면 200개 × 60fps에서 확실히 버벅인다 — 미리 구운
 * 그라디언트를 drawImage로 얹는 편이 훨씬 싸고, 번짐도 더 곱다.
 */
function createGlowSprite(color: string): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = GLOW_SPRITE_PX;
  sprite.height = GLOW_SPRITE_PX;
  const context = sprite.getContext("2d");
  if (context) {
    const half = GLOW_SPRITE_PX / 2;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, withAlpha(color, 1));
    gradient.addColorStop(0.35, withAlpha(color, 0.45));
    gradient.addColorStop(1, withAlpha(color, 0));
    context.fillStyle = gradient;
    context.fillRect(0, 0, GLOW_SPRITE_PX, GLOW_SPRITE_PX);
  }
  return sprite;
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
    const glowSprites = new Map(palette.map((color) => [color, createGlowSprite(color)]));

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => {
      // 사방으로 터진다. 위쪽으로 살짝 치우쳐야 떨어지는 맛이 산다
      const angle = Math.random() * Math.PI * 2;
      const speed = 620 + Math.random() * 1500;
      const roll = Math.random();
      return {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 260,
        size: 4 + Math.random() * 11,
        color: palette[Math.floor(Math.random() * palette.length)],
        spin: (Math.random() - 0.5) * 18,
        shape: roll < 0.45 ? "rect" : roll < 0.78 ? "dot" : "streak",
        fadeFrom: 0.35 + Math.random() * 0.4,
        glow: 0.25 + Math.random() * 0.45,
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
      const progress = elapsed / DURATION_MS;
      // 공기 저항이 걸린 등가속 운동의 닫힌 해. 매 프레임 적분하지 않아도
      // 같은 시각이면 늘 같은 위치가 나온다 (탭이 멈췄다 돌아와도 안 튄다).
      const travel = (1 - Math.exp(-DRAG * t)) / DRAG;
      const fall = 0.5 * GRAVITY * t * t;

      context.clearRect(0, 0, width, height);

      // 터지는 순간의 섬광 — 조각이 퍼져나가기 전 한순간만
      if (t < FLASH_S) {
        const flashAlpha = (1 - t / FLASH_S) ** 2 * 0.5;
        const radius = 60 + (t / FLASH_S) * 320;
        const flash = context.createRadialGradient(
          originX,
          originY,
          0,
          originX,
          originY,
          Math.max(1, radius),
        );
        flash.addColorStop(0, withAlpha(palette[0], 1));
        flash.addColorStop(1, withAlpha(palette[0], 0));
        context.globalAlpha = flashAlpha;
        context.fillStyle = flash;
        context.fillRect(originX - radius, originY - radius, radius * 2, radius * 2);
      }

      for (const p of particles) {
        const alpha =
          progress < p.fadeFrom ? 1 : 1 - (progress - p.fadeFrom) / (1 - p.fadeFrom + 0.0001);
        if (alpha <= 0) continue;

        const x = originX + p.vx * travel;
        const y = originY + p.vy * travel + fall;
        const glowSprite = glowSprites.get(p.color);

        // 번짐 먼저, 그 위에 알맹이 — 순서가 바뀌면 조각이 뿌옇게 덮인다
        if (glowSprite) {
          const glowSize = p.size * 4.5;
          context.globalAlpha = alpha * p.glow;
          context.drawImage(glowSprite, x - glowSize / 2, y - glowSize / 2, glowSize, glowSize);
        }

        context.globalAlpha = alpha;
        context.save();
        context.translate(x, y);
        context.rotate(p.spin * t);
        context.fillStyle = p.color;
        if (p.shape === "rect") {
          context.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        } else if (p.shape === "dot") {
          context.beginPath();
          context.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          context.fill();
        } else {
          // 길게 늘어진 조각 — 속도감이 붙는다
          context.fillRect(-p.size * 1.1, -p.size * 0.11, p.size * 2.2, p.size * 0.22);
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
