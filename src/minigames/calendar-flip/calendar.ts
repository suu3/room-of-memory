/**
 * 달력 장 넘기기의 순수 로직.
 *
 * 이건 이기고 지는 게임이 아니라 읽는 인터랙션이다. 앞쪽은 평범한 달력이고,
 * 사건이 있던 달을 지나면 날짜 격자가 사라지고 생존 일수를 세는 正자만 남는다.
 * 넘기는 동작 자체가 "일상이 끊긴 지점"을 보여준다.
 */

import { NATIONALS_DATE } from "@/data/room-clues";

/** 달력에 적힌 해. 요일 격자가 이 값에서 나오므로 장 이미지도 같은 해로 그려야 한다. */
export const CALENDAR_YEAR = 2026;
/**
 * 모든 게 끊긴 날. 이 달까지는 달력이 달력으로 남아 있다.
 * 방 안의 다른 기록도 전부 이 날짜를 가리켜야 한다. 로어(lore.calendar)의 제목,
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
 * 11월은 지우면 안 된다. 날짜가 사라지고 正자만 남는 유일한 장이라,
 * "일상이 끊긴 지점"이 넘김 동작으로 드러나는 자리다 (docs/story/content-design.md 6-1).
 */
export const FIRST_MONTH = 7;
export const LAST_MONTH = 11;
export const START_MONTH = FIRST_MONTH;

/** 전국대회가 있던 달. 조사 뒤의 배경 달력이 처음 펼치는 장이다. */
export const NATIONALS_MONTH = NATIONALS_DATE.month;
/**
 * 날짜 격자가 남아 있는 마지막 달. 그 뒤는 正자 장이라 격자를 못 그린다.
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

/**
 * 평범했던 달에 연필로 적힌 메모. 문구는 i18n(minigame.calendarFlip.note.<key>)에 있다.
 *
 * 7~9월이 빈 달력이면 사건까지 가는 길이 길기만 하고 읽히는 건 없다. 시합·시험·방학이
 * 적힌 석 달이 아무 표시 없는 10월 19일과 11월의 正자를 대비시킨다. 10월의 여행 메모는
 * 가족 단톡·컴퓨터 메일("10월 17일 잘 도착했어")·안방 서류("17일부터 연구소 상주")와 같은 날이다.
 * 전국대회(8월 12일)는 여기 없다. 그날은 금빛 동그라미로 따로 그어진다.
 */
type NoteKey =
  | "finals"
  | "practiceGame"
  | "vacation"
  | "camp"
  | "schoolStart"
  | "mockExam"
  | "birthday"
  | "dday60"
  | "trip";

export interface MonthNote {
  day: number;
  key: NoteKey;
}

export const MONTH_NOTES: Record<number, readonly MonthNote[]> = {
  7: [
    { day: 3, key: "finals" },
    { day: 18, key: "practiceGame" },
    { day: 24, key: "vacation" },
  ],
  8: [
    { day: 3, key: "camp" },
    { day: 24, key: "schoolStart" },
  ],
  9: [
    { day: 4, key: "mockExam" },
    { day: 18, key: "birthday" },
    { day: 20, key: "dday60" },
  ],
  10: [{ day: 17, key: "trip" }],
};

/** 그 달의 메모 (없으면 빈 배열). */
export function notesOf(month: number): readonly MonthNote[] {
  return MONTH_NOTES[month] ?? [];
}

/** 그날에 메모가 있는가: 격자의 점 표시. */
export function hasNote(month: number, day: number | null): boolean {
  return day !== null && notesOf(month).some((note) => note.day === day);
}

export type FlipDirection = "next" | "prev";

export function daysInMonth(year: number, month: number): number {
  // Date의 0일은 전달 마지막 날: 윤년까지 알아서 맞는다.
  return new Date(year, month, 0).getDate();
}

/** 1일이 무슨 요일인지 (0=일요일). */
function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/**
 * 1일 앞의 빈칸 수. 달력은 **월요일부터** 시작한다: 장 그림(mg-calendar-flip-*)이
 * 월요일 시작이라 코드가 그리는 대체 장도 같은 줄에 맞춘다.
 */
export function leadingBlanks(year: number, month: number): number {
  return (firstWeekday(year, month) + 6) % 7;
}

/** 달력 한 장의 칸. 1일 앞의 빈칸은 null이라 그리드에 그대로 흘려 넣을 수 있다. */
export function monthCells(year: number, month: number): (number | null)[] {
  const lead = leadingBlanks(year, month);
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

/** 사건이 난 달 이후인가: 이 달부터는 날짜 격자 대신 正자만 남는다. */
export function isAftermath(month: number): boolean {
  return month > INCIDENT_DATE.month;
}

/**
 * 전국대회 날인가: 달력에서 유일하게 금빛 동그라미가 그어진 날이다.
 *
 * 이 표시가 컴퓨터 비밀번호의 유일한 숫자 출처다 (src/data/room-clues.ts).
 * 10월 19일에는 아무 표시도 없다. 예고 없이 닥친 날이라 미리 동그라미를 칠 수가 없었다.
 */
export function isNationalsDay(month: number, day: number | null): boolean {
  return day !== null && month === NATIONALS_DATE.month && day === NATIONALS_DATE.day;
}

/** 이 달에 표시된 날이 있는가: 격자 밑에 붙는 설명 줄의 조건. */
export function markedDayOf(month: number): "nationals" | null {
  return month === NATIONALS_DATE.month ? "nationals" : null;
}

/**
 * 장 그림(1080×1600)에서 날짜 격자가 놓인 자리. 그림 위에 표시(동그라미·연필 점)를
 * 코드로 얹을 때 쓴다. 그림을 새로 그리면 이 값도 같이 맞춘다.
 */
export const PAGE_IMAGE = {
  width: 1080,
  height: 1600,
  gridLeft: 70,
  gridTop: 426,
  cellWidth: 940 / 7,
  cellHeight: 175,
  /** 칸 위쪽에서 날짜 숫자 한가운데까지. */
  numberOffset: 49,
} as const;

/** 그 날짜 숫자의 한가운데가 그림의 어디인가 (0~1 비율). */
export function dayAnchor(month: number, day: number): { x: number; y: number } {
  const index = leadingBlanks(CALENDAR_YEAR, month) + day - 1;
  const column = index % 7;
  const row = Math.floor(index / 7);
  return {
    x: (PAGE_IMAGE.gridLeft + (column + 0.5) * PAGE_IMAGE.cellWidth) / PAGE_IMAGE.width,
    y:
      (PAGE_IMAGE.gridTop + row * PAGE_IMAGE.cellHeight + PAGE_IMAGE.numberOffset) /
      PAGE_IMAGE.height,
  };
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

/** 마지막 장까지 넘겼는지: 다 봤다는 유일한 조건이다. */
export function isLastPage(month: number): boolean {
  return month >= LAST_MONTH;
}
