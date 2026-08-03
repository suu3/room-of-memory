/**
 * 달력 장 넘기기의 순수 로직.
 *
 * 이건 이기고 지는 게임이 아니라 읽는 인터랙션이다. 앞쪽은 평범한 달력이고,
 * 사건이 있던 달을 지나면 날짜 격자가 사라지고 생존 일수를 세는 正자만 남는다 —
 * 넘기는 동작 자체가 "일상이 끊긴 지점"을 보여준다.
 */

/** 달력에 적힌 해. 시나리오가 확정되면 그쪽 값과 맞춘다. */
export const CALENDAR_YEAR = 2011;
/** 모든 게 끊긴 날. 이 달까지는 달력이 달력으로 남아 있다. */
export const INCIDENT_DATE = { month: 7, day: 14 } as const;
export const FIRST_MONTH = 1;
export const LAST_MONTH = 12;
export const START_MONTH = 1;
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
