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
type BatStage = "ready" | "load" | "swing" | "follow" | "return";

export interface TossMotion {
  stage: TossStage;
  armOffset: number;
  ballLift: number;
  /** 0 at release and 1 at the hand again; used to aim the arc at the moving catch pose. */
  flight: number;
}

/**
 * 타격 자세 한 장. 좌표는 모델 공간(키 1.55, 얼굴이 +Z, 캐릭터의 오른쪽이 -X)이다.
 * 배트는 방향만 준다: 손잡이는 실제로 모인 두 손 사이에 끼운다.
 */
export interface BatMotion {
  stage: BatStage;
  /** 두 손이 모일 손잡이 자리. */
  gripX: number;
  gripY: number;
  gripZ: number;
  /** 배트가 가리키는 수평각(rad). 0이 앞(+Z), +가 캐릭터의 왼쪽(+X), ±π가 등 뒤. */
  yaw: number;
  /** 수평에서 들어 올린 각(rad). */
  pitch: number;
  /** 몸통을 트는 각(rad, +가 캐릭터의 왼쪽). */
  turn: number;
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
const DEG = Math.PI / 180;

type BatKey = Omit<BatMotion, "stage">;

/*
 * 오른손 타자. 오른쪽 어깨 위로 세워 든 배트를(ready) 뒤로 조금 더 당겼다가(load), 등 뒤에서
 * 수평으로 떨어뜨려(drop) 몸 앞을 크게 돌아 왼쪽 앞에서 공을 맞히고(contact) 왼쪽 어깨 뒤로
 * 넘긴다(follow). 잠깐 멈췄다가 몸 앞으로 배트를 내린 뒤(lowered) 처음 자세로 돌아온다.
 *
 * 수평각은 load → drop → contact → follow로 한 방향(+)으로만 늘어난다. 방향 벡터를 그냥 섞으면
 * 뒤→앞처럼 반대쪽으로 갈 때 가운데서 길이가 0이 되어 배트가 뒤집힌다: 그래서 각도로 섞는다.
 * 모델은 팔이 짧다(어깨에서 손까지 0.3): 손잡이는 어깨 앞 가까이에 둔다.
 */
const BAT_READY: BatKey = {
  gripX: -0.12,
  gripY: 0.75,
  gripZ: 0.17,
  yaw: -130 * DEG,
  pitch: 50 * DEG,
  turn: -0.2,
};
const BAT_LOAD: BatKey = {
  gripX: -0.15,
  gripY: 0.78,
  gripZ: 0.11,
  yaw: -150 * DEG,
  pitch: 42 * DEG,
  turn: -0.42,
};
const BAT_DROP: BatKey = {
  gripX: -0.1,
  gripY: 0.68,
  gripZ: 0.17,
  yaw: -105 * DEG,
  pitch: 0,
  turn: -0.15,
};
const BAT_CONTACT: BatKey = {
  gripX: 0.01,
  gripY: 0.65,
  gripZ: 0.21,
  yaw: 40 * DEG,
  pitch: -8 * DEG,
  turn: 0.3,
};
const BAT_FOLLOW: BatKey = {
  gripX: 0.12,
  gripY: 0.76,
  gripZ: 0.14,
  yaw: 145 * DEG,
  pitch: 40 * DEG,
  turn: 0.55,
};
/**
 * 돌아오는 길의 중간. 팔로스루(왼쪽 뒤)에서 준비(오른쪽 뒤)로 가장 짧게 돌면 머리 바로 뒤를
 * 지나 배트가 머리를 뚫는다. 그래서 몸 앞으로 배트를 내렸다가 오른쪽 어깨로 다시 올린다.
 */
const BAT_LOWERED: BatKey = {
  gripX: 0,
  gripY: 0.64,
  gripZ: 0.2,
  yaw: 10 * DEG,
  pitch: -35 * DEG,
  turn: 0.1,
};

type Ease = (value: number) => number;
const linear: Ease = (value) => value;
const easeIn: Ease = (value) => value * value;

/** [시작 초, 끝 초, 출발 자세, 도착 자세, 이징, 단계]. 빈 구간은 앞 자세를 유지한다. */
const BAT_TIMELINE: [number, number, BatKey, BatKey, Ease, BatStage][] = [
  [0, 0.5, BAT_READY, BAT_READY, linear, "ready"],
  [0.5, 0.95, BAT_READY, BAT_LOAD, smoothstep, "load"],
  [0.95, 1.05, BAT_LOAD, BAT_DROP, easeIn, "swing"],
  [1.05, 1.15, BAT_DROP, BAT_CONTACT, linear, "swing"],
  [1.15, 1.32, BAT_CONTACT, BAT_FOLLOW, easeOutQuart, "follow"],
  [1.32, 1.85, BAT_FOLLOW, BAT_FOLLOW, linear, "follow"],
  [1.85, 2.2, BAT_FOLLOW, BAT_LOWERED, smoothstep, "return"],
  [2.2, 2.6, BAT_LOWERED, BAT_READY, smoothstep, "return"],
  [2.6, BAT_PERIOD, BAT_READY, BAT_READY, linear, "ready"],
];

/** 두 각 사이를 가까운 쪽으로 돈다 (follow → ready는 등 뒤 π를 넘어간다). */
function lerpAngle(start: number, end: number, amount: number): number {
  let delta = (end - start) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return start + delta * amount;
}

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
  out: BatMotion = { stage: "ready", ...BAT_READY },
): BatMotion {
  // 모션 줄이기: 같은 동작을 느리게, 몸통은 덜 튼다
  const time = cycleTime(reducedMotion ? seconds * 0.6 : seconds, BAT_PERIOD);
  const segment =
    BAT_TIMELINE.find(([start, end]) => time >= start && time < end) ??
    BAT_TIMELINE[BAT_TIMELINE.length - 1];
  const [start, end, from, to, ease, stage] = segment;
  const amount = ease(progress(time, start, end));
  out.stage = stage;
  out.gripX = lerp(from.gripX, to.gripX, amount);
  out.gripY = lerp(from.gripY, to.gripY, amount);
  out.gripZ = lerp(from.gripZ, to.gripZ, amount);
  out.yaw = lerpAngle(from.yaw, to.yaw, amount);
  out.pitch = lerp(from.pitch, to.pitch, amount);
  out.turn = lerp(from.turn, to.turn, amount) * (reducedMotion ? 0.5 : 1);
  return out;
}
