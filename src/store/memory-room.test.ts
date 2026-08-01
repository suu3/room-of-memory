import { beforeEach, describe, expect, it } from "vitest";
import { selectSceneInputLocked, useMemoryRoomStore } from "./memory-room";

describe("scene input locks", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("stays locked until every UI source closes", () => {
    const store = useMemoryRoomStore.getState();
    store.setUiLock("hud-menu", true);
    store.setUiLock("memory-panel", true);
    store.setUiLock("hud-menu", false);
    expect(selectSceneInputLocked(useMemoryRoomStore.getState())).toBe(true);
    store.setUiLock("memory-panel", false);
    expect(selectSceneInputLocked(useMemoryRoomStore.getState())).toBe(false);
  });
});
