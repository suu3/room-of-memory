/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
import { TitleScreen } from "./TitleScreen";

describe("TitleScreen", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.useFakeTimers();
    useMemoryRoomStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useMemoryRoomStore.getState().reset();
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
});
