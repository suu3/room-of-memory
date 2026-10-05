/** @vitest-environment jsdom */

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoryRoomStore } from "@/store/memory-room";
import { RoomCallout } from "./RoomCallout";

// 액자가 열리는 조건은 스토어의 몫이다. 여기서는 "열렸다"만 받는다
vi.mock("@/store/memory-room", async (original) => ({
  ...(await original<typeof import("@/store/memory-room")>()),
  hotspotStatus: () => "available",
}));

describe("RoomCallout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useMemoryRoomStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useMemoryRoomStore.getState().reset();
  });

  it("방 밖에서 한 줄이 떴다가 스스로 사라지고, 다시 뜨지 않는다", () => {
    act(() => useMemoryRoomStore.setState({ space: "living" }));
    const { container } = render(<RoomCallout />);
    expect(container.querySelector("p")).not.toBeNull();

    act(() => vi.advanceTimersByTime(5000));
    expect(container.querySelector("p")).toBeNull();

    act(() => useMemoryRoomStore.setState({ space: "room" }));
    act(() => useMemoryRoomStore.setState({ space: "living" }));
    expect(container.querySelector("p")).toBeNull();
  });
});
