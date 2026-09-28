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

  it("swings the bat from over the right shoulder, through the front, to over the left shoulder", () => {
    const ready = batMotionAt(0.2);
    expect(ready.stage).toBe("ready");
    // 준비: 캐릭터의 오른쪽(-X) 뒤로 세워 든다
    expect(Math.sin(ready.yaw)).toBeLessThan(0);
    expect(ready.pitch).toBeGreaterThan(0.6);

    const contact = batMotionAt(1.15);
    expect(contact.stage).toBe("follow");
    // 임팩트: 몸 앞에서 거의 수평
    expect(Math.cos(contact.yaw)).toBeGreaterThan(0.5);
    expect(Math.abs(contact.pitch)).toBeLessThan(0.2);

    const follow = batMotionAt(1.5);
    // 팔로스루: 캐릭터의 왼쪽(+X) 뒤로 넘긴다
    expect(Math.sin(follow.yaw)).toBeGreaterThan(0);
    expect(follow.turn).toBeGreaterThan(ready.turn);

    expect(batMotionAt(2.9)).toMatchObject({ stage: "ready", yaw: ready.yaw, pitch: ready.pitch });
  });

  it("sweeps the swing one way round instead of flipping the bat through the body", () => {
    let previous = batMotionAt(0.95).yaw;
    for (let time = 0.96; time <= 1.32; time += 0.01) {
      const yaw = batMotionAt(time).yaw;
      expect(yaw).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = yaw;
    }
  });

  it("brings the bat back in front of the body instead of through the head", () => {
    for (let time = 1.85; time <= 2.6; time += 0.02) {
      const { yaw, pitch } = batMotionAt(time);
      // 머리 바로 뒤(수평각 ±180° 근처)를 높이 든 채 지나가지 않는다
      const behindHead = Math.cos(yaw) < -0.5 && Math.abs(Math.sin(yaw)) < 0.5;
      expect(behindHead && pitch > 0).toBe(false);
    }
  });

  it("keeps reduced motion readable with restrained travel", () => {
    expect(tossMotionAt(1.48, true).ballLift).toBeLessThan(0.3);
    expect(Math.abs(batMotionAt(1.5, true).turn)).toBeLessThan(Math.abs(batMotionAt(1.5).turn));
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
