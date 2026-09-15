import { describe, expect, it } from "vitest";
import { burnAmount, tearAmount } from "./ScreenTransition";

describe("tearAmount", () => {
  it("빠르게 꼭대기에 닿고 잦아든 뒤 0에 머문다", () => {
    expect(tearAmount(-1)).toBe(0);
    expect(tearAmount(0)).toBe(0);
    expect(tearAmount(0.15)).toBeCloseTo(1);
    expect(tearAmount(0.4)).toBeGreaterThan(0);
    expect(tearAmount(0.4)).toBeLessThan(1);
    expect(tearAmount(2)).toBe(0);
    expect(tearAmount(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("burnAmount", () => {
  it("천천히 차올라 1에 머문다", () => {
    expect(burnAmount(-1)).toBe(0);
    expect(burnAmount(0)).toBe(0);
    expect(burnAmount(0.75)).toBeCloseTo(0.5);
    expect(burnAmount(1.5)).toBe(1);
    expect(burnAmount(10)).toBe(1);
  });
});
