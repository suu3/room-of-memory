"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, useOnceCompleter, useSkipEligible } from "../shell";
import { BallCatchField } from "./field";
import { classifySwing, remainingChances, type SwingResult } from "./timing";

const GOAL_CATCHES = 3;
const MAX_MISSES = 5;
const SKIP_AFTER_MS = 30_000;
const SKIP_AFTER_MISSES = 3;
const ROUND_MS_START = 1700;
const ROUND_MS_MIN = 1200;
const ROUND_MS_STEP = 150;
const ROUND_GAP_MS = 550;
/**
 * 공이 점선 링과 겹치는 판정 구간 (진행률). 1.0 = 공이 링 중심 도달 —
 * 중심에 얹힌 순간과 그 직후 잠깐까지 성공으로 인정한다.
 */
const CATCH_WINDOW: [number, number] = [0.78, 1.12];
/** 비행 중 총 회전량 (deg) */
const SPIN_DEG = 270;
/** 타격 후 공이 날아가는 연출 시간 (ms) */
const HIT_FLY_MS = 380;
/** 마지막 타격 연출을 보여주고 나서 완료 보고까지의 지연 (ms) */
const CLEAR_DELAY_MS = 550;
const INTERACTIVE_TARGET_SELECTOR =
  "button, a, input, select, textarea, [contenteditable]:not([contenteditable='false'])";

interface Round {
  start: number;
  duration: number;
  startX: number;
  resolved: boolean;
  /** 타격 성공 시각 — 있으면 공이 날아가는 연출을 재생한다 */
  hitAt?: number;
}

function newRound(duration: number): Round {
  return { start: performance.now(), duration, startX: 46 + Math.random() * 8, resolved: false };
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_TARGET_SELECTOR) !== null;
}

