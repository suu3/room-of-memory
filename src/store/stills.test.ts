import { beforeEach, describe, expect, it } from "vitest";
import { MEMORY_BY_ID } from "@/data/memory-room";
import { buildMemoryReplay, useMemoryRoomStore } from "./memory-room";
import { stillKeyOf, useStillStore } from "./stills";

const SHOT = "data:image/jpeg;base64,AAAA";

describe("captured stills", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  // 식탁 쪽지(card-flip)는 2페이즈 3D 인스펙트다. 미리 그린 스틸이 없다
  const openNote = () =>
    useMemoryRoomStore.setState({
      collected: [
        "report-card",
        "console",
        "ball",
        "frame",
        "phone",
        "calendar",
        "window",
        "radio",
      ],
      revisited: ["radio"],
      doorOpened: true,
    });

  it("keeps the still a cleared minigame hands over, keyed by memory and visit", () => {
    openNote();
    useMemoryRoomStore.getState().beginInteraction("cards");
    // 진입 대사를 넘겨 판으로
    while (useMemoryRoomStore.getState().activeInteraction?.phase === "dialogue") {
      useMemoryRoomStore.getState().advanceDialogue();
    }
    expect(useMemoryRoomStore.getState().activeInteraction?.phase).toBe("minigame");
    useMemoryRoomStore.getState().finishMinigame({ cleared: true, still: SHOT });

    expect(useStillStore.getState().stills[stillKeyOf("cards", 2)]).toBe(SHOT);
  });

  it("does not keep a still from a failed run", () => {
    openNote();
    useMemoryRoomStore.getState().beginInteraction("cards");
    while (useMemoryRoomStore.getState().activeInteraction?.phase === "dialogue") {
      useMemoryRoomStore.getState().advanceDialogue();
    }
    useMemoryRoomStore.getState().finishMinigame({ cleared: false, still: SHOT });
    expect(useStillStore.getState().stills).toEqual({});
  });

  it("replays the captured still when no drawn still exists, but a drawn one wins", () => {
    expect(MEMORY_BY_ID.cards.phase2?.replayStill).toBeUndefined();
    expect(buildMemoryReplay("cards", 2, SHOT)?.cuts[0].image).toBe(SHOT);

    const drawn = MEMORY_BY_ID.window.phase1?.replayStill;
    expect(drawn).toBeDefined();
    expect(buildMemoryReplay("window", 1, SHOT)?.cuts[0].image).toBe(drawn);
  });

  it("clears the stills on a new game", () => {
    useStillStore.getState().putStill("cards:2", SHOT);
    useMemoryRoomStore.getState().reset();
    expect(useStillStore.getState().stills).toEqual({});
  });
});
