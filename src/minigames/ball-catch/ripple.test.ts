import { describe, expect, it } from "vitest";
import {
  lifeMs,
  pruneRipples,
  RIPPLE_LIFE_FAST_MS,
  RIPPLE_LIFE_SLOW_MS,
  rippleAlpha,
  rippleBlotAlpha,
  rippleDecayFromLevel,
  rippleRadius,
} from "./ripple";

describe("lifeMs", () => {
  it("spans the slow end at decay 0 and the fast end at decay 1", () => {
    expect(lifeMs(0)).toBe(RIPPLE_LIFE_SLOW_MS);
    expect(lifeMs(1)).toBe(RIPPLE_LIFE_FAST_MS);
    expect(lifeMs(0.5)).toBeCloseTo((RIPPLE_LIFE_SLOW_MS + RIPPLE_LIFE_FAST_MS) / 2);
  });

  it("clamps out-of-range decay", () => {
    expect(lifeMs(-2)).toBe(RIPPLE_LIFE_SLOW_MS);
    expect(lifeMs(7)).toBe(RIPPLE_LIFE_FAST_MS);
    expect(lifeMs(Number.NaN)).toBe(RIPPLE_LIFE_SLOW_MS);
  });
});

describe("rippleRadius", () => {
  it("starts at zero, grows fast first and eases toward one", () => {
    expect(rippleRadius(0, 0)).toBe(0);
    const early = rippleRadius(200, 0);
    const mid = rippleRadius(400, 0) - early;
    expect(early).toBeGreaterThan(mid);
    expect(rippleRadius(5000, 0)).toBeGreaterThan(0.99);
    expect(rippleRadius(5000, 0)).toBeLessThanOrEqual(1);
  });

  it("spreads quicker when decay is higher so short ripples still open", () => {
    expect(rippleRadius(150, 1)).toBeGreaterThan(rippleRadius(150, 0));
  });

  it("treats a negative age as newborn", () => {
    expect(rippleRadius(-40, 0.5)).toBe(0);
  });
});

describe("rippleAlpha", () => {
  it("is one at birth and 1/e after one lifetime", () => {
    expect(rippleAlpha(0, 0.3)).toBe(1);
    expect(rippleAlpha(lifeMs(0.3), 0.3)).toBeCloseTo(1 / Math.E);
  });

  it("fades faster in a darker room", () => {
    expect(rippleAlpha(400, 1)).toBeLessThan(rippleAlpha(400, 0));
  });

  it("keeps the central blot ahead of the rings", () => {
    expect(rippleBlotAlpha(300, 0.5)).toBeLessThan(rippleAlpha(300, 0.5));
    expect(rippleBlotAlpha(0, 0.5)).toBe(1);
  });
});

describe("rippleDecayFromLevel", () => {
  it("maps the brightest room to no extra decay and the darkest to full decay", () => {
    expect(rippleDecayFromLevel(1)).toBeCloseTo(0);
    expect(rippleDecayFromLevel(0)).toBeCloseTo(1);
  });

  it("grows monotonically as the room gets darker", () => {
    const levels = [1, 0.85, 0.62, 0.4, 0.2, 0.09, 0];
    const decays = levels.map(rippleDecayFromLevel);
    for (let index = 1; index < decays.length; index += 1) {
      expect(decays[index]).toBeGreaterThan(decays[index - 1]);
    }
  });

  it("stays inside 0..1 for out-of-range or invalid input", () => {
    expect(rippleDecayFromLevel(3)).toBeCloseTo(0);
    expect(rippleDecayFromLevel(-1)).toBeCloseTo(1);
    expect(rippleDecayFromLevel(Number.NaN)).toBeCloseTo(1);
  });
});

describe("pruneRipples", () => {
  it("drops ripples whose alpha fell under the dead threshold and keeps the rest", () => {
    const ripples = [
      { x: 0.5, y: 0.68, bornAt: 0 },
      { x: 0.4, y: 0.68, bornAt: 6000 },
      { x: 0.6, y: 0.68, bornAt: 7000 },
    ];
    const alive = pruneRipples(ripples, 7100, 0);
    expect(alive).toEqual([ripples[1], ripples[2]]);
    // 원본은 그대로다
    expect(ripples).toHaveLength(3);
  });

  it("prunes sooner when decay is high", () => {
    const ripples = [{ x: 0.5, y: 0.68, bornAt: 0 }];
    const now = RIPPLE_LIFE_FAST_MS * 5;
    expect(pruneRipples(ripples, now, 1)).toHaveLength(0);
    expect(pruneRipples(ripples, now, 0)).toHaveLength(1);
  });
});
