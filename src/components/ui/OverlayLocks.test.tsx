/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
import { HudMenu } from "./HudMenu";
import { MemoryPanel } from "./MemoryPanel";

describe("room overlay input locks", () => {
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

  it("keeps each open overlay locked until that source closes or unmounts", () => {
    const view = render(
      <>
        <HudMenu />
        <MemoryPanel />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Open the memory collection panel" }));
    expect(useMemoryRoomStore.getState().uiLocks).toEqual(["hud-menu", "memory-panel"]);

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(useMemoryRoomStore.getState().uiLocks).toEqual(["memory-panel"]);

    view.unmount();
    expect(useMemoryRoomStore.getState().uiLocks).toEqual([]);
  });

  it("keeps the menu lock while reset confirmation replaces the dropdown", () => {
    render(<HudMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(useMemoryRoomStore.getState().uiLocks).toEqual(["hud-menu"]);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(useMemoryRoomStore.getState().uiLocks).toEqual([]);
  });

  it("closes an open memory panel when reset is confirmed from the menu", () => {
    render(
      <>
        <HudMenu />
        <MemoryPanel />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open the memory collection panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(useMemoryRoomStore.getState().uiLocks).toEqual(["memory-panel", "hud-menu"]);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    const panelButton = screen.getByRole("button", {
      name: "Open the memory collection panel",
    });
    expect(panelButton.getAttribute("aria-expanded")).toBe("false");
    expect(useMemoryRoomStore.getState().uiLocks).toEqual([]);
  });
});
