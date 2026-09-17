/**
 * 격투 미니게임의 규칙. 화면 없이 검증할 수 있게 계산만 모아둔다.
 *
 * 처음엔 가위바위보였다. 상대 예고를 보고 세 버튼 중 하나를 고르면 라운드가 끝나는
 * 식이라, 격투 게임의 그림을 입혀도 결국 손이 하는 일은 "셋 중 고르기" 하나였다.
 * 지금은 판이 멈추지 않는다: 두 사람이 한 무대 위에서 거리를 두고 서서, 다가서고
 * 물러서고 내지르고 막는다. 프레임(발동·유효·경직)과 거리가 승패를 가른다.
 *
 * 삼각 상성은 살아 있다. 다만 버튼의 상성이 아니라 **상황의 상성**이다:
 *   - 잡기는 가드를 뚫는다 (막고만 있으면 잡힌다)
 *   - 가드는 공격을 막는다 (지르기만 하면 안 통한다)
 *   - 공격은 잡기를 끊는다 (잡으러 오는 팔을 먼저 때리면 잡기가 깨진다)
 *
 * 여기 있는 것은 전부 순수 함수다. 시간은 밖에서 dt로 들어온다 (index.tsx의 rAF).
 */

import type { MinigameDifficulty } from "@/types/minigame";

/* ------------------------------------------------------------------- 무대 */

/** 무대의 폭(추상 단위). 좌우 끝이 벽이고, 밀려나면 더는 못 물러선다. */
export const STAGE_SPAN = 8;
/** 둘이 더 가까워질 수 없는 거리. 겹쳐 서면 누가 때리는지 안 보인다. */
export const MIN_GAP = 0.9;
export const HERO_START = 3;
export const RIVAL_START = 5;

/** 걷는 속도(단위/초). 물러서는 쪽이 느리다: 도망이 공짜면 아무도 안 들어온다. */
export const WALK_FORWARD = 2.6;
export const WALK_BACK = 2.1;

/** 한 판의 길이. 다 못 끝내면 체력이 많은 쪽이 이긴다 (격투 게임의 타임업). */
export const MATCH_MS = 75_000;

/* ------------------------------------------------------------------- 점프 */

/**
 * 한 번 뜨면 땅에 닿기까지(ms)와 가장 높이 뜬 지점(무대 단위).
 *
 * 공중에서는 방향을 못 바꾼다. 뜨는 순간 정해진 속도로 끝까지 간다: 뛰어드는 것은
 * 되돌릴 수 없는 선택이어야 뛰어들기 전에 한 번 생각한다.
 */
export const JUMP_MS = 700;
export const JUMP_PEAK = 1;
/** 뜨는 순간의 수평 속도(단위/초). 앞으로 뛰면 걸어 들어가는 것보다 빠르다. */
export const JUMP_FORWARD_VX = 2.9;
export const JUMP_BACK_VX = 2.3;
/** 착지 경직(ms). 헛뛴 점프를 무는 자리다. */
export const LAND_MS = 170;

/** 뜬 뒤 흐른 시간으로 높이를 낸다 (0~JUMP_PEAK). 포물선 하나. */
export function jumpHeight(airMs: number): number {
  const t = Math.min(1, Math.max(0, airMs / JUMP_MS));
  return 4 * JUMP_PEAK * t * (1 - t);
}

/* ------------------------------------------------------------------- 기술 */

export type Attack = "jab" | "heavy" | "throw";
export const ATTACKS_ORDER: readonly Attack[] = ["jab", "heavy", "throw"];

export interface AttackFrames {
  /** 내지르고 맞기까지(ms). 이 구간에 맞으면 카운터다. */
  startupMs: number;
  /** 판정이 살아 있는 시간(ms). 이 순간의 거리로 맞고 안 맞고가 갈린다. */
  activeMs: number;
  /** 헛치거나 막힌 뒤 못 움직이는 시간(ms). */
  recoveryMs: number;
  damage: number;
  /** 닿는 거리. 잡기는 품에 들어와야 한다. */
  reach: number;
  /** 막혔을 때 깎이는 몫. 0이면 가드가 완전하다. */
  chip: number;
  /** 맞거나 막힌 뒤 벌어지는 거리. */
  pushback: number;
  /** 맞은 쪽이 못 움직이는 시간(ms). */
  hitStunMs: number;
  /** 막은 쪽이 못 움직이는 시간(ms). 가드해도 바로 반격할 수는 없다. */
  blockStunMs: number;
}

