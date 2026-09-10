/** @vitest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoryRoomStore } from "@/store/memory-room";
import { useSkipEligible } from "./shell";

/** 훅의 판정을 글자로 내보내는 탐침: 스킵 버튼이 뜰지 말지를 정하는 값 그대로다. */
function SkipProbe() {
  const eligible = useSkipEligible(1000);
  return <output>{eligible ? "skip-open" : "skip-hidden"}</output>;
}

describe("useSkipEligible의 난이도 게이트", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useMemoryRoomStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useMemoryRoomStore.getState().reset();
  });

  it("이지 모드에서는 시간이 지나면 스킵이 열린다", () => {
    useMemoryRoomStore.setState({ difficulty: "easy" });
    render(<SkipProbe />);
    expect(screen.getByText("skip-hidden")).toBeTruthy();

    act(() => vi.advanceTimersByTime(1100));

    expect(screen.getByText("skip-open")).toBeTruthy();
  });

  it("보통 모드에서는 시간이 아무리 지나도 스킵이 없다", () => {
    useMemoryRoomStore.setState({ difficulty: "normal" });
    render(<SkipProbe />);

    act(() => vi.advanceTimersByTime(600_000));

    expect(screen.getByText("skip-hidden")).toBeTruthy();
  });

  it("게임 중에 난이도를 바꾸면 그 자리에서 반영된다", () => {
    // 메뉴는 플레이 중에도 열린다. 막힌 사람이 이지로 내리는 것이 이 설정의 존재 이유다
    useMemoryRoomStore.setState({ difficulty: "normal" });
    render(<SkipProbe />);
    act(() => vi.advanceTimersByTime(1100));
    expect(screen.getByText("skip-hidden")).toBeTruthy();

    act(() => useMemoryRoomStore.getState().setDifficulty("easy"));

    expect(screen.getByText("skip-open")).toBeTruthy();
  });
});
