"use client";

import { useTranslation } from "react-i18next";
import { NATIONALS_DATE } from "@/data/room-clues";
import {
  CALENDAR_YEAR,
  INCIDENT_DATE,
  isIncidentDay,
  isNationalsDay,
  markedDayOf,
  monthCells,
} from "./calendar";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * 달력 한 장의 날짜 격자.
 *
 * 넘기는 미니게임과 조사를 마친 뒤의 배경 달력(ClueOverlay)이 같은 걸 쓴다.
 * 두 벌로 그리면 표시된 날이 한쪽에만 남는 사고가 난다. 컴퓨터 비밀번호의 숫자가
 * 여기 그어진 금빛 표시 하나뿐이라 특히 그렇다.
 *
 * 표시는 두 가지고 색으로 갈린다. 붉은 것(ember)은 모든 게 끊긴 10월 19일,
 * 금빛(memory)은 전국대회 날: 비밀번호가 되는 그 날이다.
 */
export function MonthGrid({ month }: { month: number }) {
  const { t } = useTranslation();
  const cells = monthCells(CALENDAR_YEAR, month);
  const marked = markedDayOf(month);

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
              className={`grid aspect-square place-items-center text-sm font-bold tabular-nums ${
                isIncidentDay(month, day)
                  ? "rounded-full text-ink ring-2 ring-ember"
                  : isNationalsDay(month, day)
                    ? "rounded-full bg-memory/15 text-ink ring-2 ring-memory"
                    : "text-ink/70"
              }`}
            >
              {day}
            </span>
          ),
        )}
      </div>

      {/* 손으로 적어 둔 메모 한 줄: 동그라미만 있으면 무슨 날인지 알 길이 없다 */}
      {marked ? (
        <p
          className={`mt-2 border-t border-ink/10 pt-2 text-[0.6875rem] tracking-wide ${
            marked === "nationals" ? "text-memory" : "text-ember"
          }`}
        >
          {marked === "nationals"
            ? t("minigame.calendarFlip.mark.nationals", NATIONALS_DATE)
            : t("minigame.calendarFlip.mark.incident", INCIDENT_DATE)}
        </p>
      ) : null}
    </div>
  );
}