/**
 * 세 기술의 손맛. 숫자 한 줄이 곧 규칙이라 표로 둔다.
 *
 * 약공격은 빠르고 싸다: 견제와 잡기 끊기. 강공격은 느리고 아프다: 상대가 굳었을 때
 * 넣는 한 방. 잡기는 가드를 뚫지만 짧고, 헛치면 크게 문다.
 */
export const ATTACKS: Record<Attack, AttackFrames> = {
  jab: {
    startupMs: 110,
    activeMs: 70,
    recoveryMs: 190,
    damage: 5,
    reach: 1.3,
    // 막힌 약공격은 아무것도 깎지 않는다. 깎이면 연타만으로 이길 수 있고, 그러면
    // 가드가 방어가 아니라 시간 끌기가 된다
    chip: 0,
    // 밀림이 작으면 약공격 연타 하나로 상대를 가둔다. 한 대 칠 때마다 사이가 벌어져야
    // 다시 들어가는 걸음이 생기고, 그 걸음이 상대에게는 숨 쉴 틈이 된다.
    // 눈으로도 보여야 한다: 때렸는데 상대가 제자리면 때린 것 같지가 않다
    pushback: 0.45,
    hitStunMs: 210,
    blockStunMs: 150,
  },
  heavy: {
    startupMs: 330,
    activeMs: 90,
    recoveryMs: 460,
    damage: 13,
    reach: 1.5,
    // 강공격만 막아도 조금 깎인다. 가드 한 자세로 영원히 버티지는 못한다는 표시
    chip: 1,
    pushback: 0.72,
    hitStunMs: 420,
    blockStunMs: 240,
  },
  throw: {
    startupMs: 210,
    activeMs: 80,
    recoveryMs: 420,
    damage: 11,
    reach: 1.05,
    chip: 0,
    pushback: 0.9,
    hitStunMs: 520,
    blockStunMs: 0,
  },
};

/** 잡기가 깨졌을 때의 경직(ms). 헛치는 것보다 아프다: 읽히면 그만큼 문다. */
export const THROW_BREAK_MS = 620;

/** 카운터(상대의 발동 중에 맞히기) 배수. 먼저 읽고 먼저 내민 값이다. */
export const COUNTER_SCALE = 1.4;

/**
 * 맞는 순간 판이 통째로 멈추는 시간(ms). 격투 게임의 히트스톱이다.
 *
 * 때린 맛은 숫자가 아니라 이 정지에서 난다. 멈춘 동안에는 아무도 못 움직이고 시계도
 * 안 돈다: 맞은 쪽이 밀려나는 것이 그 정지 뒤에 한 번에 보인다.
 */
export const HIT_STOP_MS = 80;
export const COUNTER_STOP_MS = 130;
/** 끊기지 않고 이어 맞힐 때마다 붙는 가산과 그 상한(맞힌 횟수 기준). */
export const COMBO_STEP = 2;
export const COMBO_CAP = 5;

export const MAX_HP = 100;

/* --------------------------------------------------------------- 난이도 */

export interface DuelTuning {
  /** 상대 한 방의 배수. */
  rivalDamageScale: number;
  /** 예고 시간(ms). 길수록 읽을 틈이 넓다. */
  tellMs: number;
  /** 결정과 결정 사이의 뜸(ms). 길수록 덜 몰아붙인다. */
  thinkMs: number;
  /** 날아오는 기술 하나를 막을 확률(0~1). 기술마다 한 번만 굴린다. */
  blockChance: number;
  /** 플레이어가 헛치거나 막힌 뒤(경직) 곧장 물어뜯을 확률(0~1). */
  punishChance: number;
}

export const DUEL_TUNINGS: Record<MinigameDifficulty, DuelTuning> = {
  /*
   * 이지는 "덜 아픈 상대"가 아니라 **덜 몰아붙이는 상대**다. 한 방의 세기만 낮췄더니
   * 쉬지 않고 들어오는 손 때문에 때릴 틈 자체가 없었다 (UT: "상대가 너무 빠르게
   * 바로바로 공격"). 예고를 길게, 뜸을 길게, 무는 확률을 낮춘다.
   */
  easy: { rivalDamageScale: 0.7, tellMs: 380, thinkMs: 620, blockChance: 0.5, punishChance: 0.3 },
  normal: {
    rivalDamageScale: 1,
    tellMs: 200,
    thinkMs: 260,
    blockChance: 0.9,
    punishChance: 0.85,
  },
};

/** 상대가 몰리면 예고가 짧아진다. 다 이긴 뒤의 마지막 한 방이 제일 어려워야 한다. */
export const RAGE_HP_RATIO = 0.35;
export const RAGE_TELL_CUT = 0.7;

export function hpRatio(hp: number): number {
  return Math.min(1, Math.max(0, hp / MAX_HP));
}

