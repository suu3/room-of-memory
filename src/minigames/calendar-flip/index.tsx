"use client";

import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import {
  CALENDAR_YEAR,
  FIRST_MONTH,
  type FlipDirection,
  flipMonth,
  isAftermath,
  isIncidentDay,
  isLastPage,
  LAST_MONTH,
  monthCells,
  START_MONTH,
  survivedDays,
  tallyGroups,
} from "./calendar";

/** 넘기는 애니메이션 길이. globals.css의 page-flip과 맞춘다. */
const FLIP_MS = 320;
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** 사건 이후 장 — 날짜 대신 버틴 날을 세는 正자만 남는다. */
function TallySheet({ days, label }: { days: number; label: string }) {
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
      <p className="text-xs tracking-widest text-ink/45">{label}</p>
    </div>
  );
}

/** 평범했던 달 — 날짜 격자. 사건 당일에만 동그라미가 쳐져 있다. */
function MonthSheet({ month }: { month: number }) {
  const { t } = useTranslation();
  const cells = monthCells(CALENDAR_YEAR, month);

  return (
    <div className="h-64 overflow-hidden">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_KEYS.map((key) => (
          <span
            key={key}
            className="pb-1 text-center text-[0.625rem] font-bold tracking-widest text-ink/40"
          >
            {t(`minigame.calendarFlip.weekday.${key}`)}
          </span>
        ))}
        {cells.map((day, index) =>
          day === null ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: 앞자리 빈칸은 값이 없어 인덱스가 유일한 키다.
            <span key={`blank-${index}`} aria-hidden />
          ) : (
            <span
              key={day}
              className={`grid aspect-square place-items-center text-sm font-bold tabular-nums ${
                isIncidentDay(month, day)
                  ? "rounded-full text-ink ring-2 ring-ember"
                  : "text-ink/70"
              }`}
            >
              {day}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

/**
 * 벽에 걸린 달력을 한 장씩 넘겨본다.
 *
 * 이기고 지는 게임이 아니다 — 앞쪽은 평범한 달력이고, 사건이 있던 달을 지나면
 * 날짜가 사라지고 버틴 날을 세는 正자만 남는다. 마지막 장까지 넘기면 다 본 것으로
 * 친다. 도중에 닫으면 아무 일도 없었던 것처럼 다시 열 수 있다 (방탈출 탐색).
 */
export function CalendarFlipMinigame({ onComplete }: MinigameProps) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(START_MONTH);
  const [flip, setFlip] = useState<{ direction: FlipDirection; key: number } | null>(null);
  const flipTimer = useRef<number | null>(null);
  const doneRef = useRef(false);

  const turn = useCallback((direction: FlipDirection) => {
    setMonth((current) => {
      const next = flipMonth(current, direction);
      if (next === current) return current;
      playSound("flip");
      setFlip({ direction, key: Date.now() });
      return next;
    });
  }, []);

  // 넘김 클래스를 떼어 다음 넘김이 처음부터 재생되게 한다.
  useEffect(() => {
    if (!flip) return;
    flipTimer.current = window.setTimeout(() => setFlip(null), FLIP_MS);
    return () => {
      if (flipTimer.current !== null) window.clearTimeout(flipTimer.current);
    };
  }, [flip]);

  useEffect(
    () => () => {
      if (flipTimer.current !== null) window.clearTimeout(flipTimer.current);
    },
    [],
  );

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

  const aftermath = isAftermath(month);

  return (
    <div className="flex animate-fade-rise flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t("minigame.calendarFlip.prev")}
          onClick={() => turn("prev")}
          disabled={month === FIRST_MONTH}
          className="cursor-pointer rounded-full border border-bone/25 p-2 text-bone/70 transition-all hover:border-bone/60 hover:text-paper disabled:cursor-default disabled:opacity-20"
        >
          <CaretLeft size={22} weight="bold" />
        </button>

        {/* 벽걸이 달력 한 장 */}
        <div className="w-[19rem] max-w-[80vw] [perspective:1600px]">
          {/* 스프링 제본 */}
          <div aria-hidden className="flex justify-center gap-3 pb-1">
            {Array.from({ length: 7 }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 장식용 고리라 구분할 값이 없다.
              <span key={`ring-${index}`} className="h-3 w-1.5 rounded-full bg-bone/50" />
            ))}
          </div>
          <div
            // key를 바꿔 다시 마운트해야 넘길 때마다 애니메이션이 처음부터 돈다
            key={flip?.key ?? month}
            className={`origin-top rounded-md bg-paper p-4 shadow-panel ${
              flip ? `animate-page-flip-${flip.direction}` : ""
            }`}
          >
            <div className="flex items-baseline justify-between border-b border-ink/10 pb-2">
              <p className="text-sm font-bold tracking-widest text-ink/45">{CALENDAR_YEAR}</p>
              <p className="font-pixel text-3xl font-bold text-ink">
                {t("minigame.calendarFlip.month", { value: month })}
              </p>
            </div>
            <div className="pt-3">
              {aftermath ? (
                <TallySheet
                  days={survivedDays(CALENDAR_YEAR, month)}
                  label={t("minigame.calendarFlip.survived", {
                    value: survivedDays(CALENDAR_YEAR, month),
                  })}
                />
              ) : (
                <MonthSheet month={month} />
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label={t("minigame.calendarFlip.next")}
          onClick={() => turn("next")}
          disabled={month === LAST_MONTH}
          className="cursor-pointer rounded-full border border-bone/25 p-2 text-bone/70 transition-all hover:border-bone/60 hover:text-paper disabled:cursor-default disabled:opacity-20"
        >
          <CaretRight size={22} weight="bold" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <p className="text-xs tracking-widest text-bone/50">
          {t("minigame.calendarFlip.pageOf", { value: month, total: LAST_MONTH })}
        </p>
        {isLastPage(month) ? (
          <button
            type="button"
            onClick={() => {
              if (doneRef.current) return;
              doneRef.current = true;
              onComplete({ cleared: true });
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-paper px-5 py-1.5 text-xs font-bold tracking-widest text-ink transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <X size={13} weight="bold" />
            {t("minigame.calendarFlip.close")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
