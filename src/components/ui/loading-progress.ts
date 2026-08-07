"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 로딩 바가 흐르게 만드는 계산.
 *
 * three의 로딩 매니저는 **파일이 끝날 때만** 하나씩 센다. 방이 쓰는 모델은 열세 개고
 * 전부 3~33KB라, 실제로 보이는 그림은 "0에 한참 멈춰 있다가 계단으로 몇 번 튀고 끝"이다.
 * 진행률 자체는 정확한데 사람 눈에는 바가 고장 난 것처럼 보인다.
 *
 * 그래서 보고값(target)과 그리는 값(shown)을 분리한다. shown은 매 프레임 target 쪽으로
 * 당겨지되,
 *
 * - 보고가 앞서 있으면 **빠르게** 따라붙는다 (계단이 경사로가 된다)
 * - 보고가 멎어 있으면 남은 구간의 일부까지만 **천천히** 기어오른다 (멈춘 바가 없다)
 *
 * 기어오르는 데는 상한이 있다. 아직 아무것도 안 받았는데 90%를 그리면 그건 거짓말이고,
 * 남은 10%에서 영원히 기다리는 것이 계단보다 나쁘다. 남은 구간의 몫으로 잘라 두면
 * 상한이 저절로 감속한다 — 0%에서는 38%까지, 80%에서는 88%까지.
 */

/** 보고가 앞서 있을 때 따라붙는 속도(1/초). 계단 하나를 0.3초쯤에 삼킨다. */
const CATCH_UP_LAMBDA = 7;

/**
 * 다 받은 뒤 100%까지 닫는 속도(1/초).
 *
 * 따라붙는 속도보다 빠르다. 이 구간은 커튼이 걷히기를 기다리는 시간이라 — 바를
 * 다 채우는 걸 보여주는 값어치는 있지만, 그 이상 붙들고 있으면 그냥 지연이다.
 */
const FINISH_LAMBDA = 12;

/** 보고가 멎어 있을 때 기어오르는 속도(1/초). 눈에 겨우 보일 만큼만 움직여야 한다. */
const CREEP_LAMBDA = 0.55;

/** 보고가 멎었을 때 남은 구간 중 미리 먹어도 되는 몫. */
const CREEP_SHARE = 0.38;

/**
 * 목표와 이만큼 가까워지면 붙여 버린다.
 *
 * 지수 감쇠는 목표에 영원히 도달하지 않는다 — 못을 박아 두지 않으면 100%가 0.9998에
 * 멈춰 서고, 그걸 기다리는 커튼도 같이 안 걷힌다.
 */
const SNAP = 0.002;

/** from에서 to 쪽으로 지수 감쇠. three의 MathUtils.damp와 같은 식이되 three를 안 물어 온다. */
function damp(from: number, to: number, lambda: number, deltaSeconds: number): number {
  return from + (to - from) * (1 - Math.exp(-lambda * deltaSeconds));
}

export function advanceLoadProgress({
  shown,
  target,
  deltaMs,
}: {
  /** 지금 그리고 있는 값 (0~1). */
  shown: number;
  /** 로딩 매니저가 보고한 값 (0~1). */
  target: number;
  /** 지난 프레임에서 흐른 시간. */
  deltaMs: number;
}): number {
  const clampedTarget = Math.min(1, Math.max(0, target));
  const deltaSeconds = Math.max(0, deltaMs) / 1000;

  // 다 받았으면 기어오를 것이 없다. 남은 거리를 그대로 100까지 달린다.
  if (clampedTarget >= 1) {
    const next = damp(shown, 1, FINISH_LAMBDA, deltaSeconds);
    return 1 - next < SNAP ? 1 : next;
  }

  // 보고가 앞서 있으면 그쪽으로, 멎어 있으면 상한까지만.
  const behind = shown < clampedTarget;
  const goal = behind ? clampedTarget : clampedTarget + (1 - clampedTarget) * CREEP_SHARE;
  const lambda = behind ? CATCH_UP_LAMBDA : CREEP_LAMBDA;

  const next = damp(shown, goal, lambda, deltaSeconds);
  // 되감기 금지 — 바가 뒤로 가면 다 됐다고 생각한 사람이 다시 기다린다.
  if (next <= shown) return shown;
  return goal - next < SNAP ? goal : next;
}

/**
 * 보고값을 흐르는 값으로 바꿔 준다. 프레임마다 setState 하지만 여기는 DOM이라
 * 괜찮다 — useFrame 안에서 금지된 것과는 다른 자리다 (.claude/rules/r3f.md).
 *
 * 다 차면 루프를 놓는다. 로딩이 끝난 뒤에도 rAF가 돌고 있으면 방이 그 프레임을 나눠 쓴다.
 */
export function useSmoothLoadProgress(target: number): number {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    let frame = 0;
    /** 첫 프레임에는 흐른 시간을 모른다 — 기준 시각만 잡고 값은 건드리지 않는다. */
    let last: number | null = null;

    const tick = (now: number) => {
      const deltaMs = last === null ? 0 : now - last;
      last = now;

      const next = advanceLoadProgress({
        shown: shownRef.current,
        target: targetRef.current,
        deltaMs,
      });
      if (next !== shownRef.current) {
        shownRef.current = next;
        setShown(next);
      }

      if (next >= 1) return;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return shown;
}
