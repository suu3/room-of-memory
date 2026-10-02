import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoryRoomStore } from "@/store/memory-room";
import { pressDoor } from "./door-press";

vi.mock("@/lib/audio", () => ({ playSound: vi.fn() }));

describe("문 누르기", () => {
  beforeEach(() => {
    useMemoryRoomStore.getState().reset();
    useMemoryRoomStore.setState({ started: true, introDone: true });
  });

  afterEach(() => {
    useMemoryRoomStore.getState().reset();
  });

  it("라디오 목소리를 듣기 전의 방문은 열리지 않고 안 여는 이유를 흘린다", () => {
    pressDoor("room-living");
    const state = useMemoryRoomStore.getState();
    expect(state.doorOpened).toBe(false);
    expect(state.remark?.id).toBe("door-stay");
  });

  it("라디오 목소리를 들은 뒤의 방문은 열린다", () => {
    useMemoryRoomStore.setState({ revisited: ["radio"] });
    pressDoor("room-living");
    expect(useMemoryRoomStore.getState().doorOpened).toBe(true);
  });

  it("방문이 열린 뒤 화장실 문은 열리고, 열쇠 없는 안방 문은 안 열린다", () => {
    useMemoryRoomStore.setState({ revisited: ["radio"], doorOpened: true, doorwayDone: true });
    pressDoor("living-bathroom");
    pressDoor("living-parents");
    expect(useMemoryRoomStore.getState().openedDoorways).toEqual(["living-bathroom"]);
  });
});
