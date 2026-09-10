"use client";

import { ArrowClockwise, ArrowCounterClockwise } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ViewerPose } from "@/components/canvas/CharacterTurntable";

/** Canvas는 클라이언트에서만 뜬다 (.claude/rules/r3f.md): 수첩을 열 때 비로소 받는다. */
const CharacterTurntable = dynamic(() => import("@/components/canvas/CharacterTurntable"), {
  ssr: false,
});

const POSES = ["stand", "walk", "sit"] as const satisfies readonly ViewerPose[];

/** 화면 가로폭 대비 회전량: 창 하나를 가로지르면 한 바퀴 조금 넘게 돈다. */
const DRAG_TO_RADIANS = 0.011;
/** 버튼 한 번에 도는 각. 15°씩이면 마우스 없이도 뒤통수까지 열두 번이면 닿는다. */
const KEY_STEP = Math.PI / 12;

const TURN_BUTTON =
  "cursor-pointer rounded-sm border border-ink/10 bg-bone/40 p-1.5 text-graphite transition-colors hover:text-ink active:bg-bone/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory";

/**
 * 수첩 프로필에 붙는 3D 뷰어. 끌어서 돌려보고, 서다·걷다·앉다를 눌러 자세를 바꾼다. 손을 떼고 잠깐 두면 저 혼자 돈다.
 *
 * 각도는 state가 아니라 ref다. 드래그마다 리렌더되면 Canvas가 통째로 다시 그려진다
 * (.claude/rules/r3f.md의 "useFrame에서 setState 금지"와 같은 이유). 자세만 state로 두는데,
 * 버튼을 누르는 순간에만 바뀌고 그 값이 곧 버튼의 눌림 상태이기 때문이다.
 */
export function CharacterModelViewer() {
  const { t } = useTranslation();
  const [pose, setPose] = useState<ViewerPose>("stand");
  const yawRef = useRef(0);
  const touchedAtRef = useRef(0);
  const dragRef = useRef<{ pointerId: number; x: number; from: number } | null>(null);

  const turn = useCallback((delta: number) => {
    yawRef.current += delta;
    touchedAtRef.current = Date.now();
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, from: yawRef.current };
    touchedAtRef.current = Date.now();
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    yawRef.current = drag.from + (event.clientX - drag.x) * DRAG_TO_RADIANS;
    touchedAtRef.current = Date.now();
  }, []);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    touchedAtRef.current = Date.now();
  }, []);

  return (
    <figure className="mt-8 w-full">
      {/*
        모눈 종이 위에 붙인 표본 칸. 뒤에 깔린 종이가 비쳐야 수첩에 끼운 것으로 읽혀서
        배경을 채우지 않는다 (Canvas도 alpha로 띄운다).
      */}
      <div
        role="img"
        aria-label={t("characterSheet.modelAlt")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="h-72 w-full cursor-grab touch-none rounded-lg border border-ink/10 bg-bone/25 active:cursor-grabbing sm:h-96"
      >
        <CharacterTurntable yawRef={yawRef} touchedAtRef={touchedAtRef} pose={pose} />
      </div>
      <figcaption className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* 끄는 건 마우스·손가락의 몫이라, 키보드에는 같은 일을 하는 버튼을 따로 준다 */}
        <div className="flex flex-none gap-1">
          <button
            type="button"
            onClick={() => turn(-KEY_STEP)}
            aria-label={t("characterSheet.turnLeft")}
            className={TURN_BUTTON}
          >
            <ArrowCounterClockwise size={13} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => turn(KEY_STEP)}
            aria-label={t("characterSheet.turnRight")}
            className={TURN_BUTTON}
          >
            <ArrowClockwise size={13} weight="bold" />
          </button>
        </div>
        <div className="flex flex-none gap-1">
          {POSES.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={pose === id}
              onClick={() => setPose(id)}
              className={`cursor-pointer rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory ${
                pose === id
                  ? "border-ink/40 bg-ink/10 text-ink"
                  : "border-ink/10 bg-bone/40 text-graphite hover:text-ink active:bg-bone/70"
              }`}
            >
              {t(`characterSheet.pose.${id}` as const)}
            </button>
          ))}
        </div>
        <span className="w-full text-xs text-graphite">{t("characterSheet.modelHint")}</span>
      </figcaption>
    </figure>
  );
}
