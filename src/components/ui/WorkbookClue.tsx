"use client";

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { type WheelEvent as ReactWheelEvent, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { type WorkbookLabels, ZOOM_MAX, ZOOM_MIN } from "@/components/canvas/WorkbookTurntable";
import { CLUE_DISCOVERY } from "@/data/room-clues";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { PANEL_PAPER, TURN_BUTTON_PAPER } from "./ui-classes";
import { TURN_STEP, useTurntableDrag } from "./use-turntable-drag";

/** Canvas는 클라이언트에서만 뜬다 (.claude/rules/r3f.md): 문제집을 집어 들 때 비로소 받는다. */
const WorkbookTurntable = dynamic(() => import("@/components/canvas/WorkbookTurntable"), {
  ssr: false,
});

/** 휠 한 칸(deltaY 100)에 곱해지는 배율. 다섯 칸쯤 굴리면 끝까지 간다. */
const WHEEL_ZOOM_RATE = 0.0018;
/** 버튼 한 번에 곱해지는 배율. */
const ZOOM_STEP = 1.35;

/**
 * 책상에서 집어 든 문제집: 돌려봐야 나오는 단서.
 *
 * 다른 단서는 펼치면 다 보이는 종이지만, 이건 물건이다. 앞표지는 흔한 문제집이고
 * 뒤표지에 이름을 적어 뒀다. 뒤집어 본 순간 이름을 알게 되고(store의 discoveries),
 * 수첩의 흐린 이름·나이 칸이 열린다. 화면에는 아무 말도 안 적는다: 이름표를 읽은 건
 * 눈이고, 그걸 알게 됐다는 건 수첩이 말한다.
 *
 * 글씨가 작아서 확대가 있다. 휠이나 버튼으로 당기고, 당긴 뒤에는 세로로 끌어 옮긴다.
 */
export function WorkbookClue() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const discover = useMemoryRoomStore((state) => state.discover);
  const { yawRef, dragYRef, turn, handlers } = useTurntableDrag();
  const zoomRef = useRef(ZOOM_MIN);

  const zoomBy = useCallback((factor: number) => {
    zoomRef.current = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomRef.current * factor));
  }, []);

  const onWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      // 위로 굴리면(deltaY 음수) 당겨진다. 지도와 같은 방향
      zoomBy(Math.exp(-event.deltaY * WHEEL_ZOOM_RATE));
    },
    [zoomBy],
  );

  const name = tRoom("characters.hero.name");
  const labels = useMemo<WorkbookLabels>(
    () => ({ name, tagLabel: t("clue.workbook.tagLabel"), tagGrade: t("clue.workbook.tagGrade") }),
    [name, t],
  );

  const onBackSeen = useCallback(() => {
    if (useMemoryRoomStore.getState().discoveries.includes(CLUE_DISCOVERY.workbook)) return;
    playSound("flip", { variation: 0.05 });
    discover(CLUE_DISCOVERY.workbook);
  }, [discover]);

  return (
    <div className={`p-4 sm:p-5 ${PANEL_PAPER}`}>
      <div
        role="img"
        aria-label={t("clue.workbook.alt")}
        {...handlers}
        onWheel={onWheel}
        className="h-64 w-full cursor-grab touch-none overscroll-contain rounded-md border border-ink/10 bg-bone/25 active:cursor-grabbing sm:h-80"
      >
        <WorkbookTurntable
          yawRef={yawRef}
          zoomRef={zoomRef}
          dragYRef={dragYRef}
          labels={labels}
          onBackSeen={onBackSeen}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-graphite">{t("clue.workbook.hint")}</span>
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
          <span aria-hidden className="mx-1 w-px self-stretch bg-ink/10" />
          <button
            type="button"
            onClick={() => zoomBy(1 / ZOOM_STEP)}
            aria-label={t("clue.workbook.zoomOut")}
            className={TURN_BUTTON_PAPER}
          >
            <MagnifyingGlassMinus size={13} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(ZOOM_STEP)}
            aria-label={t("clue.workbook.zoomIn")}
            className={TURN_BUTTON_PAPER}
          >
            <MagnifyingGlassPlus size={13} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}
