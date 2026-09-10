import { describe, expect, it } from "vitest";
import {
  CALENDAR_MONTHS,
  CALENDAR_YEAR,
  clampMonth,
  daysInMonth,
  FIRST_MONTH,
  firstWeekday,
  flipMonth,
  INCIDENT_DATE,
  isAftermath,
  isIncidentDay,
  isLastPage,
  LAST_MONTH,
  monthCells,
  START_MONTH,
  survivedDays,
  TALLY_PER_MARK,
  tallyGroups,
} from "./calendar";

describe("calendar-flip pages", () => {
  it("counts days per month including leap years", () => {
    expect(daysInMonth(2011, 1)).toBe(31);
    expect(daysInMonth(2011, 2)).toBe(28);
    expect(daysInMonth(2012, 2)).toBe(29);
    expect(daysInMonth(2011, 4)).toBe(30);
  });

  it("lays out a page as leading blanks then every day of the month", () => {
    const cells = monthCells(CALENDAR_YEAR, INCIDENT_DATE.month);
    const lead = firstWeekday(CALENDAR_YEAR, INCIDENT_DATE.month);

    expect(cells).toHaveLength(lead + daysInMonth(CALENDAR_YEAR, INCIDENT_DATE.month));
    expect(cells.slice(0, lead).every((cell) => cell === null)).toBe(true);
    expect(cells[lead]).toBe(1);
    expect(cells.at(-1)).toBe(daysInMonth(CALENDAR_YEAR, INCIDENT_DATE.month));
  });

  it("stops at both ends instead of wrapping around the year", () => {
    expect(flipMonth(FIRST_MONTH, "prev")).toBe(FIRST_MONTH);
    expect(flipMonth(LAST_MONTH, "next")).toBe(LAST_MONTH);
    expect(flipMonth(FIRST_MONTH, "next")).toBe(FIRST_MONTH + 1);
    expect(flipMonth(LAST_MONTH, "prev")).toBe(LAST_MONTH - 1);
    expect(clampMonth(99)).toBe(LAST_MONTH);
    expect(clampMonth(-3)).toBe(FIRST_MONTH);
  });

  it("hangs the summer-to-aftermath run and nothing else", () => {
    expect(CALENDAR_MONTHS).toEqual([7, 8, 9, 10, 11]);
    expect(CALENDAR_MONTHS.at(0)).toBe(FIRST_MONTH);
    expect(CALENDAR_MONTHS.at(-1)).toBe(LAST_MONTH);

    // 사건이 난 달은 걸려 있어야 하고, 그 뒤로 正자 장이 정확히 한 장 따라와야 한다
    expect(CALENDAR_MONTHS).toContain(INCIDENT_DATE.month);
    expect(CALENDAR_MONTHS.filter(isAftermath)).toEqual([INCIDENT_DATE.month + 1]);
  });

  it("keeps the calendar a calendar up to the incident, then only tallies", () => {
    expect(isAftermath(INCIDENT_DATE.month)).toBe(false);
    expect(isAftermath(INCIDENT_DATE.month - 1)).toBe(false);
    expect(isAftermath(INCIDENT_DATE.month + 1)).toBe(true);

    // 사건 전 달에는 셀 날이 없다. 아직 세는 삶이 아니었다
    expect(survivedDays(CALENDAR_YEAR, INCIDENT_DATE.month)).toBe(0);
    expect(survivedDays(CALENDAR_YEAR, INCIDENT_DATE.month + 1)).toBe(
      daysInMonth(CALENDAR_YEAR, INCIDENT_DATE.month + 1),
    );
  });

  it("circles exactly one day of one month", () => {
    expect(isIncidentDay(INCIDENT_DATE.month, INCIDENT_DATE.day)).toBe(true);
    expect(isIncidentDay(INCIDENT_DATE.month, INCIDENT_DATE.day + 1)).toBe(false);
    expect(isIncidentDay(INCIDENT_DATE.month + 1, INCIDENT_DATE.day)).toBe(false);
    expect(isIncidentDay(INCIDENT_DATE.month, null)).toBe(false);
  });

  it("splits survived days into 正 marks with the leftover strokes", () => {
    expect(tallyGroups(0)).toEqual({ full: 0, remainder: 0 });
    expect(tallyGroups(4)).toEqual({ full: 0, remainder: 4 });
    expect(tallyGroups(TALLY_PER_MARK)).toEqual({ full: 1, remainder: 0 });
    expect(tallyGroups(31)).toEqual({ full: 6, remainder: 1 });
    // 남는 획은 절대 한 글자를 채우지 못한다
    for (let days = 0; days < 90; days += 1) {
      expect(tallyGroups(days).remainder).toBeLessThan(TALLY_PER_MARK);
    }
    // 음수·소수가 들어와도 무너지지 않는다
    expect(tallyGroups(-5)).toEqual({ full: 0, remainder: 0 });
  });

  it("treats reaching the last sheet as having seen it all", () => {
    expect(isLastPage(START_MONTH)).toBe(false);
    expect(isLastPage(LAST_MONTH)).toBe(true);
    // 첫 장은 사건보다 앞이어야 한다. 열자마자 결말이면 넘길 이유가 없다
    expect(START_MONTH).toBeLessThan(INCIDENT_DATE.month);
  });

  it("keeps the year in step with the rest of the room", () => {
    // 연도를 바꾸면 요일 격자가 통째로 바뀐다. 장 이미지도 같은 해로 그려져야 하므로
    // 이 값이 흔들리면 그림과 코드가 서로 다른 달력이 된다.
    expect(CALENDAR_YEAR).toBe(2026);
    // 2026-10-19는 월요일(1)
    expect(new Date(CALENDAR_YEAR, INCIDENT_DATE.month - 1, INCIDENT_DATE.day).getDay()).toBe(1);
  });
});
