/** @vitest-environment jsdom */

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoryRoomStore } from "@/store/memory-room";
import { transitionTone, ViewpointTransition } from "./ViewpointTransition";

function cover(container: HTMLElement) {
  return container.querySelector("div[aria-hidden]");
}

/** 시점을 1인칭(인트로)으로 넘긴다. 덮개는 이 변화를 구독해서 뜬다. */
function enterFirstPerson() {
  act(() => {
    useMemoryRoomStore.setState({ started: true, introDone: false });
  });
}

describe("시점 전환 덮개", () => {
  beforeEach(() => {
    useMemoryRoomStore.getState().reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    useMemoryRoomStore.getState().reset();
  });

  it("어느 색이 덮는지는 오가는 방향이 정한다", () => {
    expect(transitionTone(null, "intro")).toBe("enter");
    expect(transitionTone(null, "doorway")).toBe("enter");
    expect(transitionTone("intro", null)).toBe("lightsOn");
    expect(transitionTone("doorway", null)).toBe("doorway");
    expect(transitionTone(null, null)).toBeNull();
    expect(transitionTone("intro", "intro")).toBeNull();
  });

  it("프레임이 돌아오기 전에는 꽉 닫힌 채 버틴다", () => {
    const { container } = render(<ViewpointTransition />);
    enterFirstPerson();

    const panel = cover(container);
    expect(panel).not.toBeNull();
    // 걷히는 애니메이션이 아직 안 붙었다: 시계가 아니라 프레임을 기다리는 중이다
    expect(panel?.className).toContain("opacity-100");
    expect(panel?.className).not.toContain("animate-viewpoint-fade");
  });

  it("프레임이 돌아오고 최소 시간이 지나면 걷힌다", () => {
    const { container } = render(<ViewpointTransition />);
    enterFirstPerson();

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(cover(container)?.className).toContain("animate-viewpoint-fade");

    // 걷는 시간이 다 지나면 덮개 자체가 사라진다
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(cover(container)).toBeNull();
  });
});
