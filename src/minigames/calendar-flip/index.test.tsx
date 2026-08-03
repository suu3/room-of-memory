/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import type { MinigameResult } from "@/types/minigame";
import { CALENDAR_YEAR, INCIDENT_DATE, LAST_MONTH, START_MONTH, survivedDays } from "./calendar";
import { CalendarFlipMinigame } from "./index";

function flipForward(times: number) {
  for (let step = 0; step < times; step += 1) {
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  }
}

describe("CalendarFlipMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });
  afterEach(cleanup);
  afterAll(async () => {
    await i18n.changeLanguage("ko");
  });

  it("shows a normal month grid before the incident", () => {
    render(<CalendarFlipMinigame onComplete={vi.fn()} />);
    expect(screen.getByText(String(CALENDAR_YEAR))).toBeTruthy();
    // 날짜 격자가 있다
    expect(screen.getByText("15")).toBeTruthy();
    expect(screen.getByText(`${START_MONTH} / ${LAST_MONTH}`)).toBeTruthy();
  });

  it("drops the grid for tally marks once past the incident month", () => {
    render(<CalendarFlipMinigame onComplete={vi.fn()} />);

    flipForward(INCIDENT_DATE.month - START_MONTH);
    // 사건이 난 달까지는 아직 달력이다
    expect(screen.queryByText(/days survived/)).toBeNull();

    flipForward(1);
    const days = survivedDays(CALENDAR_YEAR, INCIDENT_DATE.month + 1);
    expect(screen.getByText(`${days} days survived`)).toBeTruthy();
    expect(screen.getAllByText("正").length).toBeGreaterThan(0);
  });

  it("only offers to close after the last sheet, and reports it once", () => {
    const onComplete = vi.fn<(result: MinigameResult) => void>();
    render(<CalendarFlipMinigame onComplete={onComplete} />);

    expect(screen.queryByRole("button", { name: /Put the calendar down/ })).toBeNull();

    flipForward(LAST_MONTH - START_MONTH);
    const close = screen.getByRole("button", { name: /Put the calendar down/ });
    fireEvent.click(close);
    fireEvent.click(close);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ cleared: true });
  });

  it("flips with the arrow keys alone", () => {
    render(<CalendarFlipMinigame onComplete={vi.fn()} />);
    for (let step = START_MONTH; step < LAST_MONTH; step += 1) {
      fireEvent.keyDown(window, { code: "ArrowRight" });
    }
    expect(screen.getByText(`${LAST_MONTH} / ${LAST_MONTH}`)).toBeTruthy();
  });
});
