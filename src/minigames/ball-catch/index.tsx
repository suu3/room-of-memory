"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, useOnceCompleter, useSkipEligible } from "../shell";

const GOAL_CATCHES = 3;
const MAX_MISSES = 5;
const SKIP_AFTER_MS = 30_000;
const SKIP_AFTER_MISSES = 3;
const ROUND_MS_START = 1700;
const ROUND_MS_MIN = 1200;
const ROUND_MS_STEP = 150;
const ROUND_GAP_MS = 550;
/** 공이 점선 링과 겹치는 판정 구간 (진행률 0~1) */
const CATCH_WINDOW: [number, number] = [0.78, 0.96];

interface Round {
  start: number;
  duration: number;
  startX: number;
  resolved: boolean;
}

function newRound(duration: number): Round {
  return { start: performance.now(), duration, startX: 30 + Math.random() * 40, resolved: false };
}

/** 멀리서 날아와 커지는 공이 점선 링에 겹치는 순간 Space — 3회 잡으면 클리어. */
export function BallCatchMinigame({ onComplete }: MinigameProps) {
  const { t } = useTranslation();
  const complete = useOnceCompleter(onComplete);
  const [catches, setCatches] = useState(0);
  const [misses, setMisses] = useState(0);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const roundRef = useRef<Round>(newRound(ROUND_MS_START));
  const skipByTime = useSkipEligible(SKIP_AFTER_MS);

  const missRef = useRef(() => {});
  missRef.current = () => {
    setFlash("miss");
    const next = misses + 1;
    setMisses(next);
    if (next >= MAX_MISSES) complete({ cleared: false, score: catches });
  };

  const scheduleNextRef = useRef(() => {});
  scheduleNextRef.current = () => {
    const duration = Math.max(ROUND_MS_MIN, ROUND_MS_START - catches * ROUND_MS_STEP);
    setTimeout(() => {
      roundRef.current = newRound(duration);
    }, ROUND_GAP_MS);
  };

  const attemptRef = useRef(() => {});
  attemptRef.current = () => {
    const round = roundRef.current;
    if (round.resolved) return;
    round.resolved = true;
    const progress = (performance.now() - round.start) / round.duration;
    if (progress >= CATCH_WINDOW[0] && progress <= CATCH_WINDOW[1]) {
      setFlash("hit");
      const next = catches + 1;
      setCatches(next);
      if (next >= GOAL_CATCHES) {
        complete({ cleared: true, score: next });
        return;
      }
    } else {
      missRef.current();
    }
    scheduleNextRef.current();
  };

  // 공 비행 애니메이션 — setState 대신 ref 직접 변이 (60fps)
  useEffect(() => {
    let frame = 0;
    const loop = (now: number) => {
      const round = roundRef.current;
      const progress = (now - round.start) / round.duration;
      const ball = ballRef.current;
      if (ball) {
        if (round.resolved || progress < 0) {
          ball.style.opacity = "0";
        } else {
          const clamped = Math.min(progress, 1);
          const x = round.startX + (50 - round.startX) * clamped;
          const y = 12 + 56 * clamped;
          const scale = 0.25 + 1.05 * clamped;
          ball.style.opacity = "1";
          ball.style.left = `${x}%`;
          ball.style.top = `${y}%`;
          ball.style.transform = `translate(-50%, -50%) scale(${scale})`;
        }
      }
      if (!round.resolved && progress >= 1) {
        // 놓친 공 (드롭)
        round.resolved = true;
        missRef.current();
        scheduleNextRef.current();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

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
    const timer = setTimeout(() => setFlash(null), 350);
    return () => clearTimeout(timer);
  }, [flash]);

  return (
    <MinigameShell
      title={t("minigame.ballCatch.title")}
      help={t("minigame.ballCatch.help")}
      stats={
        <>
          <span>{t("minigame.successCount", { value: catches, goal: GOAL_CATCHES })}</span>
          <span>{t("minigame.missCount", { value: misses, max: MAX_MISSES })}</span>
          {flash && (
            <span className={flash === "hit" ? "font-bold text-memory" : "font-bold text-ember"}>
              {t(flash === "hit" ? "minigame.feedback.hit" : "minigame.feedback.miss")}
            </span>
          )}
        </>
      }
      skipVisible={skipByTime || misses >= SKIP_AFTER_MISSES}
      onSkip={() => complete({ cleared: true, score: catches })}
    >
      <button
        type="button"
        onPointerDown={() => attemptRef.current()}
        aria-label={t("minigame.ballCatch.help")}
        className={`relative block h-52 w-full cursor-pointer overflow-hidden rounded-sm border bg-scene-deep/80 transition-colors duration-300 ${
          flash === "hit" ? "border-memory" : flash === "miss" ? "border-ember" : "border-bone/15"
        }`}
      >
        {/* 지평선 */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-[22%] border-t border-dashed border-bone/15"
        />
        {/* 캐치 링 — 판정 위치 표시 */}
        <div
          aria-hidden
          className="absolute left-1/2 top-[68%] size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-memory/70"
        />
        {/* 공 */}
        <div
          ref={ballRef}
          aria-hidden
          className="absolute size-10 rounded-full border-2 border-ember bg-paper opacity-0"
          style={{ left: "50%", top: "12%", transform: "translate(-50%, -50%) scale(0.25)" }}
        >
          <span className="absolute inset-x-2 top-1.5 h-2 rounded-b-full border-b border-dashed border-ember/70" />
          <span className="absolute inset-x-2 bottom-1.5 h-2 rounded-t-full border-t border-dashed border-ember/70" />
        </div>
      </button>
    </MinigameShell>
  );
}
