/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
import { TitleScreen } from "./TitleScreen";

/**
 * 로딩 진행률은 리셋으로 되돌아가지 않는다 (한 번 받은 모델은 그대로 있다) —
 * 테스트끼리 새는 것을 막으려면 스토어를 직접 되돌려 놓아야 한다.
 */
function setRoomLoaded(progress: number) {
  useMemoryRoomStore.setState({ roomLoadProgress: progress });
}

describe("TitleScreen", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.useFakeTimers();
    useMemoryRoomStore.getState().reset();
    // 방이 다 들어온 상태가 기본 — 시작 버튼이 열려 있어야 눌러 볼 수 있다
    setRoomLoaded(1);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useMemoryRoomStore.getState().reset();
    setRoomLoaded(0);
  });

  afterAll(async () => {
    await i18n.changeLanguage("ko");
  });

  it("shows the loading overlay for a beat, then hands over to the room", () => {
    render(<TitleScreen />);

    fireEvent.click(screen.getByRole("button", { name: "START" }));
    expect(screen.getByRole("status")).toBeTruthy();
    expect(useMemoryRoomStore.getState().started).toBe(false);

    act(() => vi.runAllTimers());
    expect(useMemoryRoomStore.getState().started).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("returns to the start button after a reset instead of hanging on the loading overlay", () => {
    render(<TitleScreen />);

    fireEvent.click(screen.getByRole("button", { name: "START" }));
    act(() => vi.runAllTimers());

    act(() => useMemoryRoomStore.getState().reset());

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "START" })).toBeTruthy();
  });

  describe("3D 에셋을 받는 동안", () => {
    it("시작 버튼을 잠그고 진행률을 보여준다", () => {
      setRoomLoaded(0.4);
      render(<TitleScreen />);

      const start = screen.getByRole("button", { name: "START" });
      expect(start.hasAttribute("disabled")).toBe(true);
      expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
      expect(screen.getByText("Loading the room… 40%")).toBeTruthy();

      // 잠긴 버튼을 눌러도 방으로 넘어가지 않는다
      fireEvent.click(start);
      act(() => vi.runAllTimers());
      expect(useMemoryRoomStore.getState().started).toBe(false);
    });

    it("다 받으면 버튼이 열리고 진행률이 사라진다", () => {
      setRoomLoaded(0.4);
      render(<TitleScreen />);

      act(() => useMemoryRoomStore.getState().setRoomLoadProgress(1));

      expect(screen.getByRole("button", { name: "START" }).hasAttribute("disabled")).toBe(false);
      expect(screen.queryByRole("progressbar")).toBeNull();
    });

    it("보고가 끊겨도 결국 열어 준다 — 못 들어가는 것보다는 낫다", () => {
      setRoomLoaded(0);
      render(<TitleScreen />);

      expect(screen.getByRole("button", { name: "START" }).hasAttribute("disabled")).toBe(true);
      // 셀 것이 없으면 0%를 내걸지 않는다 — 훑고 지나가는 바만 돈다
      expect(screen.getByRole("progressbar").hasAttribute("aria-valuenow")).toBe(false);

      // 캔버스 청크 자체를 못 받으면 아무도 진행률을 보고하지 않는다
      act(() => vi.advanceTimersByTime(12_000));

      expect(screen.getByRole("button", { name: "START" }).hasAttribute("disabled")).toBe(false);
      expect(screen.queryByRole("progressbar")).toBeNull();
    });
  });
});