/** 멀리서 날아와 커지는 공이 점선 링에 겹치는 순간 Space로 배트를 휘두른다 — 3회 맞히면 클리어. */
export function BallCatchMinigame({ onComplete }: MinigameProps) {
  const { t } = useTranslation();
  const complete = useOnceCompleter(onComplete);
  const [catches, setCatches] = useState(0);
  const [misses, setMisses] = useState(0);
  const [feedback, setFeedback] = useState<SwingResult | null>(null);
  const [showPrompt, setShowPrompt] = useState(true);
  /** 배트 스윙 애니메이션 리트리거 키 — 입력할 때마다 증가 */
  const [swingId, setSwingId] = useState(0);
  const ballRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const roundRef = useRef<Round>(newRound(ROUND_MS_START));
  const pendingTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const skipByTime = useSkipEligible(SKIP_AFTER_MS);

  const schedulePendingTimeout = (callback: () => void, delay: number) => {
    const timeout = setTimeout(() => {
      pendingTimeoutsRef.current.delete(timeout);
      callback();
    }, delay);
    pendingTimeoutsRef.current.add(timeout);
  };

  const missRef = useRef((_result: SwingResult) => {});
  missRef.current = (result) => {
    setFeedback(result);
    const next = misses + 1;
    setMisses(next);
    if (next >= MAX_MISSES) complete({ cleared: false, score: catches });
  };

  const scheduleNextRef = useRef(() => {});
  scheduleNextRef.current = () => {
    const duration = Math.max(ROUND_MS_MIN, ROUND_MS_START - catches * ROUND_MS_STEP);
    schedulePendingTimeout(() => {
      roundRef.current = newRound(duration);
    }, ROUND_GAP_MS);
  };

  const attemptRef = useRef(() => {});
  attemptRef.current = () => {
    const round = roundRef.current;
    if (round.resolved) return;
    round.resolved = true;
    setSwingId((id) => id + 1); // 헛스윙이어도 배트는 휘두른다
    setShowPrompt(false);
    const progress = (performance.now() - round.start) / round.duration;
    const result = classifySwing(progress, CATCH_WINDOW);
    setFeedback(result);

    if (result === "hit") {
      round.hitAt = performance.now();
      const next = catches + 1;
      setCatches(next);
      if (next >= GOAL_CATCHES) {
        // 마지막 타구가 날아가는 걸 보여준 뒤 완료
        schedulePendingTimeout(() => complete({ cleared: true, score: next }), CLEAR_DELAY_MS);
        return;
      }
    } else {
      missRef.current(result);
    }
    scheduleNextRef.current();
  };

  // 공 비행 애니메이션 — setState 대신 ref 직접 변이 (60fps)
  useEffect(() => {
    let frame = 0;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = motionPreference.matches;
    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      reduceMotion = event.matches;
    };
    motionPreference.addEventListener("change", onMotionPreferenceChange);
    const loop = (now: number) => {
      const round = roundRef.current;
      const progress = (now - round.start) / round.duration;
      const clamped = Math.min(progress, 1);
      const hidden = round.resolved || progress < 0;
      const ball = ballRef.current;
      if (ball) {
        if (round.hitAt !== undefined) {
          // 타격! 공이 우상단으로 빠르게 날아간다
          const fly = (now - round.hitAt) / HIT_FLY_MS;
          if (fly < 1) {
            if (reduceMotion) {
              ball.style.opacity = `${1 - fly}`;
              ball.style.left = "50%";
              ball.style.top = "68%";
              ball.style.transform = "translate(-50%, -50%) scale(1.3) rotate(270deg)";
            } else {
              ball.style.opacity = `${1 - fly * 0.35}`;
              ball.style.left = `${50 + 42 * fly}%`;
              ball.style.top = `${68 - 80 * fly}%`;
              ball.style.transform = `translate(-50%, -50%) scale(${1.3 - 0.75 * fly}) rotate(${SPIN_DEG + fly * 420}deg)`;
            }
          } else {
            ball.style.opacity = "0";
          }
        } else if (hidden) {
          ball.style.opacity = "0";
        } else {
          const x = round.startX + (50 - round.startX) * clamped;
          const y = 35 + 33 * clamped;
          // 크기는 ease-in — 멀리서 날아오다 가까워질수록 훅 커지는 원근감
          const scale = 0.25 + 1.05 * clamped ** 1.6;
          if (reduceMotion) {
            ball.style.opacity = `${0.55 + 0.45 * clamped}`;
            ball.style.left = `${x}%`;
            ball.style.top = `${56 + 12 * clamped}%`;
            ball.style.transform = `translate(-50%, -50%) scale(${0.85 + 0.45 * clamped}) rotate(0deg)`;
          } else {
            ball.style.opacity = "1";
            ball.style.left = `${x}%`;
            ball.style.top = `${y}%`;
            ball.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${clamped * SPIN_DEG}deg)`;
          }
        }
      }
      // 착지 그림자 — 공이 가까워질수록 링 자리에서 진하고 크게
      const shadow = shadowRef.current;
      if (shadow) {
        shadow.style.opacity = hidden ? "0" : `${0.15 + 0.4 * clamped}`;
        shadow.style.transform = `translate(-50%, -50%) scale(${0.5 + 0.7 * clamped})`;
      }
      if (!round.resolved && progress >= CATCH_WINDOW[1]) {
        // 놓친 공 (드롭)
        round.resolved = true;
        missRef.current("late");
        scheduleNextRef.current();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      motionPreference.removeEventListener("change", onMotionPreferenceChange);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || isInteractiveTarget(event.target)) return;
      event.preventDefault();
      attemptRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(
    () => () => {
      for (const timeout of pendingTimeoutsRef.current) clearTimeout(timeout);
      pendingTimeoutsRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => setShowPrompt(false), 2400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 350);
    return () => clearTimeout(timer);
  }, [feedback]);

  return (
    <MinigameShell
      title={t("minigame.ballCatch.title")}
      help={t("minigame.ballCatch.help")}
      skipVisible={skipByTime || misses >= SKIP_AFTER_MISSES}
      onSkip={() => complete({ cleared: true, score: catches })}
      size="lg"
    >
      <BallCatchField
        ballRef={ballRef}
        shadowRef={shadowRef}
        remainingMisses={remainingChances(misses, MAX_MISSES)}
        maxMisses={MAX_MISSES}
        feedback={feedback}
        swingId={swingId}
        showPrompt={showPrompt}
        onSwing={() => attemptRef.current()}
        labels={{
          aria: t("minigame.ballCatch.help"),
          hits: t("minigame.ballCatch.hits", { value: catches, goal: GOAL_CATCHES }),
          chances: t("minigame.ballCatch.chances"),
          prompt: t("minigame.ballCatch.prompt"),
          hit: t("minigame.feedback.hit"),
          early: t("minigame.ballCatch.early"),
          late: t("minigame.ballCatch.late"),
        }}
      />
    </MinigameShell>
  );
}
