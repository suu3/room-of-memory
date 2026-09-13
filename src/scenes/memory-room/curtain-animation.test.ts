import { describe, expect, it } from "vitest";
import { advanceCurtainMotion, createCurtainMotion } from "./curtain-animation";

describe("curtain gesture timing", () => {
  it("waits for the hand to reach before allowing the curtain to move", () => {
    const motion = createCurtainMotion(0);
    for (let i = 0; i < 18; i++) advanceCurtainMotion(motion, true, 0, 1 / 30);
    expect(motion.ready).toBe(false);
    expect(motion.done).toBe(false);
    for (let i = 0; i < 22; i++) advanceCurtainMotion(motion, true, 0, 1 / 30);
    expect(motion.ready).toBe(true);
    expect(motion.weight).toBe(1);
  });

  it("finishes a quick tap only after reaching, pulling and releasing", () => {
    const motion = createCurtainMotion(0);
    for (let i = 0; i < 40; i++) advanceCurtainMotion(motion, false, 0, 1 / 30);
    expect(motion.done).toBe(false);
    for (let i = 0; i < 15; i++) advanceCurtainMotion(motion, false, 1, 1 / 30);
    expect(motion.shown).toBeGreaterThan(0.8);
    expect(motion.done).toBe(false);
    for (let i = 0; i < 90; i++) advanceCurtainMotion(motion, false, 1, 1 / 30);
    expect(motion.done).toBe(true);
    expect(motion.weight).toBe(0);
  });

  it("supports closing and reversing a held drag without ending the gesture", () => {
    const motion = createCurtainMotion(1);
    for (let i = 0; i < 90; i++) advanceCurtainMotion(motion, true, 0, 1 / 30);
    expect(motion.shown).toBeLessThan(0.01);
    const closedTime = motion.time;
    for (let i = 0; i < 60; i++) advanceCurtainMotion(motion, true, 1, 1 / 30);
    expect(motion.time).toBeGreaterThan(closedTime + 0.7);
    expect(motion.done).toBe(false);
  });

  it("approaches the existing grip smoothly when grabbing an open curtain again", () => {
    const motion = createCurtainMotion(1);
    let largestStep = 0;
    for (let i = 0; i < 90; i++) {
      const previous = motion.time;
      advanceCurtainMotion(motion, true, 1, 1 / 60);
      largestStep = Math.max(largestStep, Math.abs(motion.time - previous));
    }
    expect(motion.ready).toBe(true);
    expect(motion.shown).toBe(1);
    expect(largestStep).toBeLessThan(0.1);
  });
});
