"use client";

import { CaretLeftIcon, CaretRightIcon, CheckIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import {
  CALENDAR_MONTHS,
  CALENDAR_YEAR,
  FIRST_MONTH,
  type FlipDirection,
  flipMonth,
  isAftermath,
  isLastPage,
  LAST_MONTH,
  START_MONTH,
  survivedDays,
  tallyGroups,
} from "./calendar";
import { MonthGrid } from "./MonthGrid";
import { CalendarPageImage, preloadCalendarPages, useCalendarPage } from "./PageImage";

/** 장이 바뀌며 옅어지는 길이. globals.css의 --animate-calendar-fade와 맞춘다. */
const FADE_MS = 320;

/** 사건 이후 장: 날짜 대신 버틴 날을 세는 正자만 남는다. */
function TallySheet({ days }: { days: number }) {
  const { full, remainder } = tallyGroups(days);
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-4">
      <div className="flex max-w-[16rem] flex-wrap items-center justify-center gap-x-2 gap-y-1">
        {Array.from({ length: full }, (_, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 같은 글자의 반복이라 인덱스 말고 구분할 값이 없다.
            key={`mark-${index}`}
            className="font-pixel text-2xl leading-none text-ink/80"
          >
            正
          </span>
        ))}
        {remainder > 0 ? (
          <span className="flex items-end gap-[3px]" aria-hidden>
            {Array.from({ length: remainder }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 획 하나하나에 이름이 없다.
              <span key={`stroke-${index}`} className="h-5 w-[2px] bg-ink/70" />
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** 평범했던 달: 날짜 격자. 표시된 날은 MonthGrid가 그린다. */
function MonthSheet({ month }: { month: number }) {
  return (
    <div className="h-64 overflow-hidden">
      <MonthGrid month={month} />
    </div>
  );
}

/** 장 그림이 없을 때 코드가 그리는 내용: 격자, 사건 뒤로는 正자. */
function PageContent({ month }: { month: number }) {
  return isAftermath(month) ? (
    <TallySheet days={survivedDays(CALENDAR_YEAR, month)} />
  ) : (
    <MonthSheet month={month} />
  );
}

/**
 * 달력 한 장. 떠나는 장과 새 장이 같은 걸 쓴다.
 *
 * 장 그림이 받아졌으면 그림이 곧 그 장이다 (해·월도 그림에 적혀 있어 머리글을 따로 안 단다).
 * 없으면 코드가 그리는 머리글과 격자·正자 장이 그대로 선다.
 */
function CalendarSheet({ month }: { month: number }) {
  const { t } = useTranslation();
  const page = useCalendarPage(month);

  if (page) {
    return (
      <div className="h-full rounded-md bg-paper p-2 shadow-panel">
        <CalendarPageImage month={month} source={page} />
      </div>
    );
  }

  return (
    <div className="h-full rounded-md bg-paper p-4 shadow-panel">
      <div className="flex items-baseline justify-between border-b border-ink/10 pb-2">
        <p className="text-sm font-bold tracking-widest text-ink/45">{CALENDAR_YEAR}</p>
        <p className="font-pixel text-3xl font-bold text-ink">
          {t("minigame.calendarFlip.month", { value: month })}
        </p>
      </div>
      <div className="pt-3">
        <PageContent month={month} />
      </div>
    </div>
  );
}

interface Leaving {
  /** 옅어지며 사라지는 장의 달. 새 장은 그 밑에 이미 서 있다. */
  month: number;
  key: number;
}

/**
 * 달력 판의 폭. 화면 높이에 맞춰 최대한 크게 잡되, 좌우 화살표 자리와 아래 장 번호 줄,
 * 호스트가 뒤에 까는 패널의 안쪽 여백(사방 1.5rem)은 남긴다. 그림 비율(1080×1600)이라
 * 높이 기준 폭은 높이의 0.675배다.
 */
const SHEET_WIDTH = "min(calc(100vw - 11rem), calc((100dvh - 10rem) * 0.675), 36rem)";

/**
 * 벽에 걸린 달력을 한 장씩 넘겨본다.
 *
 * 이기고 지는 게임이 아니다. 앞쪽은 평범한 달력이고, 사건이 있던 달을 지나면
 * 날짜 위에 버틴 날을 세는 正자가 덮인다. 마지막 장까지 넘기면 다 본 것으로
 * 친다. 도중에 닫으면 아무 일도 없었던 것처럼 다시 열 수 있다 (방탈출 탐색).
 *
 * 장이 바뀔 때는 떠나는 장이 새 장 위에서 옅어진다. 예전의 3D 넘김(스프링 축으로
 * 젖혀지는 종이)은 그림이 크게 들어오면서 화면을 너무 많이 흔들어 걷어 냈다.
 */
export function CalendarFlipMinigame({ onComplete }: MinigameProps) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(START_MONTH);
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const doneRef = useRef(false);

  /*
   * 바꿀 때마다 올라가는 번호. 떠나는 장의 key로 써서 매번 새로 마운트시킨다.
   * 달을 key로 삼으면 7→8→7처럼 같은 장이 연달아 떠날 때 애니메이션이 처음부터
   * 다시 돌지 않는다.
   */
  const leaveSeq = useRef(0);

  // 다음 장이 들어오는 순간 대체 장을 한 번 거쳐 튀지 않게, 열릴 때 다섯 장을 다 받아 둔다
  useEffect(() => {
    preloadCalendarPages();
  }, []);

  const turn = useCallback(
    (direction: FlipDirection) => {
      const next = flipMonth(month, direction);
      if (next === month) return;

      playSound("flip", { variation: 0.05 });
      leaveSeq.current += 1;
      setLeaving({ month, key: leaveSeq.current });
      setMonth(next);
    },
    [month],
  );

  // 다 옅어지면 떠난 장을 걷어낸다
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(null), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        turn("prev");
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        turn("next");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  return (
    <div className="flex animate-fade-rise flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t("minigame.calendarFlip.prev")}
          onClick={() => turn("prev")}
          disabled={month === FIRST_MONTH}
          className="cursor-pointer rounded-full border border-bone/25 p-2 text-bone/70 transition-all hover:border-bone/60 hover:text-paper disabled:cursor-default disabled:opacity-20"
        >
          <CaretLeftIcon size={22} weight="bold" />
        </button>

        {/*
          벽걸이 달력 한 장. 새 장은 흐름을 따라가는 보통 요소라 높이를 정하고,
          떠나는 장만 그 위에 절대배치로 겹친다. 그래야 판 높이가 바뀔 때마다 흔들리지 않는다.
        */}
        <div className="relative" style={{ width: SHEET_WIDTH }}>
          <CalendarSheet month={month} />
          {leaving && (
            <div
              key={`leaving-${leaving.key}`}
              aria-hidden
              className="animate-calendar-fade pointer-events-none absolute inset-0"
            >
              <CalendarSheet month={leaving.month} />
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label={t("minigame.calendarFlip.next")}
          onClick={() => turn("next")}
          disabled={month === LAST_MONTH}
          className="cursor-pointer rounded-full border border-bone/25 p-2 text-bone/70 transition-all hover:border-bone/60 hover:text-paper disabled:cursor-default disabled:opacity-20"
        >
          <CaretRightIcon size={22} weight="bold" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <p className="text-xs tracking-widest text-bone/50">
          {t("minigame.calendarFlip.pageOf", {
            value: month - FIRST_MONTH + 1,
            total: CALENDAR_MONTHS.length,
          })}
        </p>
        {isLastPage(month) ? (
          <button
            type="button"
            onClick={() => {
              if (doneRef.current) return;
              doneRef.current = true;
              onComplete({ cleared: true });
            }}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-paper px-5 py-1.5 text-xs font-bold tracking-widest text-ink transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <CheckIcon size={14} weight="bold" />
            {t("minigame.calendarFlip.close")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
