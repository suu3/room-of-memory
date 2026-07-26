import { describe, expect, it } from "vitest";
import { classifySwing, remainingChances } from "./timing";

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
