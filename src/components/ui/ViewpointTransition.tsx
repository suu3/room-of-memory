"use client";

import { useEffect, useState } from "react";
import { selectViewpoint, useMemoryRoomStore, type Viewpoint } from "@/store/memory-room";

/**
 * 시점이 바뀌는 순간 화면을 덮었다 걷는 한 겹.
 *
 * 직교(아이소메트릭)와 원근(1인칭) 카메라 사이에는 연속된 길이 없다. 전환은 컷이고,
 * 이 겹이 그 컷을 덮는다. 두 방향의 색이 다르다:
 *
 * - 1인칭으로 **들어갈 때**는 어둠(void)이 걷힌다. 눈을 뜨는 것이다. 인트로는 불 꺼진
 *   방이라 어둠에서 어둠으로 이어지고, 2막 도입은 문을 여는 순간 눈을 감았다 뜬다.
 * - 1인칭에서 **나올 때**는 빛이 걷힌다. 인트로는 막 켜진 전등의 누런빛(.viewpoint-lamp),
 *   문 넘기는 문 쪽의 금빛(memory). 그 빛이 곧 그 구간의 목적지였으니까.
 *
 * 불 켜기의 덮개는 순백이 아니다. 캄캄한 방에서 한 프레임에 흰 화면으로 튀면 밝기 차가
 * 가장 큰 전환이라 광과민성에 위험하다. 밤에 볕 색을 섞은 중간 밝기로 덮고 걷는 시간을
 * 조금 더 준다 (globals.css의 .viewpoint-lamp: 모션을 끈 판에서는 어둠으로 잇는다).
 *
 * 그리는 것뿐이다. 카메라를 바꿔 끼우는 일은 FirstPersonRig가 마운트·언마운트로 한다.
 */
const TONES = {
  enter: { className: "bg-scene-void", durationMs: 1400 },
  lightsOn: { className: "viewpoint-lamp", durationMs: 1300 },
  doorway: { className: "bg-memory", durationMs: 1000 },
} as const;

type Tone = keyof typeof TONES;

/**
 * 덮개가 **꽉 닫힌 채** 버티는 시간(ms). 이 뒤에 비로소 걷히기 시작한다.
 *
 * 카메라를 바꿔 끼우는 건 리액트 커밋이지만 새 카메라로 한 장이 그려지는 건 캔버스의
 * 다음 프레임이다. 그 사이에 모델이 하나 들어오느라 프레임이 끊기면, 덮개는 시계를 따라
 * 이미 걷히는 중인데 화면은 아직 옛 카메라다: 아이소메트릭 방이 반쯤 비쳤다 컷으로 튄다.
 *
 * 그래서 시계가 아니라 **프레임**을 기다린다. requestAnimationFrame은 주 스레드가 막히면
 * 같이 밀리므로, 두 번 돌아올 때까지 기다리면 캔버스도 한 장은 그린 뒤다. 짧게 끊기는
 * 경우까지 덮도록 최소 시간을 하나 더 얹는다 (프레임이 멀쩡할 때는 이쪽이 기준이다).
 */
const HOLD_MS = 160;

/** 이전 시점에서 다음 시점으로 넘어갈 때 어느 색이 덮는가. 바뀌지 않았으면 없음. */
export function transitionTone(previous: Viewpoint, next: Viewpoint): Tone | null {
  if (previous === next) return null;
  if (next !== null) return "enter";
  return previous === "intro" ? "lightsOn" : "doorway";
}

export function ViewpointTransition() {
  const [flash, setFlash] = useState<{ id: number; tone: Tone } | null>(null);
  /** 덮개가 걷히기 시작했는가. 프레임이 돌아오고 최소 시간이 지나야 참이 된다. */
  const [lifting, setLifting] = useState(false);

  useEffect(
    () =>
      useMemoryRoomStore.subscribe((state, previous) => {
        const tone = transitionTone(selectViewpoint(previous), selectViewpoint(state));
        if (tone === null) return;
        setFlash((current) => ({ id: (current?.id ?? 0) + 1, tone }));
      }),
    [],
  );

  /* 프레임이 두 번 돌아오고 최소 시간이 지나면 걷기 시작한다 (HOLD_MS 주석). */
  useEffect(() => {
    if (!flash) return;
    setLifting(false);
    let inner = 0;
    let timer = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        timer = window.setTimeout(() => setLifting(true), HOLD_MS);
      });
    });
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
      window.clearTimeout(timer);
    };
  }, [flash]);

  useEffect(() => {
    if (!flash || !lifting) return;
    const timer = window.setTimeout(() => setFlash(null), TONES[flash.tone].durationMs);
    return () => window.clearTimeout(timer);
  }, [flash, lifting]);

  if (!flash) return null;
  const { className, durationMs } = TONES[flash.tone];

  return (
    <div
      // 같은 색이 연달아 와도 다시 덮이게 key로 새로 마운트한다
      key={flash.id}
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-40 ${className} ${
        lifting ? "animate-viewpoint-fade" : "opacity-100"
      }`}
      style={lifting ? { animationDuration: `${durationMs}ms` } : undefined}
    />
  );
}
