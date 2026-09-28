import { beforeEach, describe, expect, it } from "vitest";
import { progressAt } from "@/data/story-phase";
import { useMemoryRoomStore } from "./memory-room";
import { nextStep } from "./next-step";

/** 그 페이즈에 막 들어선 진행 위에 덧칠한 상태의 다음 할 일. */
function stepAt(phase: Parameters<typeof progressAt>[0], extra: object = {}) {
  useMemoryRoomStore.setState({
    ...(progressAt(phase) as object),
    discoveries: ["hero-name"],
    notebookOpened: true,
    ...extra,
  } as never);
  return nextStep(useMemoryRoomStore.getState());
}

/** 3페이즈의 필수 조사를 다 마쳤는데 아직 안방 열쇠가 없는 자리. */
const P3_DONE = {
  openedDoorways: ["living-bathroom"],
  inventory: [],
  solvedPuzzles: [],
};

describe("이지 모드의 다음 할 일", () => {
  beforeEach(() => useMemoryRoomStore.getState().reset());

  it("조사할 기억이 있으면 그 기억과 공간을 짚는다", () => {
    const step = stepAt("p1");
    expect(step).toMatchObject({ kind: "memory", space: "room" });
  });

  it("지금 서 있는 공간의 기억을 먼저 짚는다", () => {
    const inRoom = stepAt("p3", { space: "room" });
    const inLiving = stepAt("p3", { space: "living" });
    expect(inLiving).toMatchObject({ kind: "memory", space: "living" });
    expect(inRoom?.kind).toBe("memory");
  });

  it("안방 열쇠 매듭: 선반의 책 → 하부장 → 안방 문", () => {
    expect(stepAt("p4", P3_DONE)).toEqual({ kind: "shelf-book" });
    expect(stepAt("p4", { ...P3_DONE, discoveries: ["hero-name", "sink-code"] })).toEqual({
      kind: "sink-dial",
    });
    expect(
      stepAt("p4", {
        ...P3_DONE,
        discoveries: ["hero-name", "sink-code"],
        solvedPuzzles: ["sink-dial"],
        inventory: ["parents-key"],
      }),
    ).toEqual({ kind: "doorway", doorway: "living-parents", to: "parents" });
  });

  it("짚을 것이 없으면 null: 목표 줄은 보통 모드의 문장을 그대로 쓴다", () => {
    // 분기점의 정적 구간: 라디오가 아직 말하지 않는다
    expect(stepAt("turning", { signalCaught: false })).toBeNull();
  });
});
