/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMemoryRoomStore } from "@/store/memory-room";
import { AdminPanel } from "./AdminPanel";

describe("AdminPanel", () => {
  beforeEach(() => {
    localStorage.clear();
    useMemoryRoomStore.getState().reset();
  });

  afterEach(cleanup);

  it("starts collapsed to a single button", () => {
    render(<AdminPanel />);
    expect(screen.getByRole("button", { name: "DEV" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "memories" })).toBeNull();
  });

  it("expands when the button is clicked", () => {
    render(<AdminPanel />);
    fireEvent.click(screen.getByRole("button", { name: "DEV" }));
    expect(screen.getByRole("group", { name: "memories" })).toBeTruthy();
  });

  it("expands and collapses on the backtick key", () => {
    render(<AdminPanel />);
    fireEvent.keyDown(window, { key: "`" });
    expect(screen.getByRole("group", { name: "memories" })).toBeTruthy();

    fireEvent.keyDown(window, { key: "`" });
    expect(screen.queryByRole("group", { name: "memories" })).toBeNull();
  });

  it("remembers that it was expanded", () => {
    const first = render(<AdminPanel />);
    fireEvent.click(screen.getByRole("button", { name: "DEV" }));
    first.unmount();

    render(<AdminPanel />);
    expect(screen.getByRole("group", { name: "memories" })).toBeTruthy();
  });

  it("cycles a memory when its cell is clicked", () => {
    render(<AdminPanel />);
    fireEvent.click(screen.getByRole("button", { name: "DEV" }));

    fireEvent.click(screen.getByRole("button", { name: /^console/ }));
    expect(useMemoryRoomStore.getState().collected).toEqual(["console"]);
  });

  it("toggles the ending flag", () => {
    render(<AdminPanel />);
    fireEvent.click(screen.getByRole("button", { name: "DEV" }));

    /*
     * 엔딩은 배트를 쥔 뒤에만 붙고(sanitizeProgress), 배트는 앰플을 되찾아야
     * 쥐어진다 — 먼저 진행을 채워 둔다. 앰플은 1차가 없는 기억이라 한 번 누르면
     * 곧장 2차(revisited)다 (admin-progress의 stagesOf).
     */
    const all = ["console", "window", "frame", "radio", "phone", "calendar", "ball"] as const;
    for (const id of all)
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${id}`) }));
    fireEvent.click(screen.getByRole("button", { name: /^ampo/ }));
    fireEvent.click(screen.getByLabelText("batTaken"));

    fireEvent.click(screen.getByLabelText("endingStarted"));
    expect(useMemoryRoomStore.getState().endingStarted).toBe(true);
  });

  it("does not let its own key presses reach the game", () => {
    let leaked = false;
    const spy = () => {
      leaked = true;
    };
    window.addEventListener("keydown", spy);

    render(<AdminPanel />);
    fireEvent.click(screen.getByRole("button", { name: "DEV" }));
    leaked = false;
    fireEvent.keyDown(screen.getByRole("group", { name: "memories" }), { key: "w" });

    window.removeEventListener("keydown", spy);
    expect(leaked).toBe(false);
  });
});
