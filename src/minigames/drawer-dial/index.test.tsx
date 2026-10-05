/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DRAWER_DIAL_CODE } from "@/data/room-clues";
import type { MinigameResult } from "@/types/minigame";
import { DrawerDialMinigame } from ".";

// 드럼은 Canvas다: 여기서는 판의 DOM만 본다
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/lib/audio", () => ({ playSound: vi.fn() }));

// i18n을 세우지 않은 판이라 t()는 키를 그대로 돌려준다
const copy = {
  open: "minigame.drawerDial.open",
  rejected: "minigame.drawerDial.rejected",
  skip: "minigame.skip",
} as const;

function renderDial() {
  const results: MinigameResult[] = [];
  render(<DrawerDialMinigame onComplete={(result) => results.push(result)} />);
  return results;
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: copy.open }));
}

describe("DrawerDialMinigame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("틀리면 한 줄이 떴다가 사라지고, 판은 끝나지 않는다", () => {
    const results = renderDial();
    expect(screen.queryByText(copy.rejected)).toBeNull();

    open();
    expect(screen.getByText(copy.rejected)).toBeTruthy();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByText(copy.rejected)).toBeNull();
    expect(results).toHaveLength(0);
  });

  it("드럼을 다시 돌리면 그 줄이 바로 걷힌다", () => {
    renderDial();
    open();

    fireEvent.keyDown(window, { code: "ArrowUp" });

    expect(screen.queryByText(copy.rejected)).toBeNull();
  });

  it("몇 번 틀리면 스킵이 열린다. 횟수는 화면에 세지 않는다", () => {
    renderDial();
    const skip = () => screen.queryByRole("button", { name: copy.skip });
    expect(skip()).toBeNull();

    for (let attempt = 0; attempt < 4; attempt += 1) open();

    expect(skip()).toBeTruthy();
    expect(screen.queryByText("4")).toBeNull();
  });

  it("번호를 맞추면 풀린 것으로 보고한다", () => {
    const results = renderDial();
    DRAWER_DIAL_CODE.split("").forEach((digit, index) => {
      for (let turn = 0; turn < Number(digit); turn += 1)
        fireEvent.keyDown(window, { code: "ArrowUp" });
      if (index < DRAWER_DIAL_CODE.length - 1) fireEvent.keyDown(window, { code: "ArrowRight" });
    });

    open();
    act(() => vi.advanceTimersByTime(1000));

    expect(results).toEqual([{ cleared: true }]);
    expect(screen.queryByText(copy.rejected)).toBeNull();
  });
});
