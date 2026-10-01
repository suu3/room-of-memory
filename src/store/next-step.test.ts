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

/** 3페이즈의 필수 조사를 다 마쳤는데 아직 안방 열쇠가 없는 자리. 세면대의 배지는 봤다. */
const P3_DONE = {
  openedDoorways: ["living-bathroom"],
  inventory: [],
  solvedPuzzles: [],
  sinkDrained: true,
  discoveries: ["hero-name", "raon-badge"],
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

  it("3페이즈에 화장실에 들어서면 세면대의 물을 빼라고 짚고, 뺀 뒤에는 배지가 스스로 부른다", () => {
    const inBathroom = {
      ...progressAt("p3"),
      revisited: [...progressAt("p3").revisited, "ampoule"],
      openedDoorways: ["living-bathroom"],
      sinkDrained: false,
      discoveries: ["hero-name"],
    };
    expect(stepAt("p3", inBathroom)).toEqual({ kind: "sink-drain" });
    // 물을 뺐으면 금빛 배지가 다음 자리를 말한다: 목표 줄은 더 짚지 않는다 (곁가지가 있으면 그쪽)
    expect(stepAt("p3", { ...inBathroom, sinkDrained: true })?.kind).not.toBe("sink-drain");
    // 화장실 문을 열기 전에는 그 문이 먼저다
    expect(stepAt("p3", { ...inBathroom, openedDoorways: [] })).toEqual({
      kind: "doorway",
      doorway: "living-bathroom",
      to: "bathroom",
    });
  });

  it("안방 열쇠 매듭: 선반의 책 → 하부장 → 안방 문", () => {
    expect(stepAt("p4", P3_DONE)).toEqual({ kind: "shelf-book" });
    expect(
      stepAt("p4", { ...P3_DONE, discoveries: ["hero-name", "raon-badge", "sink-code"] }),
    ).toEqual({
      kind: "sink-dial",
    });
    expect(
      stepAt("p4", {
        ...P3_DONE,
        discoveries: ["hero-name", "raon-badge", "sink-code"],
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
