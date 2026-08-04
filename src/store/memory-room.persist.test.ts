import { describe, expect, it } from "vitest";
import { MEMORIES } from "@/data/memory-room";
import { sanitizeProgress } from "./memory-room";

const [first, second] = MEMORIES.map((memory) => memory.id);

describe("sanitizeProgress", () => {
  it("keeps a well-formed save as-is", () => {
    expect(
      sanitizeProgress({
        collected: [first, second],
        revisited: [first],
        endingStarted: false,
        soundMuted: true,
        lightsOn: false,
      }),
    ).toEqual({
      collected: [first, second],
      revisited: [first],
      endingStarted: false,
      soundMuted: true,
      lightsOn: false,
    });
  });

  it("drops ids that no longer exist", () => {
    // 저장 뒤에 기억 목록이 바뀌면 없는 id가 남는다. 그대로 세면 수집 개수가
    // 실제보다 많아져 엔딩이 잘못 열린다.
    const result = sanitizeProgress({ collected: [first, "ghost-memory"], revisited: ["ghost"] });
    expect(result.collected).toEqual([first]);
    expect(result.revisited).toEqual([]);
  });

  it("removes duplicates so counts stay honest", () => {
    expect(sanitizeProgress({ collected: [first, first, second] }).collected).toEqual([
      first,
      second,
    ]);
  });

  it("never lets a revisit outrun its first pass", () => {
    // 2바퀴는 1바퀴를 마친 기억에만 붙는다
    expect(sanitizeProgress({ collected: [first], revisited: [first, second] }).revisited).toEqual([
      first,
    ]);
  });

  it("refuses an ending that the save has not earned", () => {
    expect(sanitizeProgress({ collected: [first], endingStarted: true }).endingStarted).toBe(false);
    expect(
      sanitizeProgress({
        collected: MEMORIES.map((memory) => memory.id),
        endingStarted: true,
      }).endingStarted,
    ).toBe(true);
  });

  it("leaves the lights on unless the save says otherwise", () => {
    // 불은 켜진 게 기본이다 — 저장본에 없거나 깨졌다고 어두운 방으로 떨어지면 안 된다
    expect(sanitizeProgress({}).lightsOn).toBe(true);
    expect(sanitizeProgress({ lightsOn: "nope" }).lightsOn).toBe(true);
    expect(sanitizeProgress({ lightsOn: false }).lightsOn).toBe(false);
  });

  it("survives garbage instead of breaking the game", () => {
    // 저장본이 깨졌다고 플레이를 막는 쪽이 더 나쁘다
    expect(sanitizeProgress(null)).toEqual({});
    expect(sanitizeProgress("nope")).toEqual({});
    expect(sanitizeProgress({ collected: "not-an-array" }).collected).toEqual([]);
    expect(sanitizeProgress({}).collected).toEqual([]);
  });
});
