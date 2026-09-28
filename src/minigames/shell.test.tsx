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

describe("useSkipEligible", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useMemoryRoomStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useMemoryRoomStore.getState().reset();
  });

  it.each(["guided", "normal"] as const)("%s 모드에서도 시간이 지나면 스킵이 열린다", (mode) => {
    useMemoryRoomStore.setState({ difficulty: mode });
    render(<SkipProbe />);
    expect(screen.getByText("skip-hidden")).toBeTruthy();

    act(() => vi.advanceTimersByTime(1100));

    expect(screen.getByText("skip-open")).toBeTruthy();
  });
});
