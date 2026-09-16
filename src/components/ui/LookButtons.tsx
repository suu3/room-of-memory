"use client";

import { ArrowClockwise, ArrowCounterClockwise } from "@phosphor-icons/react";
import {
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
} from "react";
import type { LookAngles } from "@/scenes/memory-room/first-person";
import { FOCUS_RING } from "./ui-classes";

/** 누르고 있는 동안 도는 속도 (rad/s). 한 바퀴에 4초쯤: 찾는 구간이라 빠르면 놓친다. */
const TURN_RATE = 1.5;

/**
 * 1인칭 구간의 돌아보기 버튼 (손가락 기기 전용). 왼쪽 조이스틱의 짝으로 오른쪽 아래에 선다.
 *
 * 화면을 끌어도 돌지만, 끌기는 물건을 누르려는 손과 늘 헷갈리고 한 손으로 걸으면서
 * 다른 손으로 끌기는 어렵다. 누르고 있는 만큼 도는 버튼 둘이면 조이스틱과 같은 문법이다.
 * 키보드의 `,`/`.`와 같은 일을 한다 (use-first-person-look).
 *
 * 값은 시선 ref에 직접 더한다. 프레임마다 FirstPersonRig가 읽으므로 상태로 둘 이유가 없다.
 */
export function LookButtons({
  lookRef,
  disabled,
  labels,
  caption,
}: {
  lookRef: MutableRefObject<LookAngles>;
  disabled: boolean;
  labels: { left: string; right: string };
  caption: string;
}) {
  /** 지금 누르고 있는 방향 (-1 오른쪽, 0 없음, 1 왼쪽)과 그 포인터. */
  const holdRef = useRef<{ direction: -1 | 0 | 1; pointerId: number | null }>({
    direction: 0,
    pointerId: null,
  });
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const step = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { direction } = holdRef.current;
      if (direction !== 0) lookRef.current.yaw += direction * TURN_RATE * step;
      frameRef.current = window.requestAnimationFrame(tick);
    };
    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      holdRef.current.direction = 0;
    };
  }, [lookRef]);

  useEffect(() => {
    if (disabled) holdRef.current.direction = 0;
  }, [disabled]);

  const press = (direction: -1 | 1) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    holdRef.current = { direction, pointerId: event.pointerId };
  };
  const release = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (holdRef.current.pointerId !== event.pointerId) return;
    holdRef.current = { direction: 0, pointerId: null };
  };
  const buttonClass = `grid size-14 cursor-pointer place-items-center rounded-full border border-line bg-surface text-ivory/85 shadow-chip transition-colors active:bg-surface-strong active:text-ivory ${FOCUS_RING}`;

  return (
    <div
      // 잠겼을 때는 조이스틱처럼 통째로 사라진다
      className={`absolute bottom-24 right-4 z-20 flex touch-none select-none flex-col items-center gap-2 transition-opacity duration-200 md:right-6 ${
        disabled ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex gap-3">
        <button
          type="button"
          aria-label={labels.left}
          disabled={disabled}
          className={buttonClass}
          onPointerDown={press(1)}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
        >
          <ArrowCounterClockwise size={22} weight="bold" />
        </button>
        <button
          type="button"
          aria-label={labels.right}
          disabled={disabled}
          className={buttonClass}
          onPointerDown={press(-1)}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
        >
          <ArrowClockwise size={22} weight="bold" />
        </button>
      </div>
      {/* 무엇을 하는 버튼인지 화면 안에서 알려준다 (조이스틱의 캡션과 같은 자리) */}
      <span
        aria-hidden
        className="monologue-text pointer-events-none text-xs font-medium tracking-[0.06em] text-fog"
      >
        {caption}
      </span>
    </div>
  );
}
