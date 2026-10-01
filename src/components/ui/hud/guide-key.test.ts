import { describe, expect, it } from "vitest";
import { type GuideState, guideKeyOf, isGenericGuide } from "./guide-key";

const IDLE: GuideState = {
  viewpoint: null,
  exitReady: false,
  packing: false,
  doorOpened: false,
  doorReady: false,
  onboarding: null,
};

describe("guideKeyOf", () => {
  it("걸리는 것이 없으면 조사하라고 한다", () => {
    expect(guideKeyOf(IDLE)).toBe("hud.guide.examine");
  });

  it.each([
    [{ viewpoint: "intro" }, "hud.guide.lights"],
    [{ viewpoint: "doorway" }, "hud.guide.doorway"],
    [{ exitReady: true }, "hud.guide.exit"],
    [{ packing: true }, "hud.guide.pack"],
    [{ doorOpened: true }, "hud.guide.revisit"],
    [{ doorReady: true }, "hud.guide.door"],
    [{ onboarding: "workbook" }, "hud.guide.workbook"],
    [{ onboarding: "notebook" }, "hud.guide.notebook"],
  ] as const)("%o → %s", (patch, key) => {
    expect(guideKeyOf({ ...IDLE, ...patch })).toBe(key);
  });

  it("1인칭 구간은 다른 모든 목표를 앞선다", () => {
    const everything = { ...IDLE, exitReady: true, packing: true, doorOpened: true };
    expect(guideKeyOf({ ...everything, viewpoint: "intro" })).toBe("hud.guide.lights");
    expect(guideKeyOf({ ...everything, viewpoint: "doorway" })).toBe("hud.guide.doorway");
  });

  it("현관을 나서는 1인칭(exit)은 목표를 바꾸지 않는다", () => {
    expect(guideKeyOf({ ...IDLE, viewpoint: "exit", exitReady: true })).toBe("hud.guide.exit");
  });

  it("조건이 겹치면 이야기의 늦은 단계가 이긴다", () => {
    const late = { ...IDLE, doorReady: true, doorOpened: true };
    expect(guideKeyOf(late)).toBe("hud.guide.revisit");
    expect(guideKeyOf({ ...late, packing: true })).toBe("hud.guide.pack");
    expect(guideKeyOf({ ...late, packing: true, exitReady: true })).toBe("hud.guide.exit");
  });

  it("방문이 준비되면 첫 두 걸음 안내보다 문이 먼저다", () => {
    expect(guideKeyOf({ ...IDLE, doorReady: true, onboarding: "notebook" })).toBe("hud.guide.door");
  });
});

describe("isGenericGuide", () => {
  it("조사·재조사만 뭉뚱그린 목표다", () => {
    expect(isGenericGuide("hud.guide.examine")).toBe(true);
    expect(isGenericGuide("hud.guide.revisit")).toBe(true);
    expect(isGenericGuide("hud.guide.pack")).toBe(false);
    expect(isGenericGuide("hud.guide.door")).toBe(false);
  });
});
