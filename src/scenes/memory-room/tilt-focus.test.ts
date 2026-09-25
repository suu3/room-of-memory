import { describe, expect, it } from "vitest";
import { tiltFocus } from "./tilt-focus";

describe("tiltFocus", () => {
  it("1막의 흐림이 2막보다 세다", () => {
    expect(tiltFocus(1, false).blur).toBeGreaterThan(tiltFocus(2, false).blur);
    expect(tiltFocus(2, false).blur).toBe(tiltFocus(3, false).blur);
  });

  it("앉으면 띠가 내려오고 좁아지며 흐림이 는다", () => {
    const standing = tiltFocus(2, false);
    const seated = tiltFocus(2, true);
    const center = (focus: { start: number[]; end: number[] }) =>
      (focus.start[1] + focus.end[1]) / 2;
    const width = (focus: { start: number[]; end: number[] }) => focus.end[1] - focus.start[1];
    expect(center(seated)).toBeLessThan(center(standing));
    expect(width(seated)).toBeLessThan(width(standing));
    expect(seated.blur).toBeGreaterThan(standing.blur);
  });

  it("띠는 화면 안에 있다", () => {
    for (const act of [1, 2, 3] as const) {
      for (const seated of [false, true]) {
        const focus = tiltFocus(act, seated);
        expect(focus.start[1]).toBeGreaterThanOrEqual(0);
        expect(focus.end[1]).toBeLessThanOrEqual(1);
        expect(focus.start[1]).toBeLessThan(focus.end[1]);
      }
    }
  });
});