export function isEnraged(hp: number): boolean {
  return hp > 0 && hpRatio(hp) <= RAGE_HP_RATIO;
}

export function rivalTellMs(tuning: DuelTuning, rivalHp: number): number {
  return Math.round(tuning.tellMs * (isEnraged(rivalHp) ? RAGE_TELL_CUT : 1));
}

/* ------------------------------------------------------------------ 상태 */

export type ActionPhase = "startup" | "active" | "recovery";
export type StunKind = "hurt" | "block" | "broken" | "land";

export interface FighterState {
  hp: number;
  /** 무대 위의 자리. hero가 왼쪽, rival이 오른쪽이다. */
  x: number;
  /** 내는 중인 기술. 없으면 null. */
  attack: Attack | null;
  phase: ActionPhase | null;
  /** 지금 단계가 끝나기까지 남은 시간(ms). */
  phaseLeftMs: number;
  /** 못 움직이는 이유와 남은 시간. */
  stun: StunKind | null;
  stunLeftMs: number;
  /** 이번 프레임에 가드 자세인가. 입력에서 나온다 (뒤로 걷기 = 가드). */
  guarding: boolean;
  /** 뜬 뒤 흐른 시간(ms). null이면 땅에 있다. */
  airMs: number | null;
  /** 뜨는 순간 정해진 수평 속도(단위/초). 공중에서는 못 바꾼다. */
  airVx: number;
  /** 이번 점프에서 이미 쳤는가. 공중 공격은 한 번뿐이다. */
  airAttacked: boolean;
  /** 맞지 않고 이어 맞힌 횟수. 맞으면 0. */
  combo: number;
}

export interface DuelState {
  hero: FighterState;
  rival: FighterState;
  /** 판이 시작된 뒤 흐른 시간(ms). */
  elapsedMs: number;
  /** 히트스톱이 남은 시간(ms). 0보다 크면 판이 멈춰 있다. */
  hitStopMs: number;
}

function freshFighter(x: number): FighterState {
  return {
    hp: MAX_HP,
    x,
    attack: null,
    phase: null,
    phaseLeftMs: 0,
    stun: null,
    stunLeftMs: 0,
    guarding: false,
    airMs: null,
    airVx: 0,
    airAttacked: false,
    combo: 0,
  };
}

export const DUEL_START: DuelState = {
  hero: freshFighter(HERO_START),
  rival: freshFighter(RIVAL_START),
  elapsedMs: 0,
  hitStopMs: 0,
};

/** 지금 움직일 수 있는가. 기술 중이거나 경직이면 손이 묶인다. */
export function canAct(fighter: FighterState): boolean {
  return fighter.attack === null && fighter.stun === null;
}

export function isAirborne(fighter: FighterState): boolean {
  return fighter.airMs !== null;
}

/** 걷기·가드·점프는 땅을 딛고 있어야 한다. */
export function isGrounded(fighter: FighterState): boolean {
  return canAct(fighter) && !isAirborne(fighter);
}

/** 이 기술을 지금 낼 수 있는가. 공중에서는 한 번만, 잡기는 땅에서만. */
export function canStart(fighter: FighterState, attack: Attack): boolean {
  if (!canAct(fighter)) return false;
  if (!isAirborne(fighter)) return true;
  return attack !== "throw" && !fighter.airAttacked;
}

export function distanceOf(state: DuelState): number {
  return Math.abs(state.rival.x - state.hero.x);
}

export type DuelStatus = "playing" | "won" | "lost";

export function duelStatus(state: DuelState): DuelStatus {
  if (state.rival.hp <= 0) return "won";
  if (state.hero.hp <= 0) return "lost";
  if (state.elapsedMs >= MATCH_MS) return state.hero.hp >= state.rival.hp ? "won" : "lost";
  return "playing";
}

/* ------------------------------------------------------------------ 입력 */

export interface Intent {
  /** -1 물러서기, 0 제자리, 1 다가서기. */
  walk: -1 | 0 | 1;
  /** 내려는 기술. 손이 묶여 있으면 무시된다. */
  attack: Attack | null;
  /** 뜨려는가. 땅을 딛고 손이 자유로울 때만 먹는다. */
  jump?: boolean;
  /**
   * 걷지 않고 그 자리에서 막기. 상대(CPU)만 쓴다.
   *
   * 사람은 뒤로 걷는 것이 곧 가드다(격투 게임의 관용구). 그런데 상대까지 그렇게
   * 만들었더니 막을 때마다 뒤로 빠져서, 가드를 잡는 순간 잡기 사거리(1.05) 밖으로
   * 나가 버렸다. 그러면 "막고만 있는 상대를 잡는다"는 한 변이 통째로 사라진다.
   */
  guard?: boolean;
}

