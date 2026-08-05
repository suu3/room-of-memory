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
