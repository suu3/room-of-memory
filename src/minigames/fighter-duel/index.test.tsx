/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import type { MinigameResult } from "@/types/minigame";
import { MAX_HP } from "./duel";
import { FighterDuelMinigame } from "./index";

/** 판이 도는 시간을 흘려보낸다. rAF도 가짜 시계를 탄다. */
function run(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function hp(label: string): number {
  const meter = screen.getByLabelText(label) as HTMLMeterElement;
  return Number(meter.getAttribute("value"));
}

/**
 * 다가서서 약공격과 잡기를 섞어 낸다.
 *
 * 약공격만 두들기면 상대가 팔을 올려 막고(가드) 아무것도 안 들어간다. 그게 이 게임의
 * 규칙이라, 화면이 규칙대로 물려 있는지 보려면 사람이 실제로 이기는 방식 — 때려서
 * 굳힌 뒤 잡기 — 을 그대로 흉내 내야 한다.
 */
function mixUp(rounds: number) {
  fireEvent.keyDown(window, { code: "ArrowRight" });
  run(900);
  for (let count = 0; count < rounds; count += 1) {
    fireEvent.keyDown(window, { code: count % 2 === 0 ? "KeyJ" : "KeyL" });
    run(500);
  }
  fireEvent.keyUp(window, { code: "ArrowRight" });
}

describe("FighterDuelMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("ko");
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("시작 신호가 먼저 뜬다", () => {
    render(<FighterDuelMinigame onComplete={() => {}} />);
    expect(screen.getByText("FIGHT!")).toBeTruthy();
  });

  it("조작은 화면 안에 있다: 걷기 둘과 기술 셋", () => {
    render(<FighterDuelMinigame onComplete={() => {}} />);
    expect(screen.getByText("물러서기·가드")).toBeTruthy();
    expect(screen.getByText("다가서기")).toBeTruthy();
    expect(screen.getByText("약공격")).toBeTruthy();
    expect(screen.getByText("강공격")).toBeTruthy();
    expect(screen.getByText("잡기")).toBeTruthy();
  });

  it("다가서서 때리고 잡으면 상대 체력이 깎인다", () => {
    render(<FighterDuelMinigame onComplete={() => {}} />);
    run(1000);
    mixUp(14);
    expect(hp("CPU")).toBeLessThan(MAX_HP);
  });

  it("이지 모드에서는 한참 뒤 건너뛸 수 있고, 건너뛰면 통과로 친다", () => {
    const results: MinigameResult[] = [];
    render(<FighterDuelMinigame onComplete={(result) => results.push(result)} />);
    run(31_000);
    const skip = screen.getByRole("button", { name: "건너뛰기" });
    act(() => {
      fireEvent.click(skip);
    });
    expect(results).toEqual([{ cleared: true }]);
  });
});
