"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/audio";
import { openDoorwayIds, useMemoryRoomStore } from "@/store/memory-room";
import { playHoverSound } from "./hover-sfx";
import { floorPlan } from "./notebook-map";
import { FOCUS_RING } from "./ui-classes";

/** 벽선 두께 (월드 단위). 이 축척에서는 선 하나로만 읽혀야 해서 평면도보다 굵다. */
const WALL_STROKE = 0.3;

/** 지도 폭(px). 햄버거·소리 버튼(2.75em)과 비슷한 덩치로 끝나는 크기다. */
const MAP_WIDTH = 104;

/**
 * 오른쪽 위 버튼 밑에 붙는 작은 평면도. **지금 어디인가**를 한눈에 말하고, 누르면
 * 수첩의 평면도 페이지가 열린다.
 *
 * 여기서 바로 이동시키지 않는 이유는 크기다. 이 폭에서 화장실 칸은 14×11px이라
 * 손가락으로 누를 수 있는 표적이 아니다. 작게 보여주는 일과 눌러서 옮기는 일을
 * 갈라, 표시는 여기가, 이동은 칸이 큰 수첩 페이지가 맡는다 (NotebookMap).
 *
 * 그린 것은 수첩의 평면도와 같은 도형이다 (notebook-map의 floorPlan). 한쪽이 다른
 * 집을 그리면 둘 다 못 믿는다. 다만 이 크기에서는 문구멍이 1px도 안 되므로 칸만 그린다.
 *
 * 방문이 열리기 전에는 뜨지 않는다. 갈 데가 한 곳뿐인 지도는 표시가 아니라 장식이다.
 */
export function HudMiniMap() {
  const { t } = useTranslation();
  const doorOpened = useMemoryRoomStore((state) => state.doorOpened);
  const openedDoorways = useMemoryRoomStore((state) => state.openedDoorways);
  const space = useMemoryRoomStore((state) => state.space);
  const setCharacterSheetOpen = useMemoryRoomStore((state) => state.setCharacterSheetOpen);

  const plan = useMemo(
    () => floorPlan(openDoorwayIds({ doorOpened, openedDoorways })),
    [doorOpened, openedDoorways],
  );

  if (!doorOpened) return null;

  return (
    <button
      type="button"
      aria-label={t("characterSheet.mapOpen")}
      onPointerEnter={playHoverSound}
      onClick={() => {
        playSound("open");
        setCharacterSheetOpen(true, "map");
      }}
      className={`cursor-pointer rounded-sm border border-line bg-surface p-1 transition-colors duration-150 hover:bg-surface-strong active:bg-surface-strong ${FOCUS_RING}`}
      style={{ width: MAP_WIDTH }}
    >
      <svg
        viewBox={plan.viewBox}
        aria-hidden="true"
        role="presentation"
        className="block h-auto w-full"
      >
        {plan.rooms.map((room) => (
          <rect
            key={room.id}
            x={room.x}
            y={room.y}
            width={room.width}
            height={room.height}
            strokeWidth={WALL_STROKE}
            className={
              room.id === space
                ? "fill-memory/30 stroke-memory"
                : "fill-transparent stroke-ivory/55"
            }
          />
        ))}
      </svg>
    </button>
  );
}
