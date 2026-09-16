/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { useMemoryRoomStore } from "@/store/memory-room";
import { DialogueBox } from "./DialogueBox";
import { DialogueLog } from "./DialogueLog";

/** 대사창을 세우는 최소 상태: 공 기억의 도입 대사 두 줄. */
function openBallDialogue() {
  // act 안에서 연다. 밖에서 열면 타자 연출이 시작되기 전에 시간이 흘러가 버린다
  act(() => {
    useMemoryRoomStore.setState({
      started: true,
      introDone: true,
      activeInteraction: {
        memoryId: "ball",
        gamePhase: 1,
        phase: "dialogue",
        scriptId: "ball-intro",
        lineIndex: 0,
      },
    });
  });
}

/** 타자 연출이 끝날 만큼 시간을 민다. */
function typeOut() {
  act(() => {
    vi.advanceTimersByTime(8000);
  });
}

describe("대사창의 오토와 로그", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("ko");
  });

  beforeEach(() => {
    useMemoryRoomStore.getState().reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    useMemoryRoomStore.getState().reset();
  });

  afterAll(() => {
    useMemoryRoomStore.getState().reset();
  });

  it("화면에 선 대사가 로그에 쌓인다", () => {
    render(<DialogueBox />);
    openBallDialogue();
    typeOut();

    const log = useMemoryRoomStore.getState().dialogueLog;
    expect(log).toHaveLength(1);
    expect(log[0]).toEqual({ speaker: "hero", textKey: "scripts.ball-intro.line1" });
  });

  it("오토가 켜져 있으면 다 찍힌 줄이 저절로 넘어간다", () => {
    useMemoryRoomStore.setState({ autoPlay: true });
    render(<DialogueBox />);
    openBallDialogue();
    typeOut();

    expect(useMemoryRoomStore.getState().activeInteraction?.lineIndex).toBe(0);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(useMemoryRoomStore.getState().activeInteraction?.lineIndex).toBe(1);
  });

  it("오토가 꺼져 있으면 기다려도 안 넘어간다", () => {
    // 오토는 설정이라 reset()이 지우지 않는다 (난이도·소리와 같다). 여기서 명시적으로 끈다
    useMemoryRoomStore.setState({ autoPlay: false });
    render(<DialogueBox />);
    openBallDialogue();
    typeOut();
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(useMemoryRoomStore.getState().activeInteraction?.lineIndex).toBe(0);
  });

  it("로그가 떠 있는 동안에는 오토가 멈춘다", () => {
    useMemoryRoomStore.setState({ autoPlay: true });
    render(
      <>
        <DialogueBox />
        <DialogueLog />
      </>,
    );
    openBallDialogue();
    typeOut();

    fireEvent.click(screen.getByRole("button", { name: "지나간 대사 보기" }));
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(useMemoryRoomStore.getState().activeInteraction?.lineIndex).toBe(0);
    // 로그를 닫으면 다시 흐른다
    fireEvent.click(screen.getAllByRole("button", { name: "닫기" })[0]);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(useMemoryRoomStore.getState().activeInteraction?.lineIndex).toBe(1);
  });
});
