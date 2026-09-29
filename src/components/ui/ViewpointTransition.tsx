"use client";

import { type CSSProperties, Fragment, useEffect, useState } from "react";
import { useEffectEnabled } from "@/lib/effects/effect-budget";
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
 * - 엔딩의 문턱(exit)은 짧게 한 번 깜빡이고 흐림이 걷힌다. 문이 열리기 시작하는 박자를
 *   덮개가 먹으면 안 된다. 거기서 나오는 일은 없다: 영상이 방을 덮고, 끝나면 타이틀이다.
 *
 * 불 켜기의 덮개는 순백이 아니다. 캄캄한 방에서 한 프레임에 흰 화면으로 튀면 밝기 차가
 * 가장 큰 전환이라 광과민성에 위험하다. 어둠으로 덮어 두었다가 누런빛으로 물들며 천천히
 * 걷는다: 처음이 가장 느려서 눈이 적응할 틈이 있다 (globals.css의 .viewpoint-lamp).
 *
 * 한 겹이 더 있다: 초점 맞춤(.viewpoint-focus). 불을 켤 때는 덮개가 걷히는 동안 방이
 * 흐릿하게 번졌다가 선명해진다. 불 켠 직후 눈이 빛에 적응하는 몸짓이다. 수첩 평면도로 몸을
 * 옮기는 순간(warp)은 컷이었는데, 같은 흐림이 짧게 덮었다 걷혀 이동을 잇는다. 예전에는
 * 이 자리에 노이즈 타일이 있었지만, 잡음이 방의 톤과 따로 놀아 흐림으로 바꿨다.
 *
 * 그리는 것뿐이다. 카메라를 바꿔 끼우는 일은 FirstPersonRig가 마운트·언마운트로 한다.
 */
/**
 * `blurPx`: 초점 맞춤이 시작하는 흐림 반경. 없으면 흐림 겹이 없다.
 * `lift`: 걷히는 애니메이션. 불 켜기만 어둠에서 누런빛으로 천천히 밝아지는 따로의 곡선이다
 * (한 번에 밝아지면 눈이 아프다: globals.css의 .viewpoint-lamp).
 */
const TONES = {
  enter: {
    className: "bg-scene-void",
    lift: "animate-viewpoint-fade",
    durationMs: 1400,
    blurPx: 0,
  },
  lightsOn: {
    className: "viewpoint-lamp",
    lift: "animate-viewpoint-dawn",
    durationMs: 2800,
    blurPx: 14,
  },
  doorway: { className: "bg-memory", lift: "animate-viewpoint-fade", durationMs: 1000, blurPx: 0 },
  warp: { className: "bg-transparent", lift: "animate-viewpoint-fade", durationMs: 360, blurPx: 8 },
  exit: { className: "bg-scene-void", lift: "animate-viewpoint-fade", durationMs: 600, blurPx: 8 },
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
  // 엔딩을 마치고 타이틀로 돌아가는 길이다. 영상·카드가 이미 방을 덮고 있었다
  if (previous === "exit") return null;
  if (next === "exit") return "exit";
  if (next !== null) return "enter";
  return previous === "intro" ? "lightsOn" : "doorway";
}

export function ViewpointTransition() {
  const [flash, setFlash] = useState<{ id: number; tone: Tone } | null>(null);
  /** 덮개가 걷히기 시작했는가. 프레임이 돌아오고 최소 시간이 지나야 참이 된다. */
  const [lifting, setLifting] = useState(false);
  const focusEnabled = useEffectEnabled("cheap");

  useEffect(
    () =>
      useMemoryRoomStore.subscribe((state, previous) => {
        const tone = transitionTone(selectViewpoint(previous), selectViewpoint(state));
        if (tone !== null) {
          setFlash((current) => ({ id: (current?.id ?? 0) + 1, tone }));
          return;
        }
        // 평면도로 몸을 옮기는 순간: 흐림만 한 겹. 효과가 꺼진 판에서는 예전처럼 컷이다
        if (focusEnabled && state.warpTarget !== null && state.warpTarget !== previous.warpTarget) {
          setFlash((current) => ({ id: (current?.id ?? 0) + 1, tone: "warp" }));
        }
      }),
    [focusEnabled],
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
  const { className, lift, durationMs, blurPx } = TONES[flash.tone];

  return (
    // 같은 색이 연달아 와도 다시 덮이게 key로 새로 마운트한다
    <Fragment key={flash.id}>
      {/*
        초점 맞춤: 흐렸던 방이 선명해진다 (motion-reduce에서는 없다).
        덮개의 자식이 아니라 형제다. opacity가 움직이는 조상 안의 backdrop-filter는 그
        조상 안쪽만 흐리므로(backdrop root) 캔버스까지 닿지 않는다.
      */}
      {blurPx > 0 && focusEnabled && (
        <span
          aria-hidden
          className={`viewpoint-focus pointer-events-none absolute inset-0 z-40 motion-reduce:hidden ${
            lifting ? "animate-viewpoint-focus" : ""
          }`}
          style={
            {
              "--viewpoint-blur": `${blurPx}px`,
              ...(lifting ? { animationDuration: `${Math.round(durationMs * 1.15)}ms` } : {}),
            } as CSSProperties
          }
        />
      )}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-40 ${className} ${
          lifting ? lift : "opacity-100"
        }`}
        style={lifting ? { animationDuration: `${durationMs}ms` } : undefined}
      />
    </Fragment>
  );
}
