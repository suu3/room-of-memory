/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
import { DialogueBox } from "./DialogueBox";

/** 지금 몇 번째 줄인가. Enter가 실제로 대사를 밀었는지 보는 유일한 지표다. */
function lineIndex() {
  return useMemoryRoomStore.getState().activeInteraction?.lineIndex ?? -1;
}

function openDialogue() {
  act(() => {
    useMemoryRoomStore.getState().beginInteraction("report-card");
  });
  if (useMemoryRoomStore.getState().activeInteraction?.phase !== "dialogue") {
    throw new Error("성적표가 대사로 시작하지 않는다");
  }
}

describe("DialogueBox의 Enter", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    /*
     * 모션을 끈 것으로 둔다. 타자 연출이 도는 동안에는 Enter가 "마저 채우기"라
     * 줄이 안 넘어간다. 여기서 보려는 건 타자기가 아니라 Enter가 어디로 가는지다.
     */
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    );
    useMemoryRoomStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useMemoryRoomStore.getState().reset();
  });

  afterAll(async () => {
    await i18n.changeLanguage("ko");
  });

  it("아무것도 포커스되지 않았으면 대사를 넘긴다", () => {
    render(<DialogueBox />);
    openDialogue();

    const before = lineIndex();
    act(() => {
      fireEvent.keyDown(window, { key: "Enter" });
    });

    expect(lineIndex()).toBe(before + 1);
  });

  it("포커스된 다른 버튼의 Enter를 뺏지 않는다", () => {
    /*
     * 대사창은 창 전역을 캡처 단계로 듣는다. 그대로 두면 대사 중에 HUD 버튼으로
     * 탭해 둔 사람이 Enter를 눌러도 버튼은 안 눌리고 대사만 넘어간다. 아무 일도
     * 안 일어나는 게 아니라 **엉뚱한 게** 일어난다.
     */
    render(
      <>
        <button type="button" aria-label="메뉴 열기">
          menu
        </button>
        <DialogueBox />
      </>,
    );
    openDialogue();

    const menu = screen.getByRole("button", { name: "메뉴 열기" });
    menu.focus();

    const before = lineIndex();
    act(() => {
      fireEvent.keyDown(menu, { key: "Enter" });
    });

    expect(lineIndex()).toBe(before);
  });

  it("대사창 자신의 넘기기 버튼에 포커스가 있으면 그래도 넘긴다", () => {
    // 클릭으로 한 번 넘기면 그 버튼에 포커스가 남는다. 여기서 Enter가 죽으면
    // "클릭한 뒤부터 Enter가 안 먹는" 꼴이 된다
    render(<DialogueBox />);
    openDialogue();

    const advance = screen.getAllByRole("button")[0];
    advance.focus();

    const before = lineIndex();
    act(() => {
      fireEvent.keyDown(advance, { key: "Enter" });
    });

    expect(lineIndex()).toBe(before + 1);
  });
});
