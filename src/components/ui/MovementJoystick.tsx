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
}: {
  inputRef: MutableRefObject<MovementAxes>;
  disabled: boolean;
  label: string;
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
      className="absolute bottom-24 left-4 z-20 size-28 touch-none select-none rounded-full border-2 border-bone/50 bg-scene-deep/75 shadow-chip backdrop-blur-sm transition-opacity disabled:pointer-events-none disabled:opacity-30 md:left-6"
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
        className="pointer-events-none absolute inset-3 rounded-full border border-bone/25"
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
        <span
          className="size-12 rounded-full border-2 border-bone bg-paper/90 shadow-chip"
          style={{ transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)` }}
        />
      </span>
    </button>
  );
}
