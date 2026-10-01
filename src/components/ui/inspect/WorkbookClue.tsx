"use client";

import { type MutableRefObject, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { InspectCapture } from "@/components/canvas/InspectTurntable";
import { workbookObject } from "@/components/canvas/inspect-objects";
import { CLUE_DISCOVERY } from "@/data/room-clues";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { InspectView } from "./InspectView";

/**
 * 책상에서 집어 든 문제집: 돌려봐야 나오는 단서 (3D 인스펙트의 첫 물건).
 *
 * 앞표지는 흔한 문제집이고 뒤표지에 이름을 적어 뒀다. 뒤집어 본 순간 이름을 알게 되고
 * (store의 discoveries), 수첩의 흐린 이름·나이 칸이 열린다. 화면에는 아무 말도 안
 * 적는다: 이름표를 읽은 건 눈이고, 그걸 알게 됐다는 건 수첩이 말한다.
 */
export function WorkbookClue({
  captureRef,
}: {
  /** 내려놓는 순간 판을 찍는 손잡이 (ClueOverlay가 닫을 때 부른다). */
  captureRef?: MutableRefObject<InspectCapture | null>;
}) {
  const { t } = useTranslation();
  const { t: tRoom } = useTranslation("memoryRoom");
  const discover = useMemoryRoomStore((state) => state.discover);
  const name = tRoom("characters.hero.name");
  const object = useMemo(
    () =>
      workbookObject({
        name,
        tagLabel: t("clue.workbook.tagLabel"),
        tagGrade: t("clue.workbook.tagGrade"),
      }),
    [name, t],
  );

  const onFound = useCallback(() => {
    if (useMemoryRoomStore.getState().discoveries.includes(CLUE_DISCOVERY.workbook)) return;
    playSound("flip", { variation: 0.05 });
    discover(CLUE_DISCOVERY.workbook);
  }, [discover]);

  return (
    <InspectView
      object={object}
      alt={t("clue.workbook.alt")}
      hint={t("clue.workbook.hint")}
      onFound={onFound}
      captureRef={captureRef}
    />
  );
}
