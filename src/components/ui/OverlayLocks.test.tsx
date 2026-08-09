/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
import { CharacterSheetModal } from "./CharacterSheetModal";
import { HudMenu } from "./HudMenu";
import { NotebookTab } from "./NotebookTab";

const NOTEBOOK_TAB_NAME = "Open the notebook — collected memories";

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
        <NotebookTab />
        <CharacterSheetModal />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("button", { name: NOTEBOOK_TAB_NAME }));
    expect(useMemoryRoomStore.getState().uiLocks).toEqual(["hud-menu", "character-sheet"]);

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(useMemoryRoomStore.getState().uiLocks).toEqual(["character-sheet"]);

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

  it("opens the notebook on the memory log page from the edge tab", () => {
    render(
      <>
        <NotebookTab />
        <CharacterSheetModal />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: NOTEBOOK_TAB_NAME }));
    expect(useMemoryRoomStore.getState().characterSheetOpen).toBe(true);
    expect(useMemoryRoomStore.getState().characterSheetTab).toBe("lore");
    expect(screen.getByRole("tab", { name: "Notes", selected: true })).toBeTruthy();
  });

  it("closes an open notebook when reset is confirmed from the menu", () => {
    render(
      <>
        <HudMenu />
        <NotebookTab />
        <CharacterSheetModal />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: NOTEBOOK_TAB_NAME }));
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(useMemoryRoomStore.getState().uiLocks).toEqual(["character-sheet", "hud-menu"]);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(useMemoryRoomStore.getState().characterSheetOpen).toBe(false);
    expect(useMemoryRoomStore.getState().uiLocks).toEqual([]);
  });
});
