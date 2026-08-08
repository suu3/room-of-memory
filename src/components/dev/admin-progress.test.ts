import { describe, expect, it } from "vitest";
import { MEMORY_BY_ID } from "@/data/memory-room";
import { sanitizeProgress } from "@/store/memory-room";
import { type AdminMemoryState, cycleMemory, memoryStage, stagesOf } from "./admin-progress";

const EMPTY: AdminMemoryState = { collected: [], revisited: [] };

describe("stagesOf", () => {
  it("offers all three stages for a memory with both phases", () => {
    expect(stagesOf("console")).toEqual(["none", "collected", "revisited"]);
  });

  it("skips the collected stage for a memory with no phase 1", () => {
    // 컴퓨터는 1바퀴가 없다 — collected에 들어갈 길 자체가 없어야 한다
    expect(MEMORY_BY_ID.computer.phase1).toBeUndefined();
    expect(stagesOf("computer")).toEqual(["none", "revisited"]);
  });
});

describe("cycleMemory", () => {
  it("walks none -> collected -> revisited -> none", () => {
    const once = cycleMemory(EMPTY, "console");
    expect(memoryStage(once, "console")).toBe("collected");

    const twice = cycleMemory(once, "console");
    expect(memoryStage(twice, "console")).toBe("revisited");
    expect(twice.collected).toContain("console");

    const thrice = cycleMemory(twice, "console");
    expect(memoryStage(thrice, "console")).toBe("none");
    expect(thrice.collected).not.toContain("console");
    expect(thrice.revisited).not.toContain("console");
  });

  it("never produces a revisited memory that was not collected", () => {
    let state = EMPTY;
    for (let turn = 0; turn < 4; turn += 1) {
      state = cycleMemory(state, "radio");
      const revisitedWithoutCollect = state.revisited.filter(
        (id) => MEMORY_BY_ID[id].phase1 && !state.collected.includes(id),
      );
      expect(revisitedWithoutCollect).toEqual([]);
    }
  });

  it("leaves other memories untouched", () => {
    const state = cycleMemory(cycleMemory(EMPTY, "radio"), "phone");
    expect(state.collected).toEqual(["radio", "phone"]);
  });

  it("produces states that survive sanitizeProgress unchanged", () => {
    let state = EMPTY;
    // 모든 기억을 두 번씩 눌러 최대한 진행시킨 뒤, 저장·복원이 이 상태를 깎지 않는지 본다
    for (const id of ["console", "computer", "radio", "phone"] as const) {
      state = cycleMemory(cycleMemory(state, id), id);
    }
    const kept = sanitizeProgress(state);
    expect(new Set(kept.collected)).toEqual(new Set(state.collected));
    expect(new Set(kept.revisited)).toEqual(new Set(state.revisited));
  });
});
