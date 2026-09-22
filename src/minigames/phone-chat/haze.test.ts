import { describe, expect, it } from "vitest";
import { HAZE_DEPTH, MAX_BLUR_PX, messageBlurPx } from "./haze";

describe("phone-chat haze", () => {
  it("blurs the newest line the most and only as much as the room is dark", () => {
    expect(messageBlurPx(0, 8, 1)).toBe(MAX_BLUR_PX);
    expect(messageBlurPx(0, 8, 0.5)).toBeCloseTo(MAX_BLUR_PX / 2, 5);
    // 밝은 방에서는 아무 줄도 번지지 않는다
    expect(messageBlurPx(0, 8, 0)).toBe(0);
    expect(messageBlurPx(3, 8, 0)).toBe(0);
  });

  it("falls off linearly toward the past and reaches zero by HAZE_DEPTH", () => {
    const newest = messageBlurPx(0, 20, 1);
    const one = messageBlurPx(1, 20, 1);
    const two = messageBlurPx(2, 20, 1);
    expect(one).toBeLessThan(newest);
    expect(two).toBeLessThan(one);
    // 같은 간격으로 줄어든다 (선형)
    expect(newest - one).toBeCloseTo(one - two, 1);
    expect(messageBlurPx(HAZE_DEPTH, 20, 1)).toBe(0);
    expect(messageBlurPx(HAZE_DEPTH + 5, 20, 1)).toBe(0);
  });

  it("never exceeds the readable ceiling, whatever dim is fed in", () => {
    // 최근 줄은 플레이어가 지금 읽는 줄이다: 어둠이 넘쳐도 상한에서 멈춘다
    expect(messageBlurPx(0, 8, 4)).toBe(MAX_BLUR_PX);
    expect(messageBlurPx(0, 8, -1)).toBe(0);
    expect(messageBlurPx(0, 8, Number.NaN)).toBe(0);
    for (let index = 0; index < 8; index += 1) {
      expect(messageBlurPx(index, 8, 1)).toBeLessThanOrEqual(MAX_BLUR_PX);
      expect(messageBlurPx(index, 8, 1)).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns zero for an empty list or an index outside it", () => {
    expect(messageBlurPx(0, 0, 1)).toBe(0);
    expect(messageBlurPx(-1, 8, 1)).toBe(0);
    expect(messageBlurPx(8, 8, 1)).toBe(0);
    expect(messageBlurPx(0, Number.NaN, 1)).toBe(0);
  });
});
