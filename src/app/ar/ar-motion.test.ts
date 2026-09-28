import { describe, expect, it } from "vitest";
import {
  AR_ACTIONS,
  advanceActionClock,
  batMotionAt,
  createActionClock,
  tossMotionAt,
} from "./ar-motion";

describe("AR character actions", () => {
  it("keeps batting last after the four requested core actions", () => {
    expect(AR_ACTIONS.map((action) => action.id)).toEqual(["toss", "stand", "walk", "sit", "bat"]);
  });

  it("throws, catches, settles, and visibly rests before the next toss", () => {
    const ready = tossMotionAt(0.3);
    const windup = tossMotionAt(0.78);
    const launch = tossMotionAt(1.02);
    const rising = tossMotionAt(1.24);
    const apex = tossMotionAt(1.48);
    const caught = tossMotionAt(1.96);
    const settled = tossMotionAt(2.5);
    const stillResting = tossMotionAt(3.55);
    const nextReady = tossMotionAt(3.8);

    expect(ready).toMatchObject({ stage: "rest", ballLift: 0, armOffset: 0 });
    expect(windup.stage).toBe("windup");
    expect(windup.armOffset).toBeGreaterThan(0);
    expect(launch.armOffset).toBeLessThan(0);
    expect(rising.stage).toBe("flight");
    expect(rising.ballLift).toBeGreaterThan(0);
    expect(rising.flight).toBeGreaterThan(0);
    expect(rising.flight).toBeLessThan(0.5);
    expect(apex.ballLift).toBeGreaterThan(0.55);
    expect(apex.flight).toBeCloseTo(0.5, 1);
    expect(caught).toMatchObject({ stage: "catch", ballLift: 0 });
    expect(caught.flight).toBe(1);
    expect(settled).toMatchObject({ stage: "rest", ballLift: 0, armOffset: 0 });
    expect(stillResting).toMatchObject({ stage: "rest", ballLift: 0, armOffset: 0 });
    expect(nextReady).toMatchObject({ stage: "rest", ballLift: 0, armOffset: 0 });
  });

  it("gives the bat one decisive swing followed by recovery and rest", () => {
    const ready = batMotionAt(0.2);
    const loaded = batMotionAt(0.78);
    const contact = batMotionAt(1.08);
    const recovered = batMotionAt(1.62);
    const resting = batMotionAt(2.65);

    expect(ready).toMatchObject({ stage: "rest", swing: 0 });
    expect(loaded.stage).toBe("windup");
    expect(loaded.swing).toBeLessThan(0);
    expect(contact.stage).toBe("swing");
    expect(contact.swing).toBeGreaterThan(0.8);
    expect(recovered.stage).toBe("recover");
    expect(Math.abs(recovered.swing)).toBeLessThan(0.25);
    expect(resting).toMatchObject({ stage: "rest", swing: 0 });
  });

  it("keeps reduced motion readable with restrained travel", () => {
    expect(tossMotionAt(1.48, true).ballLift).toBeLessThan(0.3);
    expect(Math.abs(batMotionAt(1.08, true).swing)).toBeLessThan(0.5);
  });

  it("waits for tracking and restarts the rhythm whenever the marker is reacquired", () => {
    const clock = createActionClock("toss", false);

    expect(advanceActionClock(clock, "toss", false, 0.8)).toBe(0);
    expect(clock.restarted).toBe(false);

    expect(advanceActionClock(clock, "toss", true, 0.1)).toBeCloseTo(0.1);
    expect(clock.restarted).toBe(true);
    expect(advanceActionClock(clock, "toss", true, 0.4)).toBeCloseTo(0.5);
    expect(clock.restarted).toBe(false);

    expect(advanceActionClock(clock, "toss", false, 1)).toBeCloseTo(0.5);
    expect(advanceActionClock(clock, "toss", true, 0.1)).toBeCloseTo(0.1);
    expect(clock.restarted).toBe(true);
  });
});
