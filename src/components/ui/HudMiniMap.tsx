"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/audio";
import { SPACES } from "@/scenes/memory-room/spaces";
import {
  openDoorwayIds,
  selectSceneInputLocked,
  selectViewpoint,
  useMemoryRoomStore,
} from "@/store/memory-room";
import { playHoverSound } from "./hover-sfx";
import { floorPlan } from "./notebook-map";
import { FOCUS_RING } from "./ui-classes";

/** 벽선 두께 (월드 단위). 이 축척에서는 선 하나로만 읽혀야 해서 평면도보다 굵다. */
const WALL_STROKE = 0.3;

/** 지도 폭(px). 햄버거·소리 버튼(2.75em)과 비슷한 덩치로 끝나는 크기다. */
const MAP_WIDTH = 104;

/**
 * 오른쪽 위 버튼 밑에 붙는 작은 평면도 겸 **이동 버튼**.
 *
 * 길 안내가 아니다. 방 넷짜리 집에서 길을 잃진 않는다. 이건 걷는 수고를 덜어내는
 * 조작이다: 2막부터 이쪽 공간의 단서가 저쪽 공간의 문을 여는 구조라
 * (docs/content-design.md 3-1) 공간을 오가는 일이 잦은데, 그때마다 집을 가로질러 걷는
 * 건 이야기가 아니라 심부름이다. 왕복은 남기고 걷는 시간만 덜어낸다.
 *
 * 그린 것은 수첩의 평면도와 같은 도형이다 (notebook-map의 floorPlan). 한쪽이 다른
 * 집을 그리면 둘 다 못 믿는다. 다만 이 크기에서는 문구멍이 1px도 안 되므로 칸만 그린다.
 *
 * 방문이 열리기 전에는 뜨지 않는다. 갈 데가 한 곳뿐인 지도는 버튼이 아니라 장식이다.
 */
export function HudMiniMap() {
  const { t } = useTranslation();
  const doorOpened = useMemoryRoomStore((state) => state.doorOpened);
  const openedDoorways = useMemoryRoomStore((state) => state.openedDoorways);
  const space = useMemoryRoomStore((state) => state.space);
  const warpPlayer = useMemoryRoomStore((state) => state.warpPlayer);
  /* 대사·미니게임·단서가 떠 있거나 1인칭이면 몸을 옮기지 않는다. 장면이 도는 중이다 */
  const locked = useMemoryRoomStore(selectSceneInputLocked);
  const firstPerson = useMemoryRoomStore(selectViewpoint) !== null;

  const plan = useMemo(
    () => floorPlan(openDoorwayIds({ doorOpened, openedDoorways })),
    [doorOpened, openedDoorways],
  );

  if (!doorOpened) return null;

  const [viewX, viewY, viewWidth, viewHeight] = plan.viewBox.split(" ").map(Number);

  return (
    <nav
      aria-label={t("hud.travel")}
      className="rounded-sm border border-line bg-surface p-1"
      style={{ width: MAP_WIDTH }}
    >
      {/*
        안쪽에 자리 기준을 하나 더 세운다. 절대 배치는 조상의 **패딩 상자**를 기준으로
        재기 때문에, 패딩을 준 nav에 바로 얹으면 버튼이 그림에서 패딩만큼 어긋난다.
      */}
      <div className="relative">
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

        {/*
        칸마다 진짜 버튼을 겹친다. SVG 도형에 tabindex를 매다는 것보다 이쪽이 키보드와
        스크린리더에 정직하다. 자리는 viewBox 안에서의 비율이라 축척이 변해도 따라간다.
      */}
        {plan.rooms.map((room) => {
          const here = room.id === space;
          return (
            <button
              key={room.id}
              type="button"
              disabled={here || locked || firstPerson}
              aria-current={here ? "true" : undefined}
              aria-label={t(`space.${room.id}` as const)}
              onPointerEnter={here ? undefined : playHoverSound}
              onClick={() => {
                playSound("open");
                const { x, z } = SPACES[room.id].landing;
                warpPlayer(x, z);
              }}
              className={`absolute rounded-[1px] transition-colors duration-150 disabled:cursor-default ${
                here ? "" : "cursor-pointer hover:bg-ivory/15 active:bg-ivory/25"
              } ${FOCUS_RING}`}
              style={{
                left: `${((room.x - viewX) / viewWidth) * 100}%`,
                top: `${((room.y - viewY) / viewHeight) * 100}%`,
                width: `${(room.width / viewWidth) * 100}%`,
                height: `${(room.height / viewHeight) * 100}%`,
              }}
            />
          );
        })}
      </div>
    </nav>
  );
}
