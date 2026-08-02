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

  it("locks scene input for an active interaction without UI locks", () => {
    useMemoryRoomStore.getState().beginInteraction("bat");

    expect(selectSceneInputLocked(useMemoryRoomStore.getState())).toBe(true);
  });

  it("clears UI locks when gameplay progress resets", () => {
    const store = useMemoryRoomStore.getState();
    store.setUiLock("hud-menu", true);
    store.reset();

    expect(selectSceneInputLocked(useMemoryRoomStore.getState())).toBe(false);
    expect(useMemoryRoomStore.getState().uiLocks).toEqual([]);
  });
});

describe("minigame result dialogue", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("plays the result script over the minigame, then completes the memory", () => {
    useMemoryRoomStore.getState().beginInteraction("frame");
    useMemoryRoomStore.getState().finishMinigame({ cleared: true });

    const active = useMemoryRoomStore.getState().activeInteraction;
    expect(active?.phase).toBe("dialogue");
    expect(active?.scriptId).toBe("frame-photo");
    // 미니게임 화면이 대사창 뒤에 남는다
    expect(active?.keepMinigame).toBe(true);

    // 두 줄을 다 넘기면 인터랙션이 끝나고 기억이 수집된다
    useMemoryRoomStore.getState().advanceDialogue();
    expect(useMemoryRoomStore.getState().activeInteraction?.lineIndex).toBe(1);
    useMemoryRoomStore.getState().advanceDialogue();

    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
    expect(useMemoryRoomStore.getState().collected).toEqual(["frame"]);
  });

  it("skips the result script when the minigame is failed", () => {
    useMemoryRoomStore.getState().beginInteraction("frame");
    useMemoryRoomStore.getState().finishMinigame({ cleared: false });

    expect(useMemoryRoomStore.getState().activeInteraction).toBeNull();
    expect(useMemoryRoomStore.getState().collected).toEqual(["frame"]);
  });
});
