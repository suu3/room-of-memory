/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
import { MinigameHost } from "./MinigameHost";

/** 게임기(격투 게임)를 조사한 상태로 만든다 — 시작 카드가 뜨는 자리. */
function openConsole() {
  act(() => useMemoryRoomStore.getState().beginInteraction("console"));
}

describe("MinigameHost", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => useMemoryRoomStore.getState().reset());

  afterEach(() => {
    cleanup();
    useMemoryRoomStore.getState().reset();
  });

  afterAll(async () => {
    await i18n.changeLanguage("ko");
  });

  it("opens on the start card so the rules can be read before the clock runs", () => {
    render(<MinigameHost />);
    openConsole();

    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });

  it("lays out how to play on the start card, not just the one-line help", () => {
    // UT: "격투 게임이 너무 어렵다" — 상성도 페인트도 모르고 들어가면 첫 판이 그냥 지나간다.
    render(<MinigameHost />);
    openConsole();

    // UT: "잡기는 뭔지도 모르겠네" — 상성보다 먼저 세 수가 뭔지를 말해야 한다
    expect(screen.getByText(/Throw grabs and takes them down/)).toBeTruthy();
    // 상성은 순서만이 아니라 이유까지 — 임의의 규칙은 판이 도는 중에 안 떠오른다
    expect(screen.getByText(/a guarding opponent just gets grabbed/)).toBeTruthy();
    expect(screen.getByText(/change stance mid-tell/)).toBeTruthy();
    expect(screen.getByText(/before the timer runs out/)).toBeTruthy();
  });

  it("comes back to the start card after the panel is closed and reopened", () => {
    /*
     * 같은 물건은 같은 인터랙션 키를 만든다. 닫을 때 시작 표시를 비우지 않으면
     * 두 번째부터는 시작 카드를 건너뛰고 게임이 곧장 돌아, 조작법을 읽기도 전에
     * 라운드가 지나간다 (UT: "반응할 틈도 없이 패배").
     */
    render(<MinigameHost />);
    openConsole();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();

    act(() => useMemoryRoomStore.getState().cancelMinigame());
    openConsole();

    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });

  it("leaves nothing on screen once the panel is closed", () => {
    render(<MinigameHost />);
    openConsole();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    act(() => useMemoryRoomStore.getState().cancelMinigame());

    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
  });
});
