"use client";

import { useEffect, useRef } from "react";

/**
 * 미니게임을 클리어한 순간, 닦아낸 자리에서 금빛 입자가 천천히 떠올라 흩어진다.
 *
 * 처음에는 폭죽이었다 — 사방으로 터지고, 중력으로 떨어지고, 중앙에 섬광이 번쩍이고,
 * 색종이 조각(rect)과 줄무늬(streak)가 섞인. 기술적으로는 멀쩡했지만 재난 뒤 빈방에서
 * 먼지 낀 가족사진을 닦은 직후에 컨페티가 터지는 꼴이라 톤이 정면으로 어긋났다.
 * 여기서 필요한 건 축하가 아니라 "풀려났다"는 감각이라, 터지는 대신 떠오르게 했다.
 *
 * 그리는 방식은 DustMotes(빛줄기 먼지)와 같은 원칙이다: 모양 있는 조각을 그리지 않고
 * 부드러운 방사형 글로우 하나만 쓴다. 크기는 세제곱 분포라 대부분 작고 또렷하며 가끔
 * 크고 흐린 보케가 섞인다 — 크기가 고르면 눈이 곧바로 "패턴"으로 읽는다.
 */

const PARTICLE_COUNT = 84;
const DURATION_MS = 2300;
/** 글로우 스프라이트 한 변(px). 실제 입자보다 크게 구워 두고 축소해 그린다. */
const GLOW_SPRITE_PX = 64;
/** 입자가 다 떠오른 뒤 전체가 사그라드는 구간(0~1). 짧으면 뚝 끊긴다. */
const FADE_SPAN_MIN = 0.34;
const FADE_SPAN_RANGE = 0.26;

interface Particle {
  /** 중심에서의 생성 위치(px). */
  offsetX: number;
  offsetY: number;
  /** 위로 오르는 속도(px/s). 낱알마다 달라야 줄 맞춰 오르지 않는다. */
  rise: number;
  /** 좌우 흔들림 — 메모의 "둥실둥실: sin". */
  swayAmplitude: number;
  swayFrequency: number;
  phase: number;
  size: number;
  glow: number;
  color: string;
  /** 태어나는 시각(초). 한꺼번에 나타나면 입자가 아니라 판이 뜬 것처럼 보인다. */
  birth: number;
  fadeSpan: number;
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
 * 색마다 하나씩 구워 두는 방사형 글로우. 입자마다 shadowBlur를 켜면 60fps에서
 * 확실히 버벅인다 — 미리 만든 그라디언트를 drawImage로 얹는 편이 훨씬 싸고 곱다.
 *
 * 가운데를 좁고 밝게, 바깥을 길고 옅게 떨어뜨린다. 선형으로 떨어뜨리면 테두리가
 * 보이는 원반이 되어 "동그란 스티커"처럼 읽힌다.
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
    gradient.addColorStop(0.16, withAlpha(color, 0.6));
    gradient.addColorStop(0.42, withAlpha(color, 0.18));
    gradient.addColorStop(1, withAlpha(color, 0));
    context.fillStyle = gradient;
    context.fillRect(0, 0, GLOW_SPRITE_PX, GLOW_SPRITE_PX);
  }
  return sprite;
}

/** 세제곱 편향 — 가운데가 촘촘하고 가장자리로 갈수록 성기다. */
function centerBiased(): number {
  const raw = Math.random() * 2 - 1;
  return raw ** 3;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

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

    // 금빛 위주. ember(주황)는 뺐다 — 두 색이 섞이면 축하 폭죽 쪽으로 다시 기운다.
    const palette = [
      tokenColor("--color-memory"),
      tokenColor("--color-memory"),
      tokenColor("--color-memory"),
      tokenColor("--color-paper"),
      tokenColor("--color-bone"),
    ];
    const glowSprites = new Map(palette.map((color) => [color, createGlowSprite(color)]));

    const durationS = DURATION_MS / 1000;
    // 액자 폭에 맞춰 퍼진다. 화면 한가운데 점에서 솟으면 분수처럼 보인다.
    const spreadX = Math.min(width * 0.3, 280);
    const spreadY = Math.min(height * 0.16, 130);

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => {
      // 세제곱이라 큰 알갱이는 드물다. 큰 만큼 흐려야 보케로 읽힌다.
      const bulk = Math.random() ** 3;
      return {
        offsetX: centerBiased() * spreadX,
        offsetY: spreadY * 0.35 + (Math.random() - 0.5) * spreadY,
        rise: 52 + Math.random() * 96,
        swayAmplitude: 7 + Math.random() * 21,
        swayFrequency: 0.85 + Math.random() * 1.3,
        phase: Math.random() * Math.PI * 2,
        size: 7 + bulk * 27,
        glow: 0.85 - bulk * 0.5,
        color: palette[Math.floor(Math.random() * palette.length)],
        // 앞쪽에 몰아 태운다 — 뒤늦게 태어난 입자는 다 오르기 전에 꺼진다
        birth: Math.random() ** 2 * durationS * 0.42,
        fadeSpan: FADE_SPAN_MIN + Math.random() * FADE_SPAN_RANGE,
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
      const progress = t / durationS;

      context.clearRect(0, 0, width, height);
      // 겹치는 입자끼리 빛이 더해져야 뭉친 자리가 밝아진다. 알파 합성으로 두면
      // 뒤 입자가 앞 입자를 덮어 색만 탁해진다 (DustMotes의 AdditiveBlending과 같은 이유).
      context.globalCompositeOperation = "lighter";

      for (const p of particles) {
        const age = t - p.birth;
        if (age <= 0) continue;

        // 위로 오르면서 sin으로 좌우로 흔들린다. 시간의 함수라 매 프레임 적분하지
        // 않으므로, 탭이 멈췄다 돌아와도 위치가 튀지 않는다.
        const x = originX + p.offsetX + Math.sin(age * p.swayFrequency + p.phase) * p.swayAmplitude;
        const y = originY + p.offsetY - p.rise * age;

        // 태어날 때 서서히 켜지고, 끝에 가서 사그라든다. 꺼지는 시점을 낱알마다
        // 흩어 놓아야 한꺼번에 툭 사라지지 않는다.
        const alpha = clamp01(age / 0.42) * clamp01((1 - progress) / p.fadeSpan) * p.glow;
        if (alpha <= 0.004) continue;

        // 떠오르며 아주 조금 부푼다 — 초점에서 멀어지는 인상
        const drawn = p.size * (1 + age * 0.12);
        context.globalAlpha = alpha;
        const sprite = glowSprites.get(p.color);
        if (sprite) context.drawImage(sprite, x - drawn / 2, y - drawn / 2, drawn, drawn);
      }

      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
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
