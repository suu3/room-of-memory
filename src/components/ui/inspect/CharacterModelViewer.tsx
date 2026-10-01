"use client";

import { ArrowClockwiseIcon, ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ViewerPose } from "@/components/canvas/CharacterTurntable";
import { CHIP_BASE, CHIP_IDLE, CHIP_SELECTED, TURN_BUTTON_DARK } from "../shared/ui-classes";
import { TURN_STEP, useTurntableDrag } from "./use-turntable-drag";

/** Canvas는 클라이언트에서만 뜬다 (.claude/rules/r3f.md): 거울을 볼 때 비로소 받는다. */
const CharacterTurntable = dynamic(() => import("@/components/canvas/CharacterTurntable"), {
  ssr: false,
});

const POSES = ["stand", "walk", "sit"] as const satisfies readonly ViewerPose[];

/**
 * 거울 속의 자기: 방의 전신거울을 누르면 뜨는 3D 뷰어 (ClueOverlay의 mirror).
 * 끌어서 돌려보고, 서다·걷다·앉다를 눌러 자세를 바꾼다. 손을 떼고 잠깐 두면 저 혼자 돈다.
 *
 * 수첩 프로필에 붙어 있던 것을 방 안 물건으로 옮겼다. 자기 모습을 보는 자리는 수첩의
 * 종이가 아니라 거울이어야 한다. 그래서 판도 종이가 아니라 어두운 유리다.
 *
 * 각도는 useTurntableDrag의 ref다. 자세만 state로 두는데, 버튼을 누르는 순간에만
 * 바뀌고 그 값이 곧 버튼의 눌림 상태이기 때문이다.
 */
export function CharacterModelViewer() {
  const { t } = useTranslation();
  const [pose, setPose] = useState<ViewerPose>("stand");
  const { yawRef, touchedAtRef, turn, handlers } = useTurntableDrag();

  return (
    <figure className="w-full">
      {/*
        거울 유리. 밤빛 바탕 위에 위에서 드는 옅은 빛을 한 겹 깐다: 그래야 판이 아니라
        비치는 면으로 읽힌다. Canvas는 alpha라 이 바탕이 캐릭터 뒤로 비친다.
      */}
      <div
        role="img"
        aria-label={t("clue.mirror.alt")}
        {...handlers}
        className="mirror-glass h-80 w-full cursor-grab touch-none rounded-lg border border-line active:cursor-grabbing sm:h-[26rem]"
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
            className={TURN_BUTTON_DARK}
          >
            <ArrowCounterClockwiseIcon size={13} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => turn(TURN_STEP)}
            aria-label={t("characterSheet.turnRight")}
            className={TURN_BUTTON_DARK}
          >
            <ArrowClockwiseIcon size={13} weight="bold" />
          </button>
        </div>
        <div className="flex flex-none gap-1">
          {POSES.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={pose === id}
              onClick={() => setPose(id)}
              className={`${CHIP_BASE} px-2.5 py-1 text-xs ${pose === id ? CHIP_SELECTED : CHIP_IDLE}`}
            >
              {t(`characterSheet.pose.${id}` as const)}
            </button>
          ))}
        </div>
        <span className="w-full text-xs text-ash">{t("clue.mirror.hint")}</span>
      </figcaption>
    </figure>
  );
}
