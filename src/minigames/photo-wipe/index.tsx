"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, useOnceCompleter, useSkipEligible } from "../shell";

const CLEAR_RATIO = 0.7;
const TIME_LIMIT_S = 40;
const SKIP_AFTER_MS = 15_000;
const CANVAS_W = 416;
const CANVAS_H = 272;
const WIPE_RADIUS = 30;
const GRID_COLS = 26;
const GRID_ROWS = 17;
const CLOTH_STEP = 18;

function tokenColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** 뿌옇게 덮인 액자 사진을 닦아 선명도 70% 이상 만들면 클리어. 제한 시간 초과 시 실패. */
export function PhotoWipeMinigame({ onComplete }: MinigameProps) {
  const { t } = useTranslation();
  const complete = useOnceCompleter(onComplete);
  const [progress, setProgress] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(TIME_LIMIT_S);
  const [cloth, setCloth] = useState({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<boolean[]>(new Array(GRID_COLS * GRID_ROWS).fill(false));
  const progressRef = useRef(0);
  const skipEligible = useSkipEligible(SKIP_AFTER_MS);

  // 프로스트 레이어: 사진의 흐릿한 잔상 + 안개 톤을 캔버스에 그린다
  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const bone = tokenColor("--color-bone");
    const storm = tokenColor("--color-scene-storm");
    const olive = tokenColor("--color-scene-olive");
    const memory = tokenColor("--color-memory");
    context.fillStyle = storm;
    context.fillRect(0, 0, CANVAS_W, CANVAS_H);
    context.filter = "blur(14px)";
    context.fillStyle = storm;
    context.fillRect(-20, -20, CANVAS_W + 40, CANVAS_H * 0.55);
    context.fillStyle = olive;
    context.fillRect(-20, CANVAS_H * 0.5, CANVAS_W + 40, CANVAS_H * 0.6);
    context.fillStyle = memory;
    context.beginPath();
    context.arc(CANVAS_W * 0.78, CANVAS_H * 0.24, 26, 0, Math.PI * 2);
    context.fill();
    context.filter = "none";
    // 어두운 안개 대신 뽀얀 먼지 막 — 닦기 전에도 사진이 희미하게 비친다
    context.fillStyle = `color-mix(in srgb, ${bone} 32%, transparent)`;
    context.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }, []);

  const wipeAtRef = useRef((_x: number, _y: number) => {});
  wipeAtRef.current = (x: number, y: number) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(x, y, WIPE_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = "source-over";

    const grid = gridRef.current;
    const cellW = CANVAS_W / GRID_COLS;
    const cellH = CANVAS_H / GRID_ROWS;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (grid[row * GRID_COLS + col]) continue;
        const cx = (col + 0.5) * cellW;
        const cy = (row + 0.5) * cellH;
        if ((cx - x) ** 2 + (cy - y) ** 2 <= WIPE_RADIUS ** 2) {
          grid[row * GRID_COLS + col] = true;
        }
      }
    }
    const wiped = grid.filter(Boolean).length / grid.length;
    if (wiped - progressRef.current >= 0.01 || wiped >= CLEAR_RATIO) {
      progressRef.current = wiped;
      setProgress(wiped);
      if (wiped >= CLEAR_RATIO) {
        complete({ cleared: true, score: Math.round(wiped * 100) });
      }
    }
  };

  // 제한 시간
  useEffect(() => {
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
  }, [complete]);

  // 키보드: 방향키로 헝겊 이동, Space로 닦기
  useEffect(() => {
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
        x: Math.min(CANVAS_W, Math.max(0, position.x + move[0])),
        y: Math.min(CANVAS_H, Math.max(0, position.y + move[1])),
      }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pointerWipe = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.type === "pointermove" && (event.buttons & 1) === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((event.clientY - rect.top) / rect.height) * CANVAS_H;
    wipeAtRef.current(x, y);
    setCloth({ x, y });
  };

  return (
    <MinigameShell
      title={t("minigame.photoWipe.title")}
      help={t("minigame.photoWipe.help")}
      stats={
        <>
          <span>{t("minigame.clarity", { percent: Math.round(progress * 100) })}</span>
          <span>{t("minigame.timeLeft", { seconds: secondsLeft })}</span>
        </>
      }
      skipVisible={skipEligible}
      onSkip={() => complete({ cleared: true, score: Math.round(progress * 100) })}
    >
      <div className="relative mx-auto w-fit rounded-sm border-8 border-scene-olive bg-scene-deep shadow-panel">
        {/* 원본 사진 (선명) — 닦인 영역으로 드러난다 */}
        <svg
          aria-hidden="true"
          role="presentation"
          width={CANVAS_W}
          height={CANVAS_H}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          className="block"
        >
          <rect width={CANVAS_W} height={CANVAS_H} fill="var(--color-scene-storm)" />
          <rect
            y={CANVAS_H * 0.52}
            width={CANVAS_W}
            height={CANVAS_H * 0.48}
            fill="var(--color-scene-olive)"
          />
          <circle cx={CANVAS_W * 0.78} cy={CANVAS_H * 0.24} r="24" fill="var(--color-memory)" />
          <path
            d={`M ${CANVAS_W * 0.5} ${CANVAS_H * 0.56} L ${CANVAS_W * 0.68} ${CANVAS_H * 0.72} L ${CANVAS_W * 0.5} ${CANVAS_H * 0.88} L ${CANVAS_W * 0.32} ${CANVAS_H * 0.72} Z`}
            fill="none"
            stroke="var(--color-bone)"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
          <circle cx={CANVAS_W * 0.42} cy={CANVAS_H * 0.46} r="10" fill="var(--color-ink)" />
          <rect
            x={CANVAS_W * 0.42 - 8}
            y={CANVAS_H * 0.46 + 10}
            width="16"
            height="26"
            rx="6"
            fill="var(--color-ink)"
          />
          <circle cx={CANVAS_W * 0.58} cy={CANVAS_H * 0.48} r="10" fill="var(--color-ink)" />
          <rect
            x={CANVAS_W * 0.58 - 8}
            y={CANVAS_H * 0.48 + 10}
            width="16"
            height="26"
            rx="6"
            fill="var(--color-ink)"
          />
        </svg>
        {/* 프로스트 레이어 — 닦아서 지운다 */}
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={pointerWipe}
          onPointerMove={pointerWipe}
          className="absolute inset-0 cursor-crosshair touch-none"
        />
        {/* 헝겊 커서 (키보드 조작 표시) */}
        <div
          aria-hidden
          className="pointer-events-none absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-dashed border-memory/80"
          style={{ left: cloth.x, top: cloth.y }}
        />
      </div>
    </MinigameShell>
  );
}
