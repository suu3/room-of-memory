/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
import { TitleScreen } from "./TitleScreen";

/**
 * 부팅 커튼은 리셋으로 다시 내려오지 않는다 (한 번 받은 모델은 그대로 있다) —
 * 테스트끼리 새는 것을 막으려면 스토어를 직접 되돌려 놓아야 한다.
 */
function setBooted(booted: boolean) {
  useMemoryRoomStore.setState({ booted });
}

describe("TitleScreen", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.useFakeTimers();
    useMemoryRoomStore.getState().reset();
    // 커튼이 걷힌 뒤가 기본이다 — 이 화면은 그때부터 보인다
    setBooted(true);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useMemoryRoomStore.getState().reset();
    setBooted(false);
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

  /*
   * 로딩은 이제 BootCurtain이 전부 맡는다 (BootCurtain.test.tsx). 이 화면은 커튼이
   * 걷힌 뒤에만 보이므로 진행률을 알 필요가 없다 — 다만 걷히기 전에 미리 그려져
   * 있으므로, 그동안 손이 닿지 않는지는 여기서 지킨다.
   */
  it("커튼이 걷히기 전에는 손이 닿지 않는다", () => {
    setBooted(false);
    const { container } = render(<TitleScreen />);

    expect(container.firstElementChild?.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });

  it("커튼이 걷히면 열리고 시작 버튼에 포커스가 간다", () => {
    setBooted(false);
    const { container } = render(<TitleScreen />);

    act(() => useMemoryRoomStore.getState().finishBoot());

    expect(container.firstElementChild?.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "START" }));
  });
});
