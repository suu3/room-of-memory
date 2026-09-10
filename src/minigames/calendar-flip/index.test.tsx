/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import type { MinigameResult } from "@/types/minigame";
import {
  CALENDAR_MONTHS,
  CALENDAR_YEAR,
  INCIDENT_DATE,
  LAST_MONTH,
  START_MONTH,
  survivedDays,
} from "./calendar";

/** 화면 아래 장 번호는 월이 아니라 몇 번째 장인지를 센다 (7월이 1장). */
const pageLabel = (month: number) => `${month - START_MONTH + 1} / ${CALENDAR_MONTHS.length}`;

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
    expect(screen.getByText(pageLabel(START_MONTH))).toBeTruthy();
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
    expect(screen.getByText(pageLabel(LAST_MONTH))).toBeTruthy();
  });
});

describe("the turning sheet", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });
  afterEach(cleanup);
  afterAll(async () => {
    await i18n.changeLanguage("ko");
  });

  it("lays a turning sheet over the page underneath while it flips", () => {
    const { container } = render(<CalendarFlipMinigame onComplete={vi.fn()} />);
    expect(container.querySelectorAll(".animate-calendar-flip")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));

    // 넘어가는 종이 한 장이 밑장 위에 겹친다
    const turning = container.querySelectorAll(".animate-calendar-flip");
    expect(turning).toHaveLength(1);
    // 앞으로 넘길 때는 키프레임을 그대로: 되돌릴 때만 거꾸로 돌린다
    expect(turning[0].className).not.toContain("animation-direction:reverse");
    // 앞면은 떠나는 달, 밑장은 새 달: 두 장이 동시에 서 있어야 넘김이 보인다
    expect(screen.getAllByText(String(CALENDAR_YEAR))).toHaveLength(2);
  });

  it("runs the same keyframes backwards when turning back", () => {
    const { container } = render(<CalendarFlipMinigame onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));

    const turning = container.querySelectorAll(".animate-calendar-flip");
    expect(turning).toHaveLength(1);
    expect(turning[0].className).toContain("animation-direction:reverse");
    // 그늘·그림자도 같이 뒤집혀야 짝이 맞는다
    expect(container.querySelectorAll(".animate-calendar-shade")[0].className).toContain(
      "animation-direction:reverse",
    );
    expect(container.querySelectorAll(".animate-calendar-cast")[0].className).toContain(
      "animation-direction:reverse",
    );
  });
});
