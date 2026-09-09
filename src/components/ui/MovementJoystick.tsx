"use client";

import {
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { MovementAxes } from "@/types/movement";
import { joystickVectorFromOffset } from "./movement-joystick";

const CENTERED_KNOB = { x: 0, y: 0 };

export function MovementJoystick({
  inputRef,
  disabled,
  label,
  caption,
}: {
  inputRef: MutableRefObject<MovementAxes>;
  disabled: boolean;
  /** 스크린리더용 전체 설명 (키보드 대안 포함). */
  label: string;
  /** 스틱 아래에 보이는 짧은 캡션 — 이게 무슨 UI인지 눈으로 알려준다. */
  caption: string;
}) {
  const activePointerRef = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState(CENTERED_KNOB);

  const reset = useCallback(() => {
    activePointerRef.current = null;
    inputRef.current.horizontal = 0;
    inputRef.current.vertical = 0;
    setKnobOffset(CENTERED_KNOB);
  }, [inputRef]);

  useEffect(() => {
    if (disabled) reset();
  }, [disabled, reset]);

  useEffect(() => () => reset(), [reset]);

  const updateFromPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const radius = Math.min(bounds.width, bounds.height) / 2;
    const axes = joystickVectorFromOffset(
      event.clientX - (bounds.left + bounds.width / 2),
      event.clientY - (bounds.top + bounds.height / 2),
      radius,
    );
    inputRef.current.horizontal = axes.horizontal;
    inputRef.current.vertical = axes.vertical;

    const knobTravel = radius * 0.57;
    setKnobOffset({
      x: axes.horizontal * knobTravel,
      y: -axes.vertical * knobTravel,
    });
  };

  const finishPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    reset();
  };

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      // group: 아래 캡션이 비활성 상태를 같이 따라가게 한다
      // 잠겼을 때는 완전히 사라진다 — 좁은 화면에서 대사창과 겹쳐 보이는 걸 막는다
      className="group absolute bottom-24 left-4 z-20 size-28 touch-none select-none rounded-full border border-line bg-surface shadow-chip transition-opacity duration-200 disabled:pointer-events-none disabled:opacity-0 md:left-6"
      onPointerDown={(event) => {
        if (disabled) return;
        event.preventDefault();
        activePointerRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (activePointerRef.current === event.pointerId) updateFromPointer(event);
      }}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onLostPointerCapture={(event) => {
        if (activePointerRef.current === event.pointerId) reset();
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-3 rounded-full border border-line"
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
        <span
          className="size-12 rounded-full border border-ivory/40 bg-ivory/85 shadow-chip"
          style={{ transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)` }}
        />
      </span>
      {/* 무엇을 하는 UI인지 화면 안에서 알려준다 — 별도 도움말 화면을 두지 않는다 */}
      <span
        aria-hidden
        className="monologue-text pointer-events-none absolute -bottom-6 left-1/2 w-max -translate-x-1/2 text-xs font-medium tracking-[0.06em] text-fog"
      >
        {caption}
      </span>
    </button>
  );
}
