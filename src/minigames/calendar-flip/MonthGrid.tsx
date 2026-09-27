"use client";

import { useTranslation } from "react-i18next";
import { NATIONALS_DATE } from "@/data/room-clues";
import {
  CALENDAR_YEAR,
  hasNote,
  isNationalsDay,
  markedDayOf,
  monthCells,
  notesOf,
} from "./calendar";

/** 월요일부터: 장 그림(mg-calendar-flip-*)과 같은 줄이다. */
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * 달력 한 장의 날짜 격자. 장 그림이 없을 때 대신 서는 장이다.
 *
 * 넘기는 미니게임과 조사를 마친 뒤의 배경 달력(ClueOverlay)이 같은 걸 쓴다.
 * 두 벌로 그리면 표시된 날이 한쪽에만 남는 사고가 난다. 컴퓨터 비밀번호의 숫자가
 * 여기 그어진 금빛 표시 하나뿐이라 특히 그렇다.
 */
export function MonthGrid({ month }: { month: number }) {
  const { t } = useTranslation();
  const cells = monthCells(CALENDAR_YEAR, month);

  return (
    <div className="flex flex-col">
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
              className={`relative grid aspect-square place-items-center text-sm font-bold tabular-nums ${
                isNationalsDay(month, day)
                  ? "rounded-full bg-memory/15 text-ink ring-2 ring-memory"
                  : "text-ink/70"
              }`}
            >
              {day}
              {/* 연필 점: 이 날에 메모가 있다. 무슨 메모인지는 격자 밑에 적힌다 */}
              {hasNote(month, day) && (
                <span
                  aria-hidden
                  className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-ink/55"
                />
              )}
            </span>
          ),
        )}
      </div>
      <MonthNotes month={month} />
    </div>
  );
}

/**
 * 격자 밑에 적힌 메모: 연필 메모(시합·시험·방학)와 금빛 표시의 설명 한 줄.
 *
 * 장 그림 위에서도 같은 걸 쓴다. 칸 안에 글씨를 넣으면 판 크기에서 읽히지 않고
 * 언어도 못 바꾸므로, 칸에는 점·동그라미만 두고 무슨 날인지는 여기 적는다.
 */
export function MonthNotes({ month }: { month: number }) {
  const { t } = useTranslation();
  const marked = markedDayOf(month);
  const notes = notesOf(month);

  return (
    <>
      {/* 평범한 달의 연필 메모: 시합·시험·방학. 이게 있어야 뒤의 正자가 대비된다 */}
      {notes.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-ink/10 pt-2 text-[0.6875rem] tracking-wide text-graphite">
          {notes.map((note) => (
            <li key={note.key} className="flex items-baseline gap-1">
              <span className="tabular-nums text-ink/45">{note.day}</span>
              <span>{t(`minigame.calendarFlip.note.${note.key}`)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* 손으로 적어 둔 메모 한 줄: 동그라미만 있으면 무슨 날인지 알 길이 없다 */}
      {marked ? (
        <p
          className={`mt-2 border-t border-ink/10 pt-2 text-[0.6875rem] tracking-wide text-memory ${
            notes.length > 0 ? "border-t-0 pt-0" : ""
          }`}
        >
          {t("minigame.calendarFlip.mark.nationals", NATIONALS_DATE)}
        </p>
      ) : null}
    </>
  );
}
