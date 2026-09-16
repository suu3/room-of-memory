"use client";

import { useEffect, useState } from "react";
import { selectViewpoint, useMemoryRoomStore, type Viewpoint } from "@/store/memory-room";

/**
 * 시점이 바뀌는 순간 화면을 덮었다 걷는 한 겹.
 *
 * 직교(아이소메트릭)와 원근(1인칭) 카메라 사이에는 연속된 길이 없다. 전환은 컷이고,
 * 이 겹이 그 컷을 덮는다. 두 방향의 색이 다르다:
 *
 * - 등 뒤 시점으로 **들어갈 때**는 어둠(void)이 걷힌다. 눈을 뜨는 것이다. 인트로는 불 꺼진
 *   방이라 어둠에서 어둠으로 이어지고, 2막 도입은 문을 여는 순간 눈을 감았다 뜬다.
 * - 등 뒤 시점에서 **나올 때**는 빛이 걷힌다. 인트로는 불이 켜지는 흰빛(ivory), 문 넘기는
 *   문 쪽의 금빛(memory). 그 빛이 곧 그 구간의 목적지였으니까.
 *
 * 그리는 것뿐이다. 카메라를 바꿔 끼우는 일은 ChaseCameraRig가 마운트·언마운트로 한다.
 */
const TONES = {
  enter: { className: "bg-scene-void", durationMs: 1400 },
  lightsOn: { className: "bg-ivory", durationMs: 1100 },
  doorway: { className: "bg-memory", durationMs: 1000 },
} as const;

type Tone = keyof typeof TONES;

/** 이전 시점에서 다음 시점으로 넘어갈 때 어느 색이 덮는가. 바뀌지 않았으면 없음. */
export function transitionTone(previous: Viewpoint, next: Viewpoint): Tone | null {
  if (previous === next) return null;
  if (next !== null) return "enter";
  return previous === "intro" ? "lightsOn" : "doorway";
}

export function ViewpointTransition() {
  const [flash, setFlash] = useState<{ id: number; tone: Tone } | null>(null);

  useEffect(
    () =>
      useMemoryRoomStore.subscribe((state, previous) => {
        const tone = transitionTone(selectViewpoint(previous), selectViewpoint(state));
        if (tone === null) return;
        setFlash((current) => ({ id: (current?.id ?? 0) + 1, tone }));
      }),
    [],
  );

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), TONES[flash.tone].durationMs);
    return () => window.clearTimeout(timer);
  }, [flash]);

  if (!flash) return null;
  const { className, durationMs } = TONES[flash.tone];

  return (
    <div
      // 같은 색이 연달아 와도 다시 덮이게 key로 새로 마운트한다
      key={flash.id}
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-40 animate-viewpoint-fade ${className}`}
      style={{ animationDuration: `${durationMs}ms` }}
    />
  );
}