export const NO_INTENT: Intent = { walk: 0, attack: null };

/**
 * 지금 막고 있는가. 손이 묶이면(기술 중·경직) 못 막고, **공중에서는 못 막는다**.
 * 뛰어든 몸은 무방비다: 그게 점프가 공짜가 아닌 이유다.
 */
export function isGuarding(fighter: FighterState, intent: Intent): boolean {
  return (intent.guard === true || intent.walk === -1) && isGrounded(fighter);
}

/* ------------------------------------------------------------------ 사건 */

export type DuelEventKind = "hit" | "counter" | "block" | "whiff" | "break" | "ko";

export interface DuelEvent {
  kind: DuelEventKind;
  /** 이 사건을 일으킨 쪽. */
  by: "hero" | "rival";
  attack: Attack;
  damage: number;
  /** 이 공격으로 쌓인 연속 타격 수 (맞았을 때만). */
  combo: number;
}

export function comboDamage(base: number, combo: number, counter: boolean): number {
  const bonus = COMBO_STEP * (Math.min(Math.max(combo, 1), COMBO_CAP) - 1);
  return Math.round((base + bonus) * (counter ? COUNTER_SCALE : 1));
}

/* ---------------------------------------------------------------- 한 프레임 */

/** 한 번에 흘려보낼 수 있는 최대 시간(ms). 탭이 잠깐 멈췄다 돌아와도 순간이동 없이. */
export const MAX_STEP_MS = 50;

interface Side {
  self: FighterState;
  other: FighterState;
  who: "hero" | "rival";
  /** 상대 쪽으로 가는 방향(+1/-1). */
  facing: 1 | -1;
}

/** 경직·기술 단계의 시계를 돌린다. 이번 프레임에 판정이 살아난 기술을 알려준다. */
function tickTimers(fighter: FighterState, dtMs: number): { next: FighterState; landed: boolean } {
  const next = { ...fighter };
  let landed = false;

  if (next.stun !== null) {
    next.stunLeftMs -= dtMs;
    if (next.stunLeftMs <= 0) {
      next.stun = null;
      next.stunLeftMs = 0;
    }
  }

  if (next.attack !== null && next.phase !== null) {
    next.phaseLeftMs -= dtMs;
    while (next.phaseLeftMs <= 0 && next.attack !== null) {
      const frames = ATTACKS[next.attack];
      if (next.phase === "startup") {
        next.phase = "active";
        next.phaseLeftMs += frames.activeMs;
        // 판정이 살아나는 순간은 한 번뿐이다. 맞고 안 맞고는 그때의 거리로 정한다
        landed = true;
      } else if (next.phase === "active") {
        next.phase = "recovery";
        next.phaseLeftMs += frames.recoveryMs;
      } else {
        next.attack = null;
        next.phase = null;
        next.phaseLeftMs = 0;
      }
    }
  }

  return { next, landed };
}

/** 무대의 양 끝. 여기가 벽이다. */
const WALL = { min: 0.4, max: STAGE_SPAN - 0.4 } as const;

function inStage(x: number): number {
  return Math.min(Math.max(x, WALL.min), WALL.max);
}

/**
 * 벽과 상대 사이에 가둔다. 겹치지도, 무대 밖으로 나가지도 않는다.
 *
 * **벽에 몰린 쪽은 더 못 밀린다.** 밀 몫을 늘 반씩 나눠 가졌더니, 구석까지 밀어붙인
 * 상대가 벽을 뚫고 무대 밖으로 나갔다. 남는 몫은 반대쪽이 진다: 그래서 구석에 몰면
 * 상대가 물러설 자리를 잃고, 물러서기로 피하던 잡기를 피할 수 없게 된다. 격투 게임에서
 * 구석이 값을 갖는 이유가 이것이다.
 */
function clampPositions(hero: FighterState, rival: FighterState): void {
  hero.x = inStage(hero.x);
  rival.x = inStage(rival.x);
  const need = MIN_GAP - (rival.x - hero.x);
  if (need <= 0) return;

  const rivalRoom = WALL.max - rival.x;
  const heroRoom = hero.x - WALL.min;
  const toRival = Math.min(need / 2, rivalRoom);
  const toHero = Math.min(need - toRival, heroRoom);
  rival.x += toRival;
  hero.x -= toHero;
  // 한쪽이 벽에 붙어 몫을 못 받았으면 나머지를 반대쪽이 마저 진다
  const left = MIN_GAP - (rival.x - hero.x);
  if (left > 0) {
    rival.x = inStage(rival.x + Math.min(left, WALL.max - rival.x));
    hero.x = inStage(hero.x - Math.min(MIN_GAP - (rival.x - hero.x), hero.x - WALL.min));
  }
}

