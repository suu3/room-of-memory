import { describe, expect, it } from "vitest";
import {
  classifySwing,
  nextPitch,
  PITCH_OFFSET_MAX,
  PITCH_OFFSET_MIN,
  type PitchSide,
  remainingChances,
} from "./timing";

describe("classifySwing", () => {
  const window = [0.78, 1.12] as const;

  it("classifies attempts before, inside, and after the hit window", () => {
    expect(classifySwing(0.77, window)).toBe("early");
    expect(classifySwing(0.78, window)).toBe("hit");
    expect(classifySwing(1.12, window)).toBe("hit");
    expect(classifySwing(1.13, window)).toBe("late");
  });
});

describe("remainingChances", () => {
  it("clamps remaining misses at zero", () => {
    expect(remainingChances(1, 5)).toBe(4);
    expect(remainingChances(7, 5)).toBe(0);
  });
});

describe("nextPitch", () => {
  it("alternates sides so the same angle never repeats", () => {
    let side: PitchSide = 1;
    const sides: PitchSide[] = [];
    for (let round = 0; round < 6; round += 1) {
      const pitch = nextPitch(side, 0.5);
      side = pitch.side;
      sides.push(side);
    }
    expect(sides).toEqual([-1, 1, -1, 1, -1, 1]);
  });

  it("always leaves the mound off-centre by a readable amount", () => {
    // 한가운데(50)에서 던지면 궤적이 늘 같아 타이밍만 외우면 끝난다
    for (const random of [0, 0.25, 0.5, 0.75, 1]) {
      for (const lastSide of [-1, 1] as PitchSide[]) {
        const { startX } = nextPitch(lastSide, random);
        const offset = Math.abs(startX - 50);
        expect(offset).toBeGreaterThanOrEqual(PITCH_OFFSET_MIN);
        expect(offset).toBeLessThanOrEqual(PITCH_OFFSET_MAX);
      }
    }
  });

  it("keeps the ball inside the field at both extremes", () => {
    // 0~100%가 필드 폭이다. 공이 밖에서 출발하면 첫 프레임이 안 보인다.
    for (const lastSide of [-1, 1] as PitchSide[]) {
      const { startX } = nextPitch(lastSide, 1);
      expect(startX).toBeGreaterThan(4);
      expect(startX).toBeLessThan(96);
    }
  });

  it("clamps a random outside 0..1 instead of throwing the ball off-field", () => {
    expect(nextPitch(1, -5).startX).toBe(50 - PITCH_OFFSET_MIN);
    expect(nextPitch(1, 5).startX).toBe(50 - PITCH_OFFSET_MAX);
  });
});
