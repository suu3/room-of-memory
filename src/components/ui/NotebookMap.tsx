"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CLUE_SPACE } from "@/data/room-clues";
import { openDoorwayIds, useMemoryRoomStore } from "@/store/memory-room";
import { floorPlan } from "./notebook-map";

/** 벽선 두께 (월드 단위). 문구멍이 이걸 덮는다 (notebook-map의 DOOR_GAP_DEPTH). */
const WALL_STROKE = 0.16;

/** 단서를 본 칸에 남는 연필 체크. 평면도 안팎(범례)에서 같은 그림을 쓴다. */
function ClueCheck({ className = "" }: { className?: string }) {
  return (
    // 장식이다. 옆에 같은 말이 글자로 적혀 있다 (icons.tsx와 같은 규약)
    <svg
      aria-hidden="true"
      role="presentation"
      viewBox="0 0 12 12"
      className={`h-3 w-3 ${className}`}
    >
      <path
        d="M 2 6.4 l 2.4 2.6 l 5 -6"
        fill="none"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-ink/55"
      />
    </svg>
  );
}

/**
 * 수첩의 세 번째 페이지: 집 평면도.
 *
 * 2막부터 공간이 하나씩 열리는 구조라(docs/content-design.md 3-1), 어디까지 열었고 어디를
 * 뒤졌는지를 플레이어가 머리로 들고 있어야 한다. 그 짐을 대신 지는 자리다. 화면 위에 상시
 * 미니맵을 띄우지 않는 이유이기도 하다: 방 넷짜리 집에서 길을 잃진 않는다. 필요한 건 길
 * 안내가 아니라 **뒤진 자리의 기록**이고, 그건 수첩의 일이다.
 *
 * 도현이 직접 그린 평면도라는 설정이라, 아직 못 가본 칸은 아예 비어 있다. 흐리게라도 그려
 * 두면 집의 생김새를 미리 알려주는 셈이고, 문을 여는 일이 "아는 칸 채우기"로 내려앉는다.
 *
 * 표식은 둘이다. 지금 있는 칸은 금빛(게임의 시그니처 앰버)으로 물들고, 단서를 본 칸에는
 * 연필 체크가 남는다. 색과 형태로 갈라 두면 색을 못 가려도 구별된다.
 *
 * 벽은 SVG로, 이름표와 표식은 그 위에 얹은 DOM으로 그린다. 글자까지 SVG에 넣으면 월드
 * 단위로 같이 줄어들어서, 폰 폭에서 방 이름이 7px짜리 얼룩이 된다. 벽만 축척을 따르고
 * 글자는 화면 단위로 남는다. 얹는 자리는 viewBox 안에서의 비율이라 축척이 변해도 따라간다
 * (SVG가 제 비율대로 눕는 한 그림과 어긋나지 않는다: max-height를 걸지 않는 이유다).
 */
export function NotebookMap() {
  const { t } = useTranslation();
  const doorOpened = useMemoryRoomStore((state) => state.doorOpened);
  const openedDoorways = useMemoryRoomStore((state) => state.openedDoorways);
  const space = useMemoryRoomStore((state) => state.space);
  const cluesSeen = useMemoryRoomStore((state) => state.cluesSeen);

  const plan = useMemo(
    () => floorPlan(openDoorwayIds({ doorOpened, openedDoorways })),
    [doorOpened, openedDoorways],
  );
  /** 단서를 하나라도 본 공간. 어느 단서였는지는 안 적는다: 본문은 단서 화면의 것이다. */
  const clued = useMemo(
    () => new Set(cluesSeen.map((id) => CLUE_SPACE[id]).filter((id) => id !== undefined)),
    [cluesSeen],
  );

  const [viewX, viewY, viewWidth, viewHeight] = plan.viewBox.split(" ").map(Number);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative">
        <svg
          viewBox={plan.viewBox}
          role="img"
          aria-label={t("characterSheet.mapAlt")}
          className="block h-auto w-full"
        >
          <title>{t("characterSheet.mapAlt")}</title>
          {plan.rooms.map((room) => (
            <rect
              key={room.id}
              x={room.x}
              y={room.y}
              width={room.width}
              height={room.height}
              rx={0.14}
              strokeWidth={WALL_STROKE}
              className={
                room.id === space ? "fill-memory/25 stroke-memory" : "fill-bone/40 stroke-ink/30"
              }
            />
          ))}
          {/*
            열린 문간. 벽선을 종이색으로 지워 구멍을 낸다. 반드시 칸보다 뒤에 그려야
            위에 얹힌다 (SVG는 나중에 그린 것이 위로 온다).
          */}
          {plan.doors.map((door) => (
            <rect
              key={door.id}
              x={door.x}
              y={door.y}
              width={door.width}
              height={door.height}
              className="fill-paper"
            />
          ))}
        </svg>

        {plan.rooms.map((room) => {
          const here = room.id === space;
          return (
            <div
              key={room.id}
              className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
              style={{
                left: `${((room.center.x - viewX) / viewWidth) * 100}%`,
                top: `${((room.center.y - viewY) / viewHeight) * 100}%`,
              }}
            >
              {here && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-memory" />}
              <span
                className={`whitespace-nowrap text-xs ${here ? "font-medium text-ink" : "text-graphite"}`}
              >
                {t(`space.${room.id}` as const)}
              </span>
              {clued.has(room.id) && <ClueCheck />}
            </div>
          );
        })}
      </div>

      {/* 범례. 평면도가 스스로 설명하지 못하는 두 표식만 적는다 */}
      <ul className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-graphite">
        <li className="inline-flex items-center gap-2">
          <span aria-hidden className="h-3 w-3 rounded-[3px] border border-memory bg-memory/25" />
          {t("characterSheet.mapHere")}
        </li>
        <li className="inline-flex items-center gap-2">
          <ClueCheck />
          {t("characterSheet.mapClue")}
        </li>
      </ul>
      <p className="mt-2 break-ko text-center text-xs text-graphite/80">
        {t("characterSheet.mapHint")}
      </p>
    </div>
  );
}