/**
 * 살아난 판정 하나를 푼다. 삼각 상성이 여기 한 곳에 모여 있다.
 *
 * 잡기는 가드를 뚫지만, 상대가 이미 팔을 내밀고 있으면(발동·유효) 깨진다.
 * 그 밖의 공격은 가드에 막히고, 막히면 깎이는 건 chip뿐이다.
 */
function resolveHit(side: Side, distance: number): DuelEvent | null {
  const attack = side.self.attack;
  if (attack === null) return null;
  const frames = ATTACKS[attack];
  if (distance > frames.reach) {
    return { kind: "whiff", by: side.who, attack, damage: 0, combo: 0 };
  }

  const otherSwinging = side.other.attack !== null && side.other.phase !== "recovery";
  if (attack === "throw" && otherSwinging) {
    return { kind: "break", by: side.who, attack, damage: 0, combo: 0 };
  }

  // 잡기는 지상의 손이다. 뜬 몸은 잡을 수 없어서 그대로 헛잡는다
  if (attack === "throw" && isAirborne(side.other)) {
    return { kind: "whiff", by: side.who, attack, damage: 0, combo: 0 };
  }

  if (attack !== "throw" && side.other.guarding) {
    return { kind: "block", by: side.who, attack, damage: frames.chip, combo: 0 };
  }

  // 상대가 내지르는 중에 맞히면 카운터. 읽고 먼저 내민 값이다
  const counter = side.other.attack !== null && side.other.phase === "startup";
  const combo = side.self.combo + 1;
  return {
    kind: counter ? "counter" : "hit",
    by: side.who,
    attack,
    damage: comboDamage(frames.damage, combo, counter),
    combo,
  };
}

function applyEvent(side: Side, event: DuelEvent, scale: number): void {
  const frames = ATTACKS[event.attack];
  if (event.kind === "whiff") return;

  if (event.kind === "break") {
    side.self.stun = "broken";
    side.self.stunLeftMs = THROW_BREAK_MS;
    side.self.attack = null;
    side.self.phase = null;
    side.self.phaseLeftMs = 0;
    side.self.combo = 0;
    return;
  }

  const damage = Math.round(event.damage * scale);
  side.other.hp = Math.max(0, side.other.hp - damage);
  side.other.x += side.facing * frames.pushback;

  if (event.kind === "block") {
    side.other.stun = "block";
    side.other.stunLeftMs = frames.blockStunMs;
    return;
  }

  side.other.stun = "hurt";
  side.other.stunLeftMs = frames.hitStunMs;
  side.other.attack = null;
  side.other.phase = null;
  side.other.phaseLeftMs = 0;
  side.other.combo = 0;
  // 공중에서 맞으면 그대로 떨어진다. 뜬 채로 경직을 버티는 자세는 이 게임에 없다
  side.other.airMs = null;
  side.other.airVx = 0;
  side.self.combo = event.combo;
}

function startAttack(fighter: FighterState, attack: Attack): void {
  fighter.attack = attack;
  fighter.phase = "startup";
  fighter.phaseLeftMs = ATTACKS[attack].startupMs;
  fighter.guarding = false;
  if (isAirborne(fighter)) fighter.airAttacked = true;
}

/** 뜬다. 앞뒤 어느 쪽으로 뛸지는 이 순간의 방향키가 정한다. */
function startJump(fighter: FighterState, walk: -1 | 0 | 1, facing: 1 | -1): void {
  fighter.airMs = 0;
  fighter.airAttacked = false;
  fighter.airVx = walk === 0 ? 0 : facing * walk * (walk > 0 ? JUMP_FORWARD_VX : JUMP_BACK_VX);
}

/** 공중의 시계를 돌린다. 땅에 닿으면 잠깐 굳는다: 헛뛴 점프를 무는 자리. */
function tickAir(fighter: FighterState, dtMs: number, seconds: number): void {
  if (fighter.airMs === null) return;
  fighter.airMs += dtMs;
  fighter.x += fighter.airVx * seconds;
  if (fighter.airMs < JUMP_MS) return;
  fighter.airMs = null;
  fighter.airVx = 0;
  if (fighter.stun === null) {
    fighter.stun = "land";
    fighter.stunLeftMs = LAND_MS;
  }
}

