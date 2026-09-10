/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../../i18n/config";
import type { MinigameResult } from "../../types/minigame";
import { bandWidthAt, GOAL_HITS, needlePeriodAt } from "./difficulty";
import { FrequencyTuneMinigame } from "./index";

let now = 0;
let nextFrameId = 1;
let scheduledFrames = new Map<number, FrameRequestCallback>();

/** 다음 프레임을 그 시각으로 돌린다. 바늘 위치는 프레임 타임스탬프만으로 정해진다. */
function runFrameAt(timestamp: number) {
  now = timestamp;
  const next = scheduledFrames.entries().next().value;
  if (!next) throw new Error("Expected a scheduled animation frame");
  const [id, callback] = next;
  scheduledFrames.delete(id);
  act(() => callback(timestamp));
}

function press() {
  act(() => {
    fireEvent.keyDown(window, { code: "Space" });
  });
}

/** 상태 표시 두 칸 = [명중, 놓침]. */
function stats(container: HTMLElement): string[] {
  return [...container.querySelectorAll(".tabular-nums")].slice(0, 2).map((el) => el.textContent);
}

/** 목표 대역은 style에 left·width를 함께 갖는 유일한 요소다. */
function band(container: HTMLElement): HTMLElement {
  const found = container.querySelector<HTMLElement>('[style*="width"]');
  if (!found) throw new Error("Expected the target band");
  return found;
}

function needleLeft(container: HTMLElement): number {
  const found = container.querySelector<HTMLElement>('[class*="rounded-full"][style*="left"]');
  if (!found) throw new Error("Expected the needle");
  return Number.parseFloat(found.style.left);
}

/**
 * Math.random을 0으로 고정하면 대역은 항상 왼쪽 끝(6%)에서 시작한다.
 * 이 위상에서 바늘은 11.47%: 다섯 판의 모든 폭(14 → 8%)이 이 지점을 덮는다.
 */
const IN_BAND_PHASE = 0.64;

describe("FrequencyTuneMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    now = 0;
    nextFrameId = 1;
    scheduledFrames = new Map();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        const id = nextFrameId;
        nextFrameId += 1;
        scheduledFrames.set(id, callback);
        return id;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((id: number) => {
        scheduledFrames.delete(id);
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens on the widest band and the slowest needle", () => {
    const { container } = render(<FrequencyTuneMinigame onComplete={() => {}} />);

    expect(stats(container)).toEqual([`0 / ${GOAL_HITS}`, "0 / 5"]);
    expect(band(container).style.width).toBe(`${bandWidthAt(0)}%`);
    expect(container.querySelectorAll("svg")).toHaveLength(GOAL_HITS);
  });

  it("narrows the band on every hit and clears at five", () => {
    const results: MinigameResult[] = [];
    const { container } = render(
      <FrequencyTuneMinigame onComplete={(result) => results.push(result)} />,
    );

    // 첫 판은 4200ms 주기의 0.64 위상: 그 뒤로는 그때그때의 주기만큼 감아 같은 자리로 돌아온다.
    let timestamp = needlePeriodAt(0) * IN_BAND_PHASE;
    for (let hits = 0; hits < GOAL_HITS; hits++) {
      runFrameAt(timestamp);
      expect(needleLeft(container)).toBeCloseTo(11.47, 1);
      expect(band(container).style.width).toBe(`${bandWidthAt(hits)}%`);
      press();
      expect(stats(container)[0]).toBe(`${hits + 1} / ${GOAL_HITS}`);
      // 주기가 짧아지지 않았다면 다음 프레임의 바늘은 대역 밖으로 벗어난다.
      timestamp += needlePeriodAt(hits + 1);
    }

    expect(results).toEqual([{ cleared: true, score: GOAL_HITS }]);
  });

  it("freezes into a still radio once the result dialogue takes over", () => {
    const results: MinigameResult[] = [];
    const { container, rerender } = render(
      <FrequencyTuneMinigame onComplete={(result) => results.push(result)} />,
    );

    let timestamp = needlePeriodAt(0) * IN_BAND_PHASE;
    for (let hits = 0; hits < GOAL_HITS; hits++) {
      runFrameAt(timestamp);
      press();
      timestamp += needlePeriodAt(hits + 1);
    }
    const lockedAt = needleLeft(container);

    act(() => {
      rerender(
        <FrequencyTuneMinigame onComplete={(result) => results.push(result)} stage="result" />,
      );
    });

    // 판이 멈춘다: 프레임도 더 잡지 않고, 스킵 버튼이 달린 패널도 사라진다.
    expect(scheduledFrames.size).toBe(0);
    expect(container.querySelector("button")).toBeNull();
    // 바늘은 마지막으로 맞춘 자리에 그대로 선다.
    expect(needleLeft(container)).toBeCloseTo(lockedAt, 3);
    // Space는 이제 대사창의 키다. 미니게임이 먹지 않는다.
    press();
    expect(results).toEqual([{ cleared: true, score: GOAL_HITS }]);
  });

  it("counts a miss when the needle is off the band", () => {
    const { container } = render(<FrequencyTuneMinigame onComplete={() => {}} />);

    // 위상 0 = 다이얼 한가운데(50%). 대역은 6~20%라 빗나간다.
    runFrameAt(0);
    press();

    expect(stats(container)).toEqual([`0 / ${GOAL_HITS}`, "1 / 5"]);
  });
});
