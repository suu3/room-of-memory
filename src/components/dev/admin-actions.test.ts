import { beforeEach, describe, expect, it } from "vitest";
import { MEMORIES } from "@/data/memory-room";
import { useMemoryRoomStore } from "@/store/memory-room";
import { applyAdminPatch, cycleAdminMemory } from "./admin-actions";

/** 1바퀴에 모을 수 있는 기억 전부 — 방문이 열리는 조건이 이 개수를 다 채우는 것이다. */
const PHASE1_IDS = MEMORIES.filter((memory) => memory.phase1).map((memory) => memory.id);

describe("applyAdminPatch", () => {
  beforeEach(() => {
    useMemoryRoomStore.getState().reset();
  });

  it("writes collected memories into the store", () => {
    applyAdminPatch({ collected: ["radio", "phone"] });
    expect(useMemoryRoomStore.getState().collected).toEqual(["radio", "phone"]);
  });

  it("drops a door opened before phase 1 is finished", () => {
    // sanitizeProgress의 불변식 — 1바퀴를 다 돌기 전에는 방문이 열릴 수 없다
    applyAdminPatch({ collected: ["radio"], doorOpened: true });
    expect(useMemoryRoomStore.getState().doorOpened).toBe(false);
  });

  it("keeps a door opened once phase 1 is finished", () => {
    applyAdminPatch({ collected: PHASE1_IDS, doorOpened: true });
    expect(useMemoryRoomStore.getState().doorOpened).toBe(true);
  });

  it("keeps solved puzzles", () => {
    applyAdminPatch({ solvedPuzzles: ["angle-turn"] });
    expect(useMemoryRoomStore.getState().solvedPuzzles).toEqual(["angle-turn"]);
  });

  it("applies started even though sanitizeProgress does not carry it", () => {
    applyAdminPatch({ started: true });
    expect(useMemoryRoomStore.getState().started).toBe(true);
  });

  it("does not clobber unrelated settings", () => {
    useMemoryRoomStore.setState({ soundMuted: true, lightsOn: false });
    applyAdminPatch({ collected: ["radio"] });
    expect(useMemoryRoomStore.getState().soundMuted).toBe(true);
    expect(useMemoryRoomStore.getState().lightsOn).toBe(false);
  });
});

describe("cycleAdminMemory", () => {
  beforeEach(() => {
    useMemoryRoomStore.getState().reset();
  });

  it("advances one memory a stage at a time", () => {
    cycleAdminMemory("console");
    expect(useMemoryRoomStore.getState().collected).toEqual(["console"]);

    cycleAdminMemory("console");
    expect(useMemoryRoomStore.getState().revisited).toEqual(["console"]);

    cycleAdminMemory("console");
    expect(useMemoryRoomStore.getState().collected).toEqual([]);
    expect(useMemoryRoomStore.getState().revisited).toEqual([]);
  });
});