/**
 * 판을 dt만큼 굴린다. 순수 함수다: 같은 상태와 같은 입력이면 같은 결과가 나온다.
 *
 * 차례는 시계 → 이동 → 새 기술 → 판정이다. 판정을 마지막에 두는 이유는, 이번
 * 프레임에 살아난 판정이 이번 프레임의 거리로 판정돼야 하기 때문이다.
 */
export function advance(
  state: DuelState,
  heroIntent: Intent,
  rivalIntent: Intent,
  dtMs: number,
  tuning: DuelTuning = DUEL_TUNINGS.normal,
): { state: DuelState; events: DuelEvent[] } {
  const dt = Math.min(Math.max(dtMs, 0), MAX_STEP_MS);
  const events: DuelEvent[] = [];

  // 히트스톱 동안에는 아무것도 흐르지 않는다. 판이 멈춘 그 짧은 정지가 타격감이다
  if (state.hitStopMs > 0) {
    return {
      state: {
        ...state,
        hitStopMs: Math.max(0, state.hitStopMs - dt),
        elapsedMs: state.elapsedMs + dt,
      },
      events,
    };
  }

  const heroTick = tickTimers(state.hero, dt);
  const rivalTick = tickTimers(state.rival, dt);
  const hero = heroTick.next;
  const rival = rivalTick.next;

  // 공중에 뜬 몸은 제 속도로 간다. 땅을 딛은 몸만 걷는다
  const seconds = dt / 1000;
  tickAir(hero, dt, seconds);
  tickAir(rival, dt, seconds);
  if (isGrounded(hero) && heroIntent.walk !== 0) {
    hero.x += heroIntent.walk * (heroIntent.walk > 0 ? WALK_FORWARD : WALK_BACK) * seconds;
  }
  if (isGrounded(rival) && rivalIntent.walk !== 0) {
    rival.x -= rivalIntent.walk * (rivalIntent.walk > 0 ? WALK_FORWARD : WALK_BACK) * seconds;
  }
  clampPositions(hero, rival);

  // 뜨는 것이 먼저다. 뜨면서 치는 손(점프 공격)은 같은 프레임에 이어진다
  if (heroIntent.jump && isGrounded(hero)) startJump(hero, heroIntent.walk, 1);
  if (rivalIntent.jump && isGrounded(rival)) startJump(rival, rivalIntent.walk, -1);

  if (heroIntent.attack && canStart(hero, heroIntent.attack)) {
    startAttack(hero, heroIntent.attack);
  }
  if (rivalIntent.attack && canStart(rival, rivalIntent.attack)) {
    startAttack(rival, rivalIntent.attack);
  }

  /*
   * 가드는 맨 나중에 센다. 뜨거나 손을 내민 뒤에 세야, 발이 땅에서 떨어지는 그 프레임에
   * 팔이 같이 내려간다. 먼저 세면 뛰어오르는 첫 프레임만 무적처럼 막힌다.
   */
  hero.guarding = isGuarding(hero, heroIntent);
  rival.guarding = isGuarding(rival, rivalIntent);

  const distance = Math.abs(rival.x - hero.x);
  const heroSide: Side = { self: hero, other: rival, who: "hero", facing: 1 };
  const rivalSide: Side = { self: rival, other: hero, who: "rival", facing: -1 };

  if (heroTick.landed) {
    const event = resolveHit(heroSide, distance);
    if (event) {
      applyEvent(heroSide, event, 1);
      events.push(event);
    }
  }
  if (rivalTick.landed) {
    const event = resolveHit(rivalSide, distance);
    if (event) {
      applyEvent(rivalSide, event, tuning.rivalDamageScale);
      events.push({ ...event, damage: Math.round(event.damage * tuning.rivalDamageScale) });
    }
  }
  clampPositions(hero, rival);

  // 들어간 한 방마다 판이 잠깐 멈춘다. 카운터는 조금 더 길게 멈춘다
  const stop = events.reduce((longest, event) => {
    if (event.kind === "counter") return Math.max(longest, COUNTER_STOP_MS);
    if (event.kind === "hit" || event.kind === "break") return Math.max(longest, HIT_STOP_MS);
    return longest;
  }, 0);

  const next: DuelState = {
    hero,
    rival,
    elapsedMs: state.elapsedMs + dt,
    hitStopMs: stop,
  };
  if (duelStatus(next) !== "playing" && duelStatus(state) === "playing") {
    events.push({
      kind: "ko",
      by: next.rival.hp <= 0 ? "hero" : "rival",
      attack: "jab",
      damage: 0,
      combo: 0,
    });
  }
  return { state: next, events };
}

/* ------------------------------------------------------------- 상대의 머리 */

