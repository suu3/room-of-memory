"use client";

import { Star } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";

const GOAL_HITS = 3;
const MAX_MISSES = 5;
const SKIP_AFTER_MS = 30_000;
const SKIP_AFTER_MISSES = 3;
const NEEDLE_PERIOD_MS = 4200;
/** 목표 대역 폭 (%) */
const BAND_WIDTH = 14;
/** 다이얼 눈금 범위 (MHz) — position 0~100% 를 이 범위로 매핑. */
const FREQ_MIN = 88;
const FREQ_MAX = 108;

function randomBandLeft(): number {
  return 6 + Math.random() * (100 - BAND_WIDTH - 12);
}

/** position(0~100%) → 표시 주파수 문자열. */
function freqAt(position: number): string {
  return (FREQ_MIN + (position / 100) * (FREQ_MAX - FREQ_MIN)).toFixed(1);
}

/** 좌우로 흔들리는 바늘이 목표 대역을 지나는 순간 Space — 3회 맞추면 클리어. */
export function FrequencyTuneMinigame({ onComplete }: MinigameProps) {
  const { t } = useTranslation();
  const complete = useOnceCompleter(onComplete);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [bandLeft, setBandLeft] = useState(randomBandLeft);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  const needleRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const positionRef = useRef(0);
  const skipByTime = useSkipEligible(SKIP_AFTER_MS);

  /** 주 눈금(2MHz)·보조 눈금(0.4MHz)을 % 위치로 미리 계산. */
  const ticks = useMemo(() => {
    const out: { pct: number; major: boolean; label?: number }[] = [];
    for (let f = FREQ_MIN; f <= FREQ_MAX + 1e-6; f += 0.4) {
      const freq = Math.round(f * 10) / 10;
      const major = Math.abs(freq % 2) < 1e-6;
      out.push({
        pct: ((freq - FREQ_MIN) / (FREQ_MAX - FREQ_MIN)) * 100,
        major,
        label: major ? freq : undefined,
      });
    }
    return out;
  }, []);

  // 바늘 애니메이션 — setState 대신 ref 직접 변이 (60fps)
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const phase = ((now - start) % NEEDLE_PERIOD_MS) / NEEDLE_PERIOD_MS;
      const position = (Math.sin(phase * Math.PI * 2) + 1) * 50;
      positionRef.current = position;
      if (needleRef.current) needleRef.current.style.left = `${position}%`;
      if (pointerRef.current) pointerRef.current.style.left = `${position}%`;
      if (readoutRef.current) readoutRef.current.textContent = freqAt(position);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const attemptRef = useRef(() => {});
  attemptRef.current = () => {
    const position = positionRef.current;
    const hit = position >= bandLeft && position <= bandLeft + BAND_WIDTH;
    setFlash(hit ? "hit" : "miss");
    if (hit) {
      const next = hits + 1;
      setHits(next);
      setBandLeft(randomBandLeft());
      if (next >= GOAL_HITS) complete({ cleared: true, score: next });
      return;
    }
    const next = misses + 1;
    setMisses(next);
    if (next >= MAX_MISSES) complete({ cleared: false, score: hits });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      event.preventDefault();
      attemptRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 300);
    return () => clearTimeout(timer);
  }, [flash]);

  return (
    <MinigameShell
      size="lg"
      title={t("minigame.frequencyTune.title")}
      help={t("minigame.frequencyTune.help")}
      stats={
        <>
          <MinigameStat label={t("minigame.labelSuccess")} value={`${hits} / ${GOAL_HITS}`} />
          <MinigameStat
            label={t("minigame.labelMiss")}
            value={`${misses} / ${MAX_MISSES}`}
            tone="warning"
          />
          {flash && (
            <span
              className={`rounded-full px-2 py-0.5 font-bold ${
                flash === "hit" ? "bg-memory text-night" : "bg-ember text-paper"
              }`}
            >
              {t(flash === "hit" ? "minigame.feedback.hit" : "minigame.feedback.miss")}
            </span>
          )}
        </>
      }
      skipVisible={skipByTime || misses >= SKIP_AFTER_MISSES}
      onSkip={() => complete({ cleared: true, score: hits })}
    >
      <button
        type="button"
        onPointerDown={() => attemptRef.current()}
        aria-label={t("minigame.frequencyTune.help")}
        className={`relative block w-full cursor-pointer overflow-hidden rounded-md border-2 bg-scene-deep px-6 pb-5 pt-7 shadow-panel transition-colors duration-300 ${
          flash === "hit"
            ? "border-memory shadow-slot-glow"
            : flash === "miss"
              ? "border-ember"
              : "border-bone/15"
        }`}
      >
        {/* 모서리 나사 디테일 */}
        <span aria-hidden className="absolute left-2 top-2 size-1 rounded-full bg-bone/20" />
        <span aria-hidden className="absolute right-2 top-2 size-1 rounded-full bg-bone/20" />
        <span aria-hidden className="absolute bottom-2 left-2 size-1 rounded-full bg-bone/20" />
        <span aria-hidden className="absolute bottom-2 right-2 size-1 rounded-full bg-bone/20" />

        {/* 다이얼 눈금 트랙 (position 0~100% 좌표계) */}
        <div aria-hidden className="relative mx-1 h-36">
          {/* 목표 대역 — 금빛 대시 밴드 */}
          <div
            className="absolute top-8 bottom-[2.9rem] rounded-sm border border-dashed border-memory/70 bg-memory/20 shadow-slot-glow transition-all duration-300"
            style={{ left: `${bandLeft}%`, width: `${BAND_WIDTH}%` }}
          />

          {/* 눈금 */}
          {ticks.map((tick) => (
            <span
              key={tick.pct}
              className={`absolute top-8 w-px -translate-x-1/2 ${
                tick.major ? "h-7 bg-bone/45" : "h-3.5 bg-bone/25"
              }`}
              style={{ left: `${tick.pct}%` }}
            />
          ))}

          {/* 주파수 숫자 */}
          {ticks
            .filter((tick) => tick.label !== undefined)
            .map((tick) => (
              <span
                key={`label-${tick.pct}`}
                className="absolute top-[4.75rem] -translate-x-1/2 font-mono text-sm font-bold tabular-nums text-bone/70"
                style={{ left: `${tick.pct}%` }}
              >
                {tick.label}
              </span>
            ))}
          <span className="absolute right-0 top-[6.5rem] font-mono text-xs font-medium tracking-widest text-bone/40">
            MHz
          </span>

          {/* 베이스라인 */}
          <span className="absolute inset-x-0 top-[6.1rem] h-px bg-bone/15" />

          {/* 삼각 포인터 (바늘 위치 추적) */}
          <div
            ref={pointerRef}
            className="absolute -top-1 size-0 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-ember"
            style={{ left: "0%" }}
          />

          {/* 바늘 — 레드 스티치 */}
          <div
            ref={needleRef}
            className="absolute top-7 bottom-[2.9rem] w-0.5 -translate-x-1/2 rounded-full bg-ember shadow-slot-glow"
            style={{ left: "0%" }}
          />
        </div>

        {/* 디지털 표시창 + 성공 진행 별 */}
        <div className="mt-2 flex items-center justify-center gap-4">
          <span aria-hidden className="flex gap-1.5">
            {Array.from({ length: GOAL_HITS }, (_, i) => (
              <Star
                // biome-ignore lint/suspicious/noArrayIndexKey: 고정 길이 진행 표시
                key={i}
                size={18}
                weight={i < hits ? "fill" : "regular"}
                className={i < hits ? "text-memory" : "text-bone/25"}
              />
            ))}
          </span>
          <span className="flex items-baseline gap-2 rounded-full border border-bone/15 bg-scene-navy px-6 py-1.5">
            <span ref={readoutRef} className="font-mono text-4xl font-bold tabular-nums text-paper">
              {freqAt(0)}
            </span>
            <span className="font-mono text-sm font-medium tracking-widest text-bone/50">MHz</span>
          </span>
        </div>
      </button>
    </MinigameShell>
  );
}
