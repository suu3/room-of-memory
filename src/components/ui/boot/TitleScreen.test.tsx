/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoryId } from "@/data/memory-room";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
import { TitleScreen } from "./TitleScreen";

/**
 * 부팅 커튼은 리셋으로 다시 내려오지 않는다 (한 번 받은 모델은 그대로 있다).
 * 테스트끼리 새는 것을 막으려면 스토어를 직접 되돌려 놓아야 한다.
 */
function setBooted(booted: boolean) {
  useMemoryRoomStore.setState({ booted });
}

/** 저장이 있는 판: 기억 하나를 모아 둔 채 타이틀로 돌아온 상태. */
function setSaved() {
  useMemoryRoomStore.setState({ collected: ["radio" as MemoryId] });
}

describe("TitleScreen", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.useFakeTimers();
    useMemoryRoomStore.getState().reset();
    // 커튼이 걷힌 뒤가 기본이다. 이 화면은 그때부터 보인다
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

    fireEvent.click(screen.getByRole("button", { name: "New Game" }));
    expect(screen.getByRole("status")).toBeTruthy();
    expect(useMemoryRoomStore.getState().started).toBe(false);

    act(() => vi.runAllTimers());
    expect(useMemoryRoomStore.getState().started).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("counts memories from the second lap in the saved line, not just the first lap", () => {
    useMemoryRoomStore.setState({
      collected: ["radio" as MemoryId],
      revisited: ["radio", "duffel", "fridge"] as MemoryId[],
      doorOpened: true,
    });
    render(<TitleScreen />);

    // radio(1차) + duffel · fridge(2차에 처음 본 것) = 3
    expect(screen.getByText(/3 memories/)).toBeTruthy();
  });

  it("returns to the menu after a reset instead of hanging on the loading overlay", () => {
    render(<TitleScreen />);

    fireEvent.click(screen.getByRole("button", { name: "New Game" }));
    act(() => vi.runAllTimers());

    act(() => useMemoryRoomStore.getState().reset());

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "New Game" })).toBeTruthy();
  });

  /*
   * 로딩은 이제 BootCurtain이 전부 맡는다 (BootCurtain.test.tsx). 이 화면은 커튼이
   * 걷힌 뒤에만 보이므로 진행률을 알 필요가 없다. 다만 걷히기 전에 미리 그려져
   * 있으므로, 그동안 손이 닿지 않는지는 여기서 지킨다.
   */
  it("커튼이 걷히기 전에는 손이 닿지 않는다", () => {
    setBooted(false);
    const { container } = render(<TitleScreen />);

    expect(container.firstElementChild?.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });

  it("커튼이 걷히면 열리고 첫 메뉴 항목에 포커스가 간다", () => {
    setBooted(false);
    const { container } = render(<TitleScreen />);

    act(() => useMemoryRoomStore.getState().finishBoot());

    expect(container.firstElementChild?.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "New Game" }));
  });

  it("화살표로 메뉴를 오가고 끝에서 감긴다", () => {
    render(<TitleScreen />);

    const newGame = screen.getByRole("button", { name: "New Game" });
    const credits = screen.getByRole("button", { name: "Credits" });
    act(() => newGame.focus());

    fireEvent.keyDown(newGame, { key: "ArrowDown" });
    expect(document.activeElement).toBe(credits);

    // 마지막 항목에서 아래로 → 처음으로 감긴다
    fireEvent.keyDown(credits, { key: "ArrowDown" });
    expect(document.activeElement).toBe(newGame);

    fireEvent.keyDown(newGame, { key: "ArrowUp" });
    expect(document.activeElement).toBe(credits);
  });

  it("저장이 있으면 이어하기가 첫 항목으로 서고 포커스를 받는다", () => {
    setSaved();
    render(<TitleScreen />);

    const resume = screen.getByRole("button", { name: "Continue" });
    expect(document.activeElement).toBe(resume);

    fireEvent.click(resume);
    act(() => vi.runAllTimers());
    // 이어하기는 진행을 지우지 않는다
    expect(useMemoryRoomStore.getState().collected).toEqual(["radio"]);
    expect(useMemoryRoomStore.getState().started).toBe(true);
  });

  it("저장이 있는 판의 새 게임은 확인을 거쳐 진행을 지우고 시작한다", () => {
    setSaved();
    render(<TitleScreen />);

    fireEvent.click(screen.getByRole("button", { name: "New Game" }));
    // 묻기만 했다. 아직 아무것도 안 지워졌다
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(useMemoryRoomStore.getState().collected).toEqual(["radio"]);

    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    act(() => vi.runAllTimers());
    expect(useMemoryRoomStore.getState().collected).toEqual([]);
    expect(useMemoryRoomStore.getState().started).toBe(true);
  });

  it("소리를 켜고 플레이하라는 권장이 켜진 토글로 선다", () => {
    render(<TitleScreen />);

    const sound = screen.getByRole("button", { name: "Sound" });
    // 새 게임 바로 아래에 붙는다. 무엇에 대한 권장인지 붙어 있어야 읽힌다
    expect(sound.parentElement?.previousElementSibling).toBe(
      screen.getByRole("button", { name: "New Game" }),
    );
    expect(sound.getAttribute("aria-pressed")).toBe("true");
    expect(sound.textContent).toContain("On");
    expect(sound.textContent).toContain("best played with sound on");
  });

  it("저장이 있는 판에서는 소리 토글이 새 게임 아래가 아니라 조작 띠에 선다", () => {
    setSaved();
    render(<TitleScreen />);

    const sound = screen.getByRole("button", { name: "Sound" });
    // 이어하는 사람에게 새 게임 밑은 눈이 안 가는 자리다. 조작 안내와 같은 줄(dl)에 선다
    expect(sound.closest("dl")).not.toBeNull();
    expect(sound.parentElement?.previousElementSibling).not.toBe(
      screen.getByRole("button", { name: "New Game" }),
    );
    expect(screen.getAllByRole("button", { name: "Sound" })).toHaveLength(1);
  });

  it("기록 줄에는 번호(·날짜)만 남고, 신호는 오른쪽 위에 따로 선다", () => {
    setSaved();
    const { container } = render(<TitleScreen />);

    const eyebrow = [...container.querySelectorAll("p")].find((p) =>
      p.textContent?.includes("MEMORY LOG"),
    );
    expect(eyebrow).toBeTruthy();
    expect(eyebrow?.textContent).not.toContain("SIGNAL");
    const signals = [...container.querySelectorAll("span")].filter((span) =>
      /SIGNAL/.test(span.textContent ?? ""),
    );
    // 신호 조각은 한 군데만: 눈썹줄에도 있으면 폰에서 그 줄이 잘리던 문제로 돌아간다
    expect(signals.filter((span) => !span.querySelector("span"))).toHaveLength(0);
    expect(signals.length).toBeGreaterThan(0);
    const outer = signals[0];
    expect(outer.closest("p")).toBeNull();
  });

  it("소리 토글을 누르면 음소거되고 꺼짐으로 읽힌다", () => {
    render(<TitleScreen />);

    const sound = screen.getByRole("button", { name: "Sound" });
    fireEvent.click(sound);

    expect(useMemoryRoomStore.getState().soundMuted).toBe(true);
    expect(sound.getAttribute("aria-pressed")).toBe("false");
    expect(sound.textContent).toContain("Off");
    // 권장 문구는 꺼져 있을 때도 남아, 켜라는 이유를 계속 말한다
    expect(sound.textContent).toContain("best played with sound on");
  });

  it("새 게임 확인에서 취소하면 아무것도 지워지지 않는다", () => {
    setSaved();
    render(<TitleScreen />);

    fireEvent.click(screen.getByRole("button", { name: "New Game" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(useMemoryRoomStore.getState().collected).toEqual(["radio"]);
    expect(useMemoryRoomStore.getState().started).toBe(false);
    // 물러난 자리로 포커스가 돌아온다
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "New Game" }));
  });
});
