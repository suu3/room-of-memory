/**
 * 달력 장 넘기기의 순수 로직.
 *
 * 이건 이기고 지는 게임이 아니라 읽는 인터랙션이다. 앞쪽은 평범한 달력이고,
 * 사건이 있던 달을 지나면 날짜 격자가 사라지고 생존 일수를 세는 正자만 남는다 —
 * 넘기는 동작 자체가 "일상이 끊긴 지점"을 보여준다.
 */

import { NATIONALS_DATE } from "@/data/room-clues";

/** 달력에 적힌 해. 요일 격자가 이 값에서 나오므로 장 이미지도 같은 해로 그려야 한다. */
export const CALENDAR_YEAR = 2026;
/**
 * 모든 게 끊긴 날. 이 달까지는 달력이 달력으로 남아 있다.
 * 방 안의 다른 기록도 전부 이 날짜를 가리켜야 한다 — 로어(lore.calendar)의 제목,
 * 폰 단톡방 화면의 날짜(minigame.phoneChat.date).
 */
export const INCIDENT_DATE = { month: 10, day: 19 } as const;
/*
 * 걸려 있는 장은 7월부터 11월까지 다섯 장이다.
 *
 * 한 해를 통째로 넘기게 두면 앞의 여섯 장이 전부 "아무 일도 없는 달"이라, 사건까지
 * 가는 길이 길기만 하고 읽히는 건 없다. 여름에서 시작해 10월에 끊기고 11월 한 장이
 * 그 뒤를 보여주는 다섯 장이면 흐름이 다 담긴다.
 *
 * 11월은 지우면 안 된다 — 날짜가 사라지고 正자만 남는 유일한 장이라,
 * "일상이 끊긴 지점"이 넘김 동작으로 드러나는 자리다 (docs/content-design.md).
 */
export const FIRST_MONTH = 7;
export const LAST_MONTH = 11;
export const START_MONTH = FIRST_MONTH;

/** 전국대회가 있던 달. 조사 뒤의 배경 달력이 처음 펼치는 장이다. */
export const NATIONALS_MONTH = NATIONALS_DATE.month;
/**
 * 날짜 격자가 남아 있는 마지막 달. 그 뒤는 正자 장이라 격자를 못 그린다 —
 * 배경 달력(ClueOverlay)은 여기까지만 오간다.
 */
export const LAST_DATED_MONTH = INCIDENT_DATE.month;

/** 걸려 있는 장 전부, 앞에서 뒤로. */
export const CALENDAR_MONTHS: readonly number[] = Array.from(
  { length: LAST_MONTH - FIRST_MONTH + 1 },
  (_, index) => FIRST_MONTH + index,
);
/** 正 한 글자가 세는 날 수. */
export const TALLY_PER_MARK = 5;

export type FlipDirection = "next" | "prev";

export function daysInMonth(year: number, month: number): number {
  // Date의 0일은 전달 마지막 날 — 윤년까지 알아서 맞는다.
  return new Date(year, month, 0).getDate();
}

/** 1일이 무슨 요일인지 (0=일요일). */
export function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/** 달력 한 장의 칸. 1일 앞의 빈칸은 null이라 그리드에 그대로 흘려 넣을 수 있다. */
export function monthCells(year: number, month: number): (number | null)[] {
  const lead = firstWeekday(year, month);
  const total = daysInMonth(year, month);
  const cells: (number | null)[] = new Array(lead).fill(null);
  for (let day = 1; day <= total; day += 1) cells.push(day);
  return cells;
}

export function clampMonth(month: number): number {
  return Math.min(LAST_MONTH, Math.max(FIRST_MONTH, month));
}

/** 넘긴 결과 달. 양 끝에서는 더 안 넘어간다 (끊긴 느낌 대신 멈춘 느낌). */
export function flipMonth(month: number, direction: FlipDirection): number {
  return clampMonth(month + (direction === "next" ? 1 : -1));
}

/** 사건이 난 달 이후인가 — 이 달부터는 날짜 격자 대신 正자만 남는다. */
export function isAftermath(month: number): boolean {
  return month > INCIDENT_DATE.month;
}

export function isIncidentDay(month: number, day: number | null): boolean {
  return day !== null && month === INCIDENT_DATE.month && day === INCIDENT_DATE.day;
}

/**
 * 전국대회 날인가 — 사건 표시(붉은 동그라미)와 달리 금빛으로 그어진 날이다.
 *
 * 이 표시가 컴퓨터 비밀번호의 유일한 숫자 출처다 (src/data/room-clues.ts).
 * 사건 표시와 색을 갈라 두는 게 중요하다: 같은 색이면 10월 19일과 뒤섞여
 * "표시된 날"이 둘 중 어느 쪽인지 알 수 없다.
 */
export function isNationalsDay(month: number, day: number | null): boolean {
  return day !== null && month === NATIONALS_DATE.month && day === NATIONALS_DATE.day;
}

/** 이 달에 표시된 날이 있는가 — 격자 밑에 붙는 설명 줄의 조건. */
export function markedDayOf(month: number): "incident" | "nationals" | null {
  if (month === INCIDENT_DATE.month) return "incident";
  if (month === NATIONALS_DATE.month) return "nationals";
  return null;
}

/** 사건 이후의 달은 날짜가 아니라 버틴 날 수로 센다. */
export function survivedDays(year: number, month: number): number {
  if (!isAftermath(month)) return 0;
  return daysInMonth(year, month);
}

export interface TallyGroups {
  /** 완성된 正자 개수. */
  full: number;
  /** 아직 正이 못 된 남은 획 (0~4). */
  remainder: number;
}

/** 생존 일수를 正자 묶음으로 쪼갠다. */
export function tallyGroups(days: number): TallyGroups {
  const safe = Math.max(0, Math.floor(days));
  return { full: Math.floor(safe / TALLY_PER_MARK), remainder: safe % TALLY_PER_MARK };
}

/** 마지막 장까지 넘겼는지 — 다 봤다는 유일한 조건이다. */
export function isLastPage(month: number): boolean {
  return month >= LAST_MONTH;
}
