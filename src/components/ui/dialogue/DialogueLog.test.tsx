/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
import { DialogueLog } from "./DialogueLog";

/** 지나간 줄 몇 개를 쌓고 로그를 펼친다. */
function openLog() {
  act(() => {
    useMemoryRoomStore.setState({
      started: true,
      dialogueLog: [
        { speaker: "hero", textKey: "scripts.ball-intro.line1" },
        { speaker: "hero", textKey: "scripts.ball-intro.line2" },
      ],
      dialogueLogOpen: true,
    });
  });
}

describe("지나간 대사 화면", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("ko");
  });

  afterEach(() => {
    cleanup();
    useMemoryRoomStore.getState().reset();
  });

  afterAll(() => {
    useMemoryRoomStore.getState().reset();
  });

  it("제목줄의 닫기 버튼으로 닫힌다", () => {
    render(<DialogueLog />);
    openLog();

    fireEvent.click(screen.getByRole("button", { name: "지나간 대사 닫기" }));
    expect(useMemoryRoomStore.getState().dialogueLogOpen).toBe(false);
  });

  it("글자 위를 눌러도 닫힌다", () => {
    render(<DialogueLog />);
    openLog();

    // 백드롭이 아니라 대사 한 줄을 정확히 누른다. 예전엔 여기서 닫히지 않았다
    fireEvent.click(
      screen.getByText("전국대회 16강, 은강고전. 9회 말 투아웃, 마지막 타석은 나였다."),
    );
    expect(useMemoryRoomStore.getState().dialogueLogOpen).toBe(false);
  });

  it("Escape로도 닫힌다", () => {
    render(<DialogueLog />);
    openLog();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(useMemoryRoomStore.getState().dialogueLogOpen).toBe(false);
  });

  /*
   * 열릴 때 맨 아래로 내리는 일은 굴리는 상자가 직접 해야 한다. scrollIntoView는 조상까지
   * 같이 굴려서, 방을 담은 h-dvh 상자(overflow-hidden이라도 프로그램으로는 굴러간다)가
   * 밀린 채 남는다: 로그를 닫은 뒤에도 HUD가 그만큼 위로 올라가 있었다.
   */
  it("열릴 때 조상 상자를 굴리지 않는다", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<DialogueLog />);
      openLog();

      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });
});
