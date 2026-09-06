/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMemoryRoomStore } from "@/store/memory-room";
import { AdminPanel } from "./AdminPanel";
import { ADMIN_SPAWNS } from "./admin-actions";

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

  it("warps the body to the living room and opens the door on the way", () => {
    render(<AdminPanel />);
    fireEvent.click(screen.getByRole("button", { name: "DEV" }));

    fireEvent.click(screen.getByRole("button", { name: "거실" }));

    // 몸의 자리는 스토어에 없다 — 패널은 "여기로 가라"는 신호만 남기고 Player가 옮긴다.
    expect(useMemoryRoomStore.getState().warpTarget).toEqual(ADMIN_SPAWNS.living);
    // 문이 닫혀 있으면 걷기 범위가 방뿐이라 거실에 떨어뜨려도 한 발짝을 못 간다.
    expect(useMemoryRoomStore.getState().doorOpened).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "방" }));
    expect(useMemoryRoomStore.getState().warpTarget).toEqual(ADMIN_SPAWNS.room);
  });

  it("actually opens the door from the checkbox", () => {
    render(<AdminPanel />);
    fireEvent.click(screen.getByRole("button", { name: "DEV" }));

    fireEvent.click(screen.getByRole("checkbox", { name: "doorOpened" }));

    /*
     * 문은 라디오 목소리를 들은 저장본에서만 열린 채로 남는다(sanitizeProgress). 전제를
     * 안 채우면 체크박스가 켜지자마자 도로 꺼져서, 도구가 아무 일도 안 하는 것처럼 보인다.
     */
    expect(useMemoryRoomStore.getState().doorOpened).toBe(true);
    expect(useMemoryRoomStore.getState().revisited).toContain("radio");
  });

  it("stands the player up before moving them", () => {
    render(<AdminPanel />);
    fireEvent.click(screen.getByRole("button", { name: "DEV" }));
    useMemoryRoomStore.getState().sitOnSeat("desk-chair");

    fireEvent.click(screen.getByRole("button", { name: "거실" }));

    // 앉은 채로 옮기면 몸만 가고 의자는 방에 남는다.
    expect(useMemoryRoomStore.getState().seatedAt).toBe(null);
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
