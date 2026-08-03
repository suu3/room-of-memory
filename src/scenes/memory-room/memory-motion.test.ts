import { describe, expect, it } from "vitest";
import {
  approach,
  HOVER_LIFT,
  HOVER_SCALE,
  memoryMotion,
  PUNCH_DURATION,
  punchScale,
} from "./memory-motion";

describe("memory hover/click motion", () => {
  it("settles the punch back to rest and stays there", () => {
    expect(punchScale(0)).toBe(1);
    expect(punchScale(PUNCH_DURATION)).toBe(1);
    expect(punchScale(PUNCH_DURATION + 5)).toBe(1);
    expect(punchScale(-1)).toBe(1);
  });

  it("presses in first, then overshoots back out", () => {
    // 앞쪽 절반은 눌리고(1보다 작고) 뒤쪽 절반은 튀어오른다(1보다 크다)
    expect(punchScale(PUNCH_DURATION * 0.25)).toBeLessThan(1);
    expect(punchScale(PUNCH_DURATION * 0.75)).toBeGreaterThan(1);
    // 되튐은 눌림보다 약해야 한다 — 안 그러면 물건이 부풀어 보인다
    const press = 1 - punchScale(PUNCH_DURATION * 0.25);
    const bounce = punchScale(PUNCH_DURATION * 0.75) - 1;
    expect(bounce).toBeLessThan(press);
  });

  it("lifts and grows only while hovered", () => {
    const rest = memoryMotion(0, PUNCH_DURATION);
    expect(rest.lift).toBe(0);
    expect(rest.scale).toBe(1);

    const hovered = memoryMotion(1, PUNCH_DURATION);
    expect(hovered.lift).toBeCloseTo(HOVER_LIFT);
    expect(hovered.scale).toBeCloseTo(1 + HOVER_SCALE);

    // 중간 강도는 그 사이에 있다 (전환이 뚝 끊기지 않는다)
    const half = memoryMotion(0.5, PUNCH_DURATION);
    expect(half.lift).toBeGreaterThan(rest.lift);
    expect(half.lift).toBeLessThan(hovered.lift);
  });

  it("keeps the lift subtle enough that objects do not float", () => {
    expect(HOVER_LIFT).toBeLessThan(0.12);
    expect(HOVER_SCALE).toBeLessThan(0.12);
  });

  it("damps toward the target without overshooting", () => {
    let value = 0;
    for (let step = 0; step < 200; step += 1) value = approach(value, 1, 10, 1 / 60);
    expect(value).toBeCloseTo(1, 4);
    expect(value).toBeLessThanOrEqual(1);
    // 프레임이 길어져도 목표를 넘지 않는다
    expect(approach(0, 1, 10, 10)).toBeLessThanOrEqual(1);
  });
});
