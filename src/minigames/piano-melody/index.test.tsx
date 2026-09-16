/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { PianoMelodyMinigame } from "./index";
import { MELODY, SOLFEGE } from "./melody";

/** 건반 일곱. 화면에 선 순서가 계이름 순서다. */
function keys() {
  return screen.getAllByRole("button").filter((button) => button.textContent?.match(/[1-7]$/));
}

function press(note: (typeof SOLFEGE)[number]) {
  fireEvent.click(keys()[SOLFEGE.indexOf(note)]);
}

describe("PianoMelodyMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("ko");
  });

  afterEach(cleanup);

  afterAll(() => {
    vi.useRealTimers();
  });

  it("건반 일곱이 계이름 순서로 선다", () => {
    render(<PianoMelodyMinigame onComplete={() => {}} />);
    expect(keys()).toHaveLength(SOLFEGE.length);
  });

  it("악보대로 다 치면 풀린 것으로 보고한다", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const onSettled = vi.fn();
    render(<PianoMelodyMinigame onComplete={onComplete} onSettled={onSettled} />);

    for (const note of MELODY) press(note);

    // 마지막 음이 울리는 동안은 화면이 남는다. 결과는 그 뒤에 나간다
    expect(onSettled).toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ cleared: true }));
    vi.useRealTimers();
  });

  it("한 음이라도 어긋나면 처음부터다", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<PianoMelodyMinigame onComplete={onComplete} />);

    press(MELODY[0]);
    // 곡의 둘째 음이 아닌 것을 고른다
    press(SOLFEGE.find((note) => note !== MELODY[1]) ?? "do");
    // 타이머가 상태를 되돌린다. act 안에서 돌려야 그 갱신이 화면에 반영된다
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // 다시 처음부터 쳐서 끝까지 가면 그대로 풀린다
    for (const note of MELODY) press(note);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ cleared: true }));
    vi.useRealTimers();
  });

  it("조각을 들고 있으면 지워진 마디가 드러난다", () => {
    const { container: without } = render(<PianoMelodyMinigame onComplete={() => {}} />);
    const blanksWithout = without.querySelectorAll("li.text-transparent").length;
    cleanup();

    const { container: carrying } = render(
      <PianoMelodyMinigame onComplete={() => {}} carrying={["piano-sheet"]} />,
    );
    const blanksCarrying = carrying.querySelectorAll("li.text-transparent").length;

    expect(blanksWithout).toBeGreaterThan(0);
    expect(blanksCarrying).toBe(0);
  });
});
