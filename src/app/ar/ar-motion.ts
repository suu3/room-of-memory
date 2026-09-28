export const AR_ACTIONS = [
  { id: "toss", icon: "⚾" },
  { id: "stand", icon: "🧍" },
  { id: "walk", icon: "🚶" },
  { id: "sit", icon: "🪑" },
  { id: "bat", icon: "🏏" },
] as const;

export type ArAction = (typeof AR_ACTIONS)[number]["id"];

export interface ActionClock {
  action: ArAction;
  active: boolean;
  elapsed: number;
  restarted: boolean;
}

type TossStage = "rest" | "windup" | "flight" | "catch" | "settle";
type BatStage = "rest" | "windup" | "swing" | "recover";

export interface TossMotion {
  stage: TossStage;
  armOffset: number;
  ballLift: number;
  /** 0 at release and 1 at the hand again; used to aim the arc at the moving catch pose. */
  flight: number;
}

export interface BatMotion {
  stage: BatStage;
  /** -1 is loaded behind the shoulder, +1 is through the contact point. */
  swing: number;
}

const TOSS_PERIOD = 3.75;
const TOSS_WINDUP = 0.65;
const TOSS_DIP_END = 0.83;
const TOSS_RELEASE = 1.05;
const TOSS_FOLLOW_END = 1.22;
const TOSS_CATCH = 1.9;
const TOSS_CATCH_END = 2.15;
const TOSS_SETTLE_END = 2.45;
const TOSS_HEIGHT = 0.62;

const BAT_PERIOD = 3.1;
const BAT_WINDUP = 0.5;
const BAT_SWING = 0.95;
const BAT_CONTACT = 1.2;
const BAT_RECOVERED = 1.85;

function cycleTime(seconds: number, period: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return ((seconds % period) + period) % period;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function progress(value: number, start: number, end: number): number {
  return clamp01((value - start) / (end - start));
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function easeOutQuart(value: number): number {
  return 1 - (1 - value) ** 4;
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

export function createActionClock(action: ArAction, active: boolean): ActionClock {
  return { action, active, elapsed: 0, restarted: false };
}

/** Keeps procedural gestures paused off-marker and restarts them on every reacquisition. */
export function advanceActionClock(
  clock: ActionClock,
  action: ArAction,
  active: boolean,
  delta: number,
): number {
  clock.restarted = clock.action !== action || (active && !clock.active);
  clock.action = action;
  clock.active = active;
  if (clock.restarted) clock.elapsed = 0;
  if (active && Number.isFinite(delta)) clock.elapsed += Math.max(0, delta);
  return clock.elapsed;
}

/** A complete toss has anticipation, flight, a soft catch, then 1.3 seconds of stillness. */
export function tossMotionAt(
  seconds: number,
  reducedMotion = false,
  out: TossMotion = { stage: "rest", armOffset: 0, ballLift: 0, flight: 0 },
): TossMotion {
  const time = cycleTime(seconds, TOSS_PERIOD);
  const travel = reducedMotion ? 0.38 : 1;

  if (time < TOSS_WINDUP || time >= TOSS_SETTLE_END) {
    out.stage = "rest";
    out.armOffset = 0;
    out.ballLift = 0;
    out.flight = 0;
    return out;
  }
  if (time < TOSS_DIP_END) {
    out.stage = "windup";
    out.armOffset = 0.18 * smoothstep(progress(time, TOSS_WINDUP, TOSS_DIP_END)) * travel;
    out.ballLift = 0;
    out.flight = 0;
    return out;
  }
  if (time < TOSS_RELEASE) {
    out.stage = "windup";
    out.armOffset =
      lerp(0.18, -0.45, easeOutQuart(progress(time, TOSS_DIP_END, TOSS_RELEASE))) * travel;
    out.ballLift = 0;
    out.flight = 0;
    return out;
  }
  if (time < TOSS_CATCH) {
    const flight = progress(time, TOSS_RELEASE, TOSS_CATCH);
    const armOffset =
      time < TOSS_FOLLOW_END
        ? lerp(-0.45, -0.16, easeOutQuart(progress(time, TOSS_RELEASE, TOSS_FOLLOW_END)))
        : lerp(-0.16, 0.1, smoothstep(progress(time, TOSS_FOLLOW_END, TOSS_CATCH)));
    out.stage = "flight";
    out.armOffset = armOffset * travel;
    out.ballLift = 4 * TOSS_HEIGHT * flight * (1 - flight) * travel;
    out.flight = flight;
    return out;
  }
  if (time < TOSS_CATCH_END) {
    out.stage = "catch";
    out.armOffset =
      (0.1 + 0.14 * Math.sin(Math.PI * progress(time, TOSS_CATCH, TOSS_CATCH_END))) * travel;
    out.ballLift = 0;
    out.flight = 1;
    return out;
  }
  out.stage = "settle";
  out.armOffset =
    lerp(0.1, 0, smoothstep(progress(time, TOSS_CATCH_END, TOSS_SETTLE_END))) * travel;
  out.ballLift = 0;
  out.flight = 1;
  return out;
}

/** One swing, a controlled follow-through, and enough quiet time to read it as a single action. */
export function batMotionAt(
  seconds: number,
  reducedMotion = false,
  out: BatMotion = { stage: "rest", swing: 0 },
): BatMotion {
  const time = cycleTime(seconds, BAT_PERIOD);
  const travel = reducedMotion ? 0.42 : 1;

  if (time < BAT_WINDUP || time >= BAT_RECOVERED) {
    out.stage = "rest";
    out.swing = 0;
    return out;
  }
  if (time < BAT_SWING) {
    out.stage = "windup";
    out.swing = lerp(0, -0.38, smoothstep(progress(time, BAT_WINDUP, BAT_SWING))) * travel;
    return out;
  }
  if (time < BAT_CONTACT) {
    out.stage = "swing";
    out.swing = lerp(-0.38, 1, easeOutQuart(progress(time, BAT_SWING, BAT_CONTACT))) * travel;
    return out;
  }
  out.stage = "recover";
  out.swing = lerp(1, 0, easeOutQuart(progress(time, BAT_CONTACT, BAT_RECOVERED))) * travel;
  return out;
}
