import { describe, expect, it } from "vitest";
import { tiltFocus } from "./tilt-focus";

describe("tiltFocus", () => {
  it("1막의 흐림이 2막보다 세다", () => {
    expect(tiltFocus(1, false).blurScale).toBeGreaterThan(tiltFocus(2, false).blurScale);
    expect(tiltFocus(2, false).blurScale).toBe(tiltFocus(3, false).blurScale);
  });

  it("서 있으면 띠는 화면 한가운데의 가로 띠다", () => {
    const focus = tiltFocus(1, false);
    expect(focus.offset).toBe(0);
    expect(focus.focusArea).toBeGreaterThan(0);
  });

  it("앉으면 띠가 내려오고 좁아지며 흐림이 는다", () => {
    const standing = tiltFocus(2, false);
    const seated = tiltFocus(2, true);
    expect(seated.offset).toBeLessThan(standing.offset);
    expect(seated.focusArea).toBeLessThan(standing.focusArea);
    expect(seated.blurScale).toBeGreaterThan(standing.blurScale);
  });

  it("띠는 화면 안에 있고, 또렷한 심이 남는다", () => {
    for (const act of [1, 2, 3] as const) {
      for (const seated of [false, true]) {
        const focus = tiltFocus(act, seated);
        expect(focus.offset - focus.focusArea).toBeGreaterThanOrEqual(-1);
        expect(focus.offset + focus.focusArea).toBeLessThanOrEqual(1);
        // feather가 focusArea보다 크면 심이 0이 되어 어디도 또렷하지 않다
        expect(focus.feather).toBeLessThan(focus.focusArea);
        expect(focus.feather).toBeGreaterThan(0);
      }
    }
  });
});
