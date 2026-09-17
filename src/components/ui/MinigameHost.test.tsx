/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ACT2_CHAIN, PHASE1_MEMORIES } from "@/data/memory-room";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
import { CanvasMinigameSkip, MinigameHost } from "./MinigameHost";

/**
 * 게임기(격투 게임)를 조사한 상태로 만든다. 시작 카드가 뜨는 자리.
 * 진입 대사(①)가 붙어 있으므로 대사를 끝까지 넘겨야 미니게임 페이즈에 닿는다.
 */
function openConsole() {
  act(() => {
    useMemoryRoomStore.getState().beginInteraction("console");
    for (
      let step = 0;
      step < 16 && useMemoryRoomStore.getState().activeInteraction?.phase === "dialogue";
      step += 1
    ) {
      useMemoryRoomStore.getState().advanceDialogue();
    }
  });
  if (useMemoryRoomStore.getState().activeInteraction?.phase !== "minigame") {
    throw new Error("게임기 진입 대사가 미니게임 페이즈로 이어지지 않는다");
  }
}

/**
 * 냉장고 아래칸(앰플)을 조사해 서랍을 여는 canvas 판까지 간 상태. 2막 추리 체인의
 * 나머지를 다 마친 뒤라야 열린다.
 */
function openAmpoule() {
  act(() => {
    useMemoryRoomStore.setState({
      collected: PHASE1_MEMORIES.map((memory) => memory.id),
      revisited: ACT2_CHAIN.filter((id) => id !== "ampoule"),
      doorOpened: true,
    });
    useMemoryRoomStore.getState().beginInteraction("ampoule");
    for (
      let step = 0;
      step < 16 && useMemoryRoomStore.getState().activeInteraction?.phase === "dialogue";
      step += 1
    ) {
      useMemoryRoomStore.getState().advanceDialogue();
    }
  });
  if (useMemoryRoomStore.getState().activeInteraction?.phase !== "minigame") {
    throw new Error("앰플 진입 대사가 미니게임 페이즈로 이어지지 않는다");
  }
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
    // UT: "격투 게임이 너무 어렵다". 상성도 페인트도 모르고 들어가면 첫 판이 그냥 지나간다.
    render(<MinigameHost />);
    openConsole();

    // 상성은 순서만이 아니라 이유까지: 임의의 규칙은 판이 도는 중에 안 떠오른다
    expect(screen.getByText(/Throws beat guards/)).toBeTruthy();
    // 강공격이 느리다는 것과 카운터가 있다는 건 첫 판 전에 알아야 한다
    expect(screen.getByText(/Heavy hits slow/)).toBeTruthy();

    // 두 줄. 미니게임 하나 붙잡고 읽을 분량이 아니다 (UT: "미니겜이니까 더 짧아도 될 듯")
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
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

  it("결과 대사 중에는 밑에 깔린 판이 포커스를 못 잡는다", () => {
    /*
     * 결과 대사 단계에서 판은 대사창(z-50) 아래 그림으로만 남는다. 그런데 DOM에는
     * 그대로 살아 있어서, 탭이 닿으면 안 보이는 버튼에 포커스가 잡힌다. 그 상태로
     * Enter를 누르면 대사는 안 넘어가고 보이지도 않는 버튼이 눌린다.
     */
    render(<MinigameHost />);
    openConsole();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    act(() => useMemoryRoomStore.getState().finishMinigame({ cleared: true }));
    if (useMemoryRoomStore.getState().activeInteraction?.keepMinigame !== true) {
      throw new Error("결과 대사 단계에 닿지 않았다");
    }

    // 판을 얹는 층(z-40) 자체가 입력에서 빠져 있어야 한다. 이 게임은 결과 단계에
    // 버튼을 안 남기지만, 남기는 미니게임이 생겨도 같은 층이 막아 준다
    const layer = document.querySelector("[inert]");
    expect(layer).not.toBeNull();
    expect(layer?.className).toContain("z-40");
  });

  it("leaves nothing on screen once the panel is closed", () => {
    render(<MinigameHost />);
    openConsole();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    act(() => useMemoryRoomStore.getState().cancelMinigame());

    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
  });

  it("canvas 판(앰플)은 건너뛰지 않는다. 씬이 그리는 판 위에 안내와 닫기만 얹는다", () => {
    render(<MinigameHost />);
    openAmpoule();

    // 씬 쪽 호스트의 몫이다. DOM 호스트가 cleared로 넘겨 버리면 집는 손이 사라진다
    expect(useMemoryRoomStore.getState().activeInteraction?.phase).toBe("minigame");
    expect(screen.getByRole("status").textContent).toContain("Pick up the ampoule");
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Close and return to the room" }));
    // 닫으면 조사 자체가 접힌다. 핫스팟은 남아 다시 열 수 있다
    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
  });

  it("3D가 못 뜨면 canvas 판을 건너뛰어 진행을 살린다", () => {
    openAmpoule();
    render(<CanvasMinigameSkip />);

    const active = useMemoryRoomStore.getState().activeInteraction;
    expect(active?.phase).toBe("dialogue");
    expect(active?.scriptId).toBe("ampoule-found");
  });
});