export interface RivalMind {
  /** 다음 결정까지 남은 뜸(ms). */
  waitMs: number;
  /** 예고 중인 기술과 남은 예고 시간(ms). */
  telegraph: Attack | null;
  telegraphMs: number;
  /**
   * 가드를 쥐고 있는 남은 시간(ms).
   *
   * 한 프레임만 막고 푸는 상대는 잡을 수가 없다. 잡기(발동 210ms)가 살아날 때쯤에는
   * 이미 가드가 풀려 있기 때문이다. 한 번 막기로 했으면 잠깐 쥐고 있어야 "막고만
   * 있는 상대를 잡는다"는 삼각 상성의 한 변이 실제로 생긴다.
   */
  guardMs: number;
  /** 지금 날아오는 기술에 대해 이미 막을지 말지 굴렸는가. 기술 하나에 한 번이다. */
  reacted: boolean;
  /** 맞고 일어나는 길에 팔부터 올릴 것인가. */
  wakeGuard: boolean;
  /** 플레이어가 가드로 버틴 횟수와 잡으러 온 횟수. 버릇을 문다. */
  guardSeen: number;
  throwSeen: number;
}

export const RIVAL_MIND_START: RivalMind = {
  waitMs: 700,
  telegraph: null,
  telegraphMs: 0,
  guardMs: 0,
  reacted: false,
  wakeGuard: false,
  guardSeen: 0,
  throwSeen: 0,
};

/** 한 번 막기로 했을 때 가드를 쥐고 있는 시간(ms). 잡기가 파고들 수 있는 폭이다. */
export const GUARD_HOLD_MS = 360;

/** 버릇이 읽히는 횟수. 이만큼 쌓이면 상대가 그 버릇을 노린다. */
export const HABIT_THRESHOLD = 3;

/**
 * 거리와 버릇을 보고 무엇을 낼지 고른다. 무작위는 전부 roll로 주입받는다.
 *
 * 막고만 있으면 잡으러 오고, 잡으러만 들어오면 약공격으로 끊는다. 무작위가 아니라
 * 읽혀서 당하는 것이어야 분하다.
 */
export function chooseRivalAttack(mind: RivalMind, distance: number, roll: number): Attack {
  if (mind.guardSeen >= HABIT_THRESHOLD && distance <= ATTACKS.throw.reach) return "throw";
  if (mind.throwSeen >= HABIT_THRESHOLD) return "jab";
  if (distance <= ATTACKS.throw.reach && roll < 0.28) return "throw";
  if (roll < 0.62) return "jab";
  return "heavy";
}

/**
 * 상대의 한 프레임. 예고 → 발동의 리듬을 여기서 만든다.
 *
 * 예고(telegraph) 동안 상대는 자세만 잡고 아무것도 하지 않는다. 그 틈이 플레이어가
 * 읽을 시간이고, 난이도가 조절하는 것도 그 길이다 (DuelTuning의 tellMs).
 */
