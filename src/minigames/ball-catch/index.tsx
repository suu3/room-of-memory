"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, useOnceCompleter, useSkipEligible } from "../shell";
import { BallCatchField } from "./field";
import {
  classifySwing,
  nextPitch,
  nextTempo,
  type PitchSide,
  type PitchTempoKey,
  remainingChances,
  roundDuration,
  SWING_TUNINGS,
  type SwingResult,
  TUTORIAL_SCALE,
} from "./timing";

const SKIP_AFTER_MS = 30_000;
const SKIP_AFTER_MISSES = 3;
const ROUND_GAP_MS = 550;
/**
 * 공이 네모 틀과 겹치는 판정 구간 (진행률). 1.0 = 공이 링 중심 도달:
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
  /** 타격 성공 시각: 있으면 공이 날아가는 연출을 재생한다 */
  hitAt?: number;
  /** 첫 투구: 느리게 오고, 링에 겹치는 순간 "지금!"이 뜬다 */
  tutorial?: boolean;
}

function newRound(
  duration: number,
  lastSide: PitchSide,
  tutorial = false,
): Round & { side: PitchSide } {
  const { startX, side } = nextPitch(lastSide, Math.random());
  return { start: performance.now(), duration, startX, resolved: false, side, tutorial };
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_TARGET_SELECTOR) !== null;
}

/**
 * 멀리서 날아와 커지는 공이 네모 틀에 겹치는 순간 Space로 배트를 휘두른다.
 * 이지는 세 번, 보통은 다섯 번 맞히면 클리어 (./timing.ts의 SWING_TUNINGS).
 */
export function BallCatchMinigame({ onComplete, onSettled, difficulty = "easy" }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const { goal: GOAL_CATCHES, maxMisses: MAX_MISSES } = SWING_TUNINGS[difficulty];
  const [catches, setCatches] = useState(0);
  const [misses, setMisses] = useState(0);
  const [feedback, setFeedback] = useState<SwingResult | null>(null);
  const [showPrompt, setShowPrompt] = useState(true);
  /** 배트 스윙 애니메이션 리트리거 키: 입력할 때마다 증가 */
  const [swingId, setSwingId] = useState(0);
  const ballRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  /** "지금!" 표식: 첫 투구가 링에 겹치는 동안만 켜진다. rAF에서 ref로 켜고 끈다 */
  const nowRef = useRef<HTMLSpanElement>(null);
  /** 직전 공이 어느 쪽에서 왔는지: 다음 공은 반대편에서 온다. */
  const lastSideRef = useRef<PitchSide>(1);
  /** 직전 구종: 다음 공은 이것 말고 다른 속도로 온다. 첫 공이 느린 공이라 여기서 시작한다 */
  const lastTempoRef = useRef<PitchTempoKey>("slow");
  // 첫 공은 튜토리얼 피치: 느리게 던지고 링에 겹치는 순간을 글자로 짚어 준다
  const roundRef = useRef<Round>(newRound(roundDuration(0, TUTORIAL_SCALE), -1, true));
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
    const tempo = nextTempo(lastTempoRef.current, Math.random());
    lastTempoRef.current = tempo.key;
    const duration = roundDuration(catches, tempo.scale);
    schedulePendingTimeout(() => {
      const round = newRound(duration, lastSideRef.current);
      lastSideRef.current = round.side;
      roundRef.current = round;
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
    // 맞은 순간과 빗나간 순간의 소리를 다르게: 타이밍 게임은 귀로도 배운다.
    // 음높이를 살짝 흔드는 건 다섯 번의 스윙이 다섯 번으로 들리게 하기 위한 것.
    playSound(result === "hit" ? "batHit" : "swingMiss", { variation: 0.06 });

    if (result === "hit") {
      round.hitAt = performance.now();
      const next = catches + 1;
      setCatches(next);
      if (next >= GOAL_CATCHES) {
        // 마지막 타구가 날아가는 걸 보여준 뒤 완료. 그 사이 바깥 클릭으로
        // 판이 날아가지 않게 호스트에 먼저 알린다.
        onSettled?.();
        schedulePendingTimeout(() => complete({ cleared: true, score: next }), CLEAR_DELAY_MS);
        return;
      }
    } else {
      missRef.current(result);
    }
    scheduleNextRef.current();
  };

  // 공 비행 애니메이션: setState 대신 ref 직접 변이 (60fps)
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
          // 크기는 ease-in: 멀리서 날아오다 가까워질수록 훅 커지는 원근감
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
      // 착지 그림자: 공이 가까워질수록 링 자리에서 진하고 크게
      const shadow = shadowRef.current;
      if (shadow) {
        shadow.style.opacity = hidden ? "0" : `${0.15 + 0.4 * clamped}`;
        shadow.style.transform = `translate(-50%, -50%) scale(${0.5 + 0.7 * clamped})`;
      }
      // 첫 투구: 링에 겹치는 구간에서만 "지금!"이 켜진다. 타이밍을 글자로 한 번 짚어 준다
      const nowMark = nowRef.current;
      if (nowMark) {
        const inWindow =
          round.tutorial === true &&
          !round.resolved &&
          progress >= CATCH_WINDOW[0] &&
          progress <= CATCH_WINDOW[1];
        nowMark.style.opacity = inWindow ? "1" : "0";
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
      help={hint("minigame.ballCatch.help")}
      skipVisible={skipByTime || misses >= SKIP_AFTER_MISSES}
      onSkip={() => complete({ cleared: true, score: catches })}
      size="lg"
    >
      <BallCatchField
        ballRef={ballRef}
        shadowRef={shadowRef}
        nowRef={nowRef}
        remainingMisses={remainingChances(misses, MAX_MISSES)}
        maxMisses={MAX_MISSES}
        feedback={feedback}
        swingId={swingId}
        showPrompt={showPrompt}
        onSwing={() => attemptRef.current()}
        labels={{
          aria: hint("minigame.ballCatch.help"),
          hits: t("minigame.ballCatch.hits", { value: catches, goal: GOAL_CATCHES }),
          chances: t("minigame.ballCatch.chances"),
          prompt: hint("minigame.ballCatch.prompt"),
          now: t("minigame.ballCatch.now"),
          hit: t("minigame.feedback.hit"),
          early: t("minigame.ballCatch.early"),
          late: t("minigame.ballCatch.late"),
        }}
      />
    </MinigameShell>
  );
}
