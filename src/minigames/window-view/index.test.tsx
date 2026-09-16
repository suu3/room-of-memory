/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../../i18n/config";
import { ASSETS } from "../../lib/assets";
import { useMemoryRoomStore } from "../../store/memory-room";
import type { MinigameResult } from "../../types/minigame";
import { WindowViewMinigame } from "./index";
import { LENS_STEP, WINDOW_SPOTS } from "./spots";

/** 렌즈를 (50, 50)에서 자리까지 방향키로 옮기고 Enter로 들여다본다. */
function findByKeyboard(from: { x: number; y: number }, to: { x: number; y: number }) {
  const steps = (delta: number, negative: string, positive: string) => {
    const count = Math.round(Math.abs(delta) / LENS_STEP);
    for (let i = 0; i < count; i += 1) {
      fireEvent.keyDown(window, { key: delta < 0 ? negative : positive });
    }
  };
  steps(to.x - from.x, "ArrowLeft", "ArrowRight");
  steps(to.y - from.y, "ArrowUp", "ArrowDown");
  fireEvent.keyDown(window, { key: "Enter" });
}

describe("WindowViewMinigame", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.useFakeTimers();
    useMemoryRoomStore.getState().setDifficulty("easy");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows the view outside with a lens over it", () => {
    const { container } = render(<WindowViewMinigame onComplete={() => {}} />);

    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe(ASSETS.images.mgWindowViewOutside);
    // 그림만 덩그러니 두지 않는다. 무엇을 하는 화면인지 한 줄이 같이 붙는다.
    expect(screen.getByText(/Move the lens/)).toBeTruthy();
    // 바깥은 노을이다. 그림 위에 밤의 색을 덮지 않는다
    expect(container.querySelector(".window-night")).toBeNull();
    // 세 자리가 아직 하나도 안 찾아졌다
    expect(screen.getAllByRole("listitem")).toHaveLength(WINDOW_SPOTS.length);
    expect(screen.queryByRole("button", { name: /Close the curtain/ })).toBeNull();
  });

  it("finds the three spots by keyboard and only then offers the curtain", () => {
    const results: MinigameResult[] = [];
    render(<WindowViewMinigame onComplete={(result) => results.push(result)} />);

    let lens = { x: 50, y: 50 };
    WINDOW_SPOTS.forEach((spot, index) => {
      act(() => findByKeyboard(lens, spot));
      // 걸음이 4%라 정확히 그 자리는 아니지만 반지름 안이다
      lens = {
        x: lens.x + Math.round((spot.x - lens.x) / LENS_STEP) * LENS_STEP,
        y: lens.y + Math.round((spot.y - lens.y) / LENS_STEP) * LENS_STEP,
      };
      // 짚은 자리마다 한 줄이 붙고, 마지막 자리에서는 마무리 줄로 갈아든다
      const expected =
        index === WINDOW_SPOTS.length - 1
          ? i18n.t("minigame.windowView.allFound")
          : i18n.t(`minigame.windowView.line.${spot.id}`);
      expect(screen.getByText(expected)).toBeTruthy();
    });

    const close = screen.getByRole("button", { name: /Close the curtain/ });
    fireEvent.click(close);
    fireEvent.click(close);

    expect(results).toEqual([{ cleared: true }]);
  });

  it("lets the player close the curtain after a while even without finding everything", () => {
    render(<WindowViewMinigame onComplete={() => {}} />);
    expect(screen.queryByRole("button", { name: /Close the curtain/ })).toBeNull();

    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(screen.getByRole("button", { name: /Close the curtain/ })).toBeTruthy();
  });

  it("reports nothing until the player closes it", () => {
    const onComplete = vi.fn();
    render(<WindowViewMinigame onComplete={onComplete} />);

    // 창을 열어만 두고 방으로 돌아가면(백드롭 클릭) 아무 일도 없었던 것으로 남는다.
    expect(onComplete).not.toHaveBeenCalled();
  });
});