export function stepRival(
  state: DuelState,
  mind: RivalMind,
  dtMs: number,
  roll: number,
  tuning: DuelTuning = DUEL_TUNINGS.normal,
): { mind: RivalMind; intent: Intent } {
  // 판이 멈춘 동안에는 상대도 생각하지 않는다 (히트스톱)
  if (state.hitStopMs > 0) return { mind, intent: NO_INTENT };

  const dt = Math.min(Math.max(dtMs, 0), MAX_STEP_MS);
  const next: RivalMind = { ...mind };
  const distance = distanceOf(state);
  const heroSwinging = state.hero.attack !== null && state.hero.phase === "startup";

  // 플레이어가 무엇을 하는지 세어 둔다. 같은 짓을 세 번 하면 그때부터 읽힌다
  if (state.hero.attack === "throw" && state.hero.phase === "startup") {
    next.throwSeen = Math.min(HABIT_THRESHOLD, next.throwSeen + 1);
  }
  if (state.hero.guarding) next.guardSeen = Math.min(HABIT_THRESHOLD * 60, next.guardSeen + 1);

  if (!canAct(state.rival)) {
    /*
     * 손이 묶인 동안에도 뜸은 흐른다. 여기서 뜸을 되감았더니, 약공격을 연달아 맞는
     * 상대는 경직이 풀릴 때마다 다시 처음부터 뜸을 들이느라 한 대도 못 냈다.
     * 맞는 동안에도 생각은 하고 있어야 풀리는 순간 손이 나간다.
     */
    next.telegraph = null;
    next.telegraphMs = 0;
    next.guardMs = 0;
    next.waitMs = Math.max(0, next.waitMs - dt);
    // 맞았으면 일어나는 길에 팔부터 올린다. 이게 없으면 약공격 연타 한 줄에 갇힌다
    if (state.rival.stun === "hurt") next.wakeGuard = true;
    return { mind: next, intent: NO_INTENT };
  }

  /*
   * 일어나자마자 가드. 한 대 맞은 뒤에도 그냥 서 있으면 연타가 끝나지 않는다.
   * 대신 이 가드가 그대로 잡기의 자리이기도 하다: 때려서 굳힌 뒤 잡는 것이 이 게임의 길.
   */
  if (next.wakeGuard) {
    next.wakeGuard = false;
    next.guardMs = GUARD_HOLD_MS;
    return { mind: next, intent: { walk: 0, attack: null, guard: true } };
  }

  // 날아오던 것이 끝났으면 다음 기술에 다시 반응할 수 있다
  if (state.hero.attack === null) next.reacted = false;

  // 쥐고 있는 가드는 끝까지 쥔다. 제자리에서 막는다: 물러서면 잡기 사거리 밖으로 나간다
  if (next.guardMs > 0) {
    next.guardMs -= dt;
    return { mind: next, intent: { walk: 0, attack: null, guard: true } };
  }

  /*
   * 대공. 뜬 상대는 잡을 수도 없고 막아 봐야 아무것도 안 일어난다. 떨어지는 길목에
   * 팔을 뻗어 두는 것이 답이다. 아직 손을 안 뻗은 몸이면 이쪽이 먼저 닿는다.
   */
  if (isAirborne(state.hero) && state.hero.attack === null && distance <= ATTACKS.heavy.reach) {
    if (roll < tuning.punishChance) {
      next.telegraph = null;
      next.telegraphMs = 0;
      next.waitMs = tuning.thinkMs;
      return { mind: next, intent: { walk: 0, attack: "jab" } };
    }
  }

  /*
   * 막기는 예고보다 먼저 본다. 예고를 거는 중이라도 팔이 날아오면 내리고 막는다.
   * 이 순서가 아니면 상대는 뜸 들이는 동안 샌드백이라, 약공격 연타 한 줄로 판이 끝난다.
   */
  const heroRecovering = state.hero.attack !== null && state.hero.phase === "recovery";
  if (heroSwinging && distance <= ATTACKS.heavy.reach && !next.reacted) {
    next.reacted = true;
    if (roll < tuning.blockChance) {
      next.telegraph = null;
      next.telegraphMs = 0;
      next.guardMs = GUARD_HOLD_MS;
      return { mind: next, intent: { walk: 0, attack: null, guard: true } };
    }
  }

  next.waitMs -= dt;
  if (next.waitMs > 0) {
    // 뜸을 들이는 동안에도 사이를 좁힌다. 가만히 서 있으면 샌드백이다
    const walk = next.telegraph === null && distance > ATTACKS.jab.reach ? 1 : 0;
    if (next.telegraph === null) return { mind: next, intent: { walk, attack: null } };
  }

  /*
   * 헛쳤거나 막힌 뒤의 경직은 물어뜯는 자리다. 여기서는 예고를 걸지 않는다: 반격은
   * 읽어서 내는 것이 아니라 틈을 보고 내는 것이라, 예고를 붙이면 틈이 지나간다.
   * 대신 뜸(thinkMs)을 지키므로 매 프레임 물어뜯지는 않는다.
   */
  if (heroRecovering && distance <= ATTACKS.jab.reach && roll < tuning.punishChance) {
    next.telegraph = null;
    next.telegraphMs = 0;
    next.waitMs = tuning.thinkMs;
    return { mind: next, intent: { walk: 0, attack: "jab" } };
  }

  // 예고 중: 자세만 잡고 기다린다. 다 되면 그대로 지른다
  if (next.telegraph !== null) {
    next.telegraphMs -= dt;
    if (next.telegraphMs > 0) return { mind: next, intent: NO_INTENT };
    const attack = next.telegraph;
    next.telegraph = null;
    next.telegraphMs = 0;
    next.waitMs = tuning.thinkMs;
    if (attack === "throw") next.guardSeen = 0;
    return { mind: next, intent: { walk: 0, attack } };
  }

  if (next.waitMs > 0) return { mind: next, intent: NO_INTENT };

  next.waitMs = tuning.thinkMs;
  if (distance > ATTACKS.heavy.reach) {
    return { mind: next, intent: { walk: 1, attack: null } };
  }

  next.telegraph = chooseRivalAttack(next, distance, roll);
  next.telegraphMs = rivalTellMs(tuning, state.rival.hp);
  if (next.telegraph === "throw") next.throwSeen = 0;
  return { mind: next, intent: NO_INTENT };
}
