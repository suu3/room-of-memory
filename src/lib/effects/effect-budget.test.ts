import { describe, expect, it } from "vitest";
import { effectEnabled, effectTier } from "./effect-budget";

describe("effectTier", () => {
  it("모션을 끈 사람은 기기가 무엇이든 off다", () => {
    expect(effectTier({ reducedMotion: true, degraded: false, touch: false })).toBe("off");
    expect(effectTier({ reducedMotion: true, degraded: true, touch: true })).toBe("off");
  });

  it("프레임이 떨어졌거나 손가락 기기면 low다", () => {
    expect(effectTier({ reducedMotion: false, degraded: true, touch: false })).toBe("low");
    expect(effectTier({ reducedMotion: false, degraded: false, touch: true })).toBe("low");
  });

  it("나머지는 full이다", () => {
    expect(effectTier({ reducedMotion: false, degraded: false, touch: false })).toBe("full");
  });
});

describe("effectEnabled", () => {
  it("off에서는 아무것도 켜지지 않는다", () => {
    expect(effectEnabled("off", "cheap")).toBe(false);
    expect(effectEnabled("off", "heavy")).toBe(false);
  });

  it("low에서는 싼 것만 켜진다", () => {
    expect(effectEnabled("low", "cheap")).toBe(true);
    expect(effectEnabled("low", "heavy")).toBe(false);
  });

  it("full에서는 전부 켜진다", () => {
    expect(effectEnabled("full", "heavy")).toBe(true);
  });
});
