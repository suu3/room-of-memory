import { describe, expect, it } from "vitest";
import { AFTERIMAGE_DAMP, afterimageDamp, movementSpeed } from "./afterimage";

describe("afterimage", () => {
  it("서 있으면 짧고 걸으면 길다", () => {
    expect(afterimageDamp(0)).toBe(AFTERIMAGE_DAMP[0]);
    expect(afterimageDamp(1)).toBe(AFTERIMAGE_DAMP[1]);
    expect(afterimageDamp(0.5)).toBeGreaterThan(afterimageDamp(0.2));
  });

  it("damp는 1보다 작다: 화면은 언제나 현재로 수렴한다", () => {
    expect(afterimageDamp(5)).toBeLessThan(1);
    expect(afterimageDamp(Number.NaN)).toBe(AFTERIMAGE_DAMP[0]);
  });

  it("대각선 입력도 속도 1을 넘지 않는다", () => {
    expect(movementSpeed({ horizontal: 1, vertical: 1 })).toBe(1);
    expect(movementSpeed({ horizontal: 0, vertical: 0 })).toBe(0);
    expect(movementSpeed({ horizontal: 0.6, vertical: 0 })).toBeCloseTo(0.6);
  });
});
