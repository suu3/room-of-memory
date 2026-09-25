import { describe, expect, it } from "vitest";
import { BLOT_ALPHA, blotAlpha, gatherProgress, NOTE_BLUR_MAX_PX, noteBlurPx } from "./sheet-ink";

describe("sheet-ink", () => {
  it("모임은 0에서 시작해 정해진 시간에 1로 끝난다", () => {
    expect(gatherProgress(0, 1.5)).toBe(0);
    expect(gatherProgress(1.5, 1.5)).toBe(1);
    expect(gatherProgress(9, 1.5)).toBe(1);
    expect(gatherProgress(-1, 1.5)).toBe(0);
  });

  it("끝에서 느려진다 (ease-out): 절반 시간에 절반보다 많이 모여 있다", () => {
    expect(gatherProgress(0.75, 1.5)).toBeGreaterThan(0.5);
  });

  it("모일수록 번짐이 걷히고 얼룩이 옅어진다", () => {
    expect(noteBlurPx(0)).toBe(NOTE_BLUR_MAX_PX);
    expect(noteBlurPx(1)).toBe(0);
    expect(blotAlpha(0)).toBe(BLOT_ALPHA);
    expect(blotAlpha(1)).toBe(0);
    expect(noteBlurPx(0.3)).toBeGreaterThan(noteBlurPx(0.7));
  });
});
