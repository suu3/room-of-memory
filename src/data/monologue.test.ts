import { describe, expect, it } from "vitest";
import { ACT2_CHAIN, type MemoryId, PHASE1_MEMORIES, PHASE2_MEMORIES } from "./memory-room";
import { MONOLOGUE_IDS, monologueIdFor } from "./monologue";

const phase1 = PHASE1_MEMORIES.map((memory) => memory.id);
const phase2 = PHASE2_MEMORIES.map((memory) => memory.id);
/** 라디오를 맨 앞에: 2바퀴는 목소리를 잡는 것에서 시작한다. */
const phase2Order: MemoryId[] = [
  "radio" as MemoryId,
  ...phase2.filter((id) => id !== ("radio" as MemoryId)),
];

describe("monologueIdFor", () => {
  it("1바퀴는 개수마다 내려가다 완주에서 바닥을 찍는다", () => {
    expect(monologueIdFor({ collected: [], revisited: [], doorOpened: false })).toBe("p1-0");
    expect(
      monologueIdFor({ collected: phase1.slice(0, 2), revisited: [], doorOpened: false }),
    ).toBe("p1-1");
    expect(
      monologueIdFor({ collected: phase1.slice(0, 4), revisited: [], doorOpened: false }),
    ).toBe("p1-3");
    expect(
      monologueIdFor({ collected: phase1.slice(0, 6), revisited: [], doorOpened: false }),
    ).toBe("p1-5");
    // "다 봤는데, 방은 더 어두워졌다"는 7/7에 닿았을 때만
    expect(monologueIdFor({ collected: phase1, revisited: [], doorOpened: false })).toBe("p1-7");
  });

  it("목소리를 잡으면 바닥 줄이 걷히고, 문이 열리면 2바퀴 줄이 올라간다", () => {
    expect(
      monologueIdFor({ collected: phase1, revisited: ["radio" as MemoryId], doorOpened: false }),
    ).toBe("p2-0");
    expect(
      monologueIdFor({ collected: phase1, revisited: phase2Order.slice(0, 1), doorOpened: true }),
    ).toBe("p2-1");
    expect(
      monologueIdFor({ collected: phase1, revisited: phase2Order.slice(0, 5), doorOpened: true }),
    ).toBe("p2-4");
    expect(
      monologueIdFor({ collected: phase1, revisited: phase2Order.slice(0, 9), doorOpened: true }),
    ).toBe("p2-8");
    expect(monologueIdFor({ collected: phase1, revisited: phase2, doorOpened: true })).toBe(
      "p2-11",
    );
  });

  it("13번의 조사 동안 줄이 여덟 번 넘게 바뀐다", () => {
    const seen = new Set<string>();
    for (let n = 0; n <= phase1.length; n += 1) {
      seen.add(monologueIdFor({ collected: phase1.slice(0, n), revisited: [], doorOpened: false }));
    }
    for (let n = 1; n <= phase2Order.length; n += 1) {
      seen.add(
        monologueIdFor({
          collected: phase1,
          revisited: phase2Order.slice(0, n),
          doorOpened: n >= 1,
        }),
      );
    }
    expect(seen.size).toBeGreaterThanOrEqual(9);
    // 필수 체인만 돌아 3막에 닿은 사람도 어딘가 상승 구간에 서 있다
    expect(
      monologueIdFor({ collected: phase1, revisited: [...ACT2_CHAIN], doorOpened: true }),
    ).toMatch(/^p2-/);
  });

  it("모든 구간 id가 실제로 쓰인다", () => {
    const used = new Set<string>();
    for (let n = 0; n <= phase1.length; n += 1) {
      used.add(monologueIdFor({ collected: phase1.slice(0, n), revisited: [], doorOpened: false }));
    }
    for (let n = 1; n <= phase2Order.length; n += 1) {
      used.add(
        monologueIdFor({
          collected: phase1,
          revisited: phase2Order.slice(0, n),
          doorOpened: false,
        }),
      );
      used.add(
        monologueIdFor({ collected: phase1, revisited: phase2Order.slice(0, n), doorOpened: true }),
      );
    }
    for (const id of MONOLOGUE_IDS) expect(used.has(id)).toBe(true);
  });
});
