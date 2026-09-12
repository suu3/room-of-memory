"use client";

import { ArrowClockwise, ArrowCounterClockwise } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { WorkbookLabels } from "@/components/canvas/WorkbookTurntable";
import { CLUE_DISCOVERY } from "@/data/room-clues";
import { playSound } from "@/lib/audio";
import { selectHeroNameKnown, useMemoryRoomStore } from "@/store/memory-room";
import { PANEL_PAPER, TURN_BUTTON_PAPER } from "./ui-classes";
import { TURN_STEP, useTurntableDrag } from "./use-turntable-drag";

/** Canvas는 클라이언트에서만 뜬다 (.claude/rules/r3f.md): 문제집을 집어 들 때 비로소 받는다. */
const WorkbookTurntable = dynamic(() => import("@/components/canvas/WorkbookTurntable"), {
  ssr: false,
});

/**
 * 책상에서 집어 든 문제집: 돌려봐야 나오는 단서.
 *
 * 다른 단서는 펼치면 다 보이는 종이지만, 이건 물건이다. 앞표지는 흔한 문제집이고
 * 뒤표지에 이름을 적어 뒀다. 뒤집어 본 순간 이름을 알게 되고(store의 discoveries),
 * 수첩의 흐린 이름·나이 칸이 열린다. 다시 집어 들면 이미 안다는 문장이 아래에 남는다.
 */
export function WorkbookClue() {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const known = useMemoryRoomStore(selectHeroNameKnown);
  const discover = useMemoryRoomStore((state) => state.discover);
  const { yawRef, turn, handlers } = useTurntableDrag();

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
        className="h-64 w-full cursor-grab touch-none rounded-md border border-ink/10 bg-bone/25 active:cursor-grabbing sm:h-80"
      >
        <WorkbookTurntable yawRef={yawRef} labels={labels} onBackSeen={onBackSeen} />
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
        </div>
      </div>
      {known ? (
        <p
          role="status"
          className="mt-3 animate-fade-rise break-ko text-pretty border-t border-ink/10 pt-3 text-sm leading-relaxed text-ink"
        >
          {t("clue.workbook.found", { name })}
        </p>
      ) : null}
    </div>
  );
}
