import { describe, expect, it } from "vitest";
import { radioSignalLevel } from "./radio-signal";

const SAMPLES = Array.from({ length: 2000 }, (_, index) => radioSignalLevel(index * 0.01));

describe("저 혼자 깨어난 라디오의 깜빡임", () => {
  it("값이 0~1 안에 머문다 — 이미시브가 발광으로 튀지 않는다", () => {
    for (const level of SAMPLES) {
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
  });

  it("대부분의 시간은 꺼져 있다 — 표시등이 아니라 기척이다", () => {
    const lit = SAMPLES.filter((level) => level > 0.2).length;

    expect(lit / SAMPLES.length).toBeLessThan(0.35);
  });

  it("그래도 확실히 보이는 봉우리가 있다", () => {
    expect(Math.max(...SAMPLES)).toBeGreaterThan(0.8);
  });

  it("같은 시각이면 같은 값 — 프레임마다 값이 튀지 않는다", () => {
    expect(radioSignalLevel(3.5)).toBe(radioSignalLevel(3.5));
  });
});
