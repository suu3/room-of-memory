"use client";

import { ArrowClockwise, ArrowCounterClockwise } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ViewerPose } from "@/components/canvas/CharacterTurntable";
import { TURN_BUTTON_PAPER } from "./ui-classes";
import { TURN_STEP, useTurntableDrag } from "./use-turntable-drag";

/** Canvas는 클라이언트에서만 뜬다 (.claude/rules/r3f.md): 수첩을 열 때 비로소 받는다. */
const CharacterTurntable = dynamic(() => import("@/components/canvas/CharacterTurntable"), {
  ssr: false,
});

const POSES = ["stand", "walk", "sit"] as const satisfies readonly ViewerPose[];

/**
 * 수첩 프로필에 붙는 3D 뷰어. 끌어서 돌려보고, 서다·걷다·앉다를 눌러 자세를 바꾼다. 손을 떼고 잠깐 두면 저 혼자 돈다.
 *
 * 각도는 useTurntableDrag의 ref다. 자세만 state로 두는데, 버튼을 누르는 순간에만
 * 바뀌고 그 값이 곧 버튼의 눌림 상태이기 때문이다.
 */
export function CharacterModelViewer() {
  const { t } = useTranslation();
  const [pose, setPose] = useState<ViewerPose>("stand");
  const { yawRef, touchedAtRef, turn, handlers } = useTurntableDrag();

  return (
    <figure className="mt-8 w-full">
      {/*
        모눈 종이 위에 붙인 표본 칸. 뒤에 깔린 종이가 비쳐야 수첩에 끼운 것으로 읽혀서
        배경을 채우지 않는다 (Canvas도 alpha로 띄운다).
      */}
      <div
        role="img"
        aria-label={t("characterSheet.modelAlt")}
        {...handlers}
        className="h-72 w-full cursor-grab touch-none rounded-lg border border-ink/10 bg-bone/25 active:cursor-grabbing sm:h-96"
      >
        <CharacterTurntable yawRef={yawRef} touchedAtRef={touchedAtRef} pose={pose} />
      </div>
      <figcaption className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* 끄는 건 마우스·손가락의 몫이라, 키보드에는 같은 일을 하는 버튼을 따로 준다 */}
        <div className="flex flex-none gap-1">
          <button
            type="button"
            onClick={() => turn(-TURN_STEP)}
            aria-label={t("characterSheet.turnLeft")}
            className={TURN_BUTTON_PAPER}
          >
            <ArrowCounterClockwise size={13} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => turn(TURN_STEP)}
            aria-label={t("characterSheet.turnRight")}
            className={TURN_BUTTON_PAPER}
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
