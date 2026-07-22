"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ASSETS } from "@/lib/assets";
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

interface Round {
  start: number;
  duration: number;
  startX: number;
  resolved: boolean;
  /** 타격 성공 시각 — 있으면 공이 날아가는 연출을 재생한다 */
  hitAt?: number;
}

function newRound(duration: number): Round {
  return { start: performance.now(), duration, startX: 30 + Math.random() * 40, resolved: false };
}

/** 멀리서 날아와 커지는 공이 점선 링에 겹치는 순간 Space로 배트를 휘두른다 — 3회 맞히면 클리어. */
export function BallCatchMinigame({ onComplete }: MinigameProps) {
  const { t } = useTranslation();
  const complete = useOnceCompleter(onComplete);
  const [catches, setCatches] = useState(0);
  const [misses, setMisses] = useState(0);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  /** 배트 스윙 애니메이션 리트리거 키 — 입력할 때마다 증가 */
  const [swingId, setSwingId] = useState(0);
  const ballRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
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
    setSwingId((id) => id + 1); // 헛스윙이어도 배트는 휘두른다
    const round = roundRef.current;
    if (round.resolved) return;
    round.resolved = true;
    const progress = (performance.now() - round.start) / round.duration;
    if (progress >= CATCH_WINDOW[0] && progress <= CATCH_WINDOW[1]) {
      round.hitAt = performance.now();
      setFlash("hit");
      const next = catches + 1;
      setCatches(next);
      if (next >= GOAL_CATCHES) {
        // 마지막 타구가 날아가는 걸 보여준 뒤 완료
        setTimeout(() => complete({ cleared: true, score: next }), CLEAR_DELAY_MS);
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
      const clamped = Math.min(progress, 1);
      const hidden = round.resolved || progress < 0;
      const ball = ballRef.current;
      if (ball) {
        if (round.hitAt !== undefined) {
          // 타격! 공이 우상단으로 빠르게 날아간다
          const fly = (now - round.hitAt) / HIT_FLY_MS;
          if (fly < 1) {
            ball.style.opacity = `${1 - fly * 0.35}`;
            ball.style.left = `${50 + 42 * fly}%`;
            ball.style.top = `${68 - 80 * fly}%`;
            ball.style.transform = `translate(-50%, -50%) scale(${1.3 - 0.75 * fly}) rotate(${SPIN_DEG + fly * 420}deg)`;
          } else {
            ball.style.opacity = "0";
          }
        } else if (hidden) {
          ball.style.opacity = "0";
        } else {
          const x = round.startX + (50 - round.startX) * clamped;
          const y = 12 + 56 * clamped;
          // 크기는 ease-in — 멀리서 날아오다 가까워질수록 훅 커지는 원근감
          const scale = 0.25 + 1.05 * clamped ** 1.6;
          ball.style.opacity = "1";
          ball.style.left = `${x}%`;
          ball.style.top = `${y}%`;
          ball.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${clamped * SPIN_DEG}deg)`;
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
          <span className="rounded-full border border-ink/10 bg-bone/50 px-2.5 py-0.5">
            {t("minigame.successCount", { value: catches, goal: GOAL_CATCHES })}
          </span>
          <span className="rounded-full border border-ink/10 bg-bone/50 px-2.5 py-0.5">
            {t("minigame.missCount", { value: misses, max: MAX_MISSES })}
          </span>
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
      onSkip={() => complete({ cleared: true, score: catches })}
      size="lg"
    >
      <button
        type="button"
        onPointerDown={() => attemptRef.current()}
        aria-label={t("minigame.ballCatch.help")}
        className={`relative block h-96 w-full cursor-pointer overflow-hidden rounded-md border-2 transition-colors duration-300 ${
          flash === "hit" ? "border-memory" : flash === "miss" ? "border-ember" : "border-ink/15"
        }`}
        style={{
          background:
            "radial-gradient(120% 95% at 50% 18%, var(--color-scene-storm) 0%, var(--color-scene-slate) 52%, var(--color-scene-abyss) 100%)",
        }}
      >
        {/* 지평선 */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-[22%] border-t border-dashed border-bone/15"
        />
        {/* 링 자리에 스미는 금빛 산광 */}
        <div
          aria-hidden
          className="absolute left-1/2 top-[68%] h-44 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in srgb, var(--color-memory) 14%, transparent) 0%, transparent 100%)",
          }}
        />
        {/* 가장자리 비네트 */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 80% at 50% 45%, transparent 55%, color-mix(in srgb, var(--color-scene-void) 55%, transparent) 100%)",
          }}
        />
        {/* 착지 그림자 — 공이 가까워질수록 진해진다 */}
        <div
          ref={shadowRef}
          aria-hidden
          className="absolute left-1/2 top-[68%] h-4 w-16 rounded-[50%] opacity-0"
          style={{
            background: "color-mix(in srgb, var(--color-scene-void) 65%, transparent)",
            filter: "blur(3px)",
            transform: "translate(-50%, -50%) scale(0.5)",
          }}
        />
        {/* 캐치 링 — 판정 위치 표시 */}
        <div
          aria-hidden
          className={`absolute left-1/2 top-[68%] size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors duration-200 ${
            flash === "hit"
              ? "border-memory"
              : flash === "miss"
                ? "border-ember/80 border-dashed"
                : "border-memory/70 border-dashed"
          }`}
          style={{
            boxShadow:
              "0 0 28px color-mix(in srgb, var(--color-memory) 22%, transparent), inset 0 0 16px color-mix(in srgb, var(--color-memory) 12%, transparent)",
          }}
        />
        {/* 공 */}
        <div
          ref={ballRef}
          aria-hidden
          className="absolute size-14 bg-contain bg-center bg-no-repeat opacity-0"
          style={{
            left: "50%",
            top: "12%",
            transform: "translate(-50%, -50%) scale(0.25)",
            backgroundImage: `url(${ASSETS.images.mgBallCatchBall})`,
            filter:
              "drop-shadow(0 8px 10px color-mix(in srgb, var(--color-scene-void) 60%, transparent))",
          }}
        />
        {/* 배트 — 입력할 때마다 링을 가로질러 휘두른다 */}
        <div
          aria-hidden
          className="absolute left-[59%] top-[79%]"
          style={{ transform: "translate(-50%, -100%)" }}
        >
          <div
            key={swingId}
            className={swingId > 0 ? "animate-bat-swing" : undefined}
            style={{ transform: "rotate(34deg)", transformOrigin: "50% 94%" }}
          >
            <svg
              width="30"
              height="104"
              viewBox="0 0 30 104"
              role="presentation"
              className="drop-shadow-md"
            >
              {/* 몸통: 배럴 → 손잡이 테이퍼 */}
              <path
                d="M 3 15 A 12 12 0 0 1 27 15 L 19 66 Q 18.4 80 18.4 92 L 11.6 92 Q 11.6 80 11 66 Z"
                fill="var(--color-bone)"
                stroke="var(--color-ink)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {/* 그립 테이프 — 레드 스티치 포인트 */}
              <rect x="10.4" y="82" width="9.2" height="7" fill="var(--color-ember)" />
              {/* 노브 */}
              <ellipse
                cx="15"
                cy="96"
                rx="8"
                ry="5"
                fill="var(--color-bone)"
                stroke="var(--color-ink)"
                strokeWidth="2.5"
              />
            </svg>
          </div>
        </div>
      </button>
    </MinigameShell>
  );
}
