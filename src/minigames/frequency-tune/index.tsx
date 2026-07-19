"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, useOnceCompleter, useSkipEligible } from "../shell";

const GOAL_HITS = 3;
const MAX_MISSES = 5;
const SKIP_AFTER_MS = 30_000;
const SKIP_AFTER_MISSES = 3;
const NEEDLE_PERIOD_MS = 2600;
/** 목표 대역 폭 (%) */
const BAND_WIDTH = 14;

function randomBandLeft(): number {
  return 6 + Math.random() * (100 - BAND_WIDTH - 12);
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
  const positionRef = useRef(0);
  const skipByTime = useSkipEligible(SKIP_AFTER_MS);

  // 바늘 애니메이션 — setState 대신 ref 직접 변이 (60fps)
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const phase = ((now - start) % NEEDLE_PERIOD_MS) / NEEDLE_PERIOD_MS;
      const position = (Math.sin(phase * Math.PI * 2) + 1) * 50;
      positionRef.current = position;
      if (needleRef.current) needleRef.current.style.left = `${position}%`;
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
      title={t("minigame.frequencyTune.title")}
      help={t("minigame.frequencyTune.help")}
      stats={
        <>
          <span>{t("minigame.successCount", { value: hits, goal: GOAL_HITS })}</span>
          <span>{t("minigame.missCount", { value: misses, max: MAX_MISSES })}</span>
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
        className={`relative block h-24 w-full cursor-pointer overflow-hidden rounded-md border-2 bg-scene-storm transition-colors duration-300 ${
          flash === "hit" ? "border-memory" : flash === "miss" ? "border-ember" : "border-ink/15"
        }`}
      >
        <div
          aria-hidden
          className="absolute inset-x-3 top-2 flex justify-between font-mono text-xs text-bone/55"
        >
          <span>88.0</span>
          <span>92.0</span>
          <span>96.0</span>
          <span>100.0</span>
          <span>104.0</span>
        </div>
        <div
          aria-hidden
          className="absolute bottom-0 top-8 rounded-sm bg-memory/45 shadow-slot-glow transition-all duration-300"
          style={{ left: `${bandLeft}%`, width: `${BAND_WIDTH}%` }}
        />
        <div
          ref={needleRef}
          aria-hidden
          className="absolute bottom-0 top-6 w-0.5 -translate-x-1/2 bg-ember"
          style={{ left: "0%" }}
        />
      </button>
    </MinigameShell>
  );
}
