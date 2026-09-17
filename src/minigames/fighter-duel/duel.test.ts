import { describe, expect, it } from "vitest";
import {
  ATTACKS,
  type Attack,
  advance,
  canAct,
  chooseRivalAttack,
  comboDamage,
  DUEL_START,
  DUEL_TUNINGS,
  type DuelState,
  distanceOf,
  duelStatus,
  HABIT_THRESHOLD,
  type Intent,
  isAirborne,
  JUMP_MS,
  jumpHeight,
  MATCH_MS,
  MAX_HP,
  MIN_GAP,
  NO_INTENT,
  RIVAL_MIND_START,
  rivalTellMs,
  STAGE_SPAN,
  stepRival,
} from "./duel";

/** 한 프레임(ms). 실제 화면도 이 언저리로 돈다 (rAF 60fps). */
const STEP = 16;

/** 둘을 원하는 거리에 세운 판. 거리로 갈리는 규칙이 대부분이라 여기서 시작한다. */
function stageAt(distance: number, patch: Partial<DuelState> = {}): DuelState {
  return {
    ...DUEL_START,
    hero: { ...DUEL_START.hero, x: 3 },
    rival: { ...DUEL_START.rival, x: 3 + distance },
    ...patch,
  };
}

/**
 * 상대를 벽에 몰아세운 판. 뒤로 걷는 것이 곧 가드라, 물러설 자리가 있으면 가드를
 * 시험하려 해도 상대가 뒤로 빠져 버려서 거리로 갈린다.
 */
function corneredAt(distance: number): DuelState {
  const wall = STAGE_SPAN - 0.4;
  return {
    ...DUEL_START,
    hero: { ...DUEL_START.hero, x: wall - distance },
    rival: { ...DUEL_START.rival, x: wall },
  };
}

/** 기술 하나를 끝까지 굴린다. 첫 프레임에만 내고 나머지는 가만히 둔다. */
function swing(
  start: DuelState,
  attack: Attack,
  rivalIntent: Intent = NO_INTENT,
  frames = 40,
): { state: DuelState; kinds: string[] } {
  let state = start;
  const kinds: string[] = [];
  for (let frame = 0; frame < frames; frame += 1) {
    const heroIntent: Intent = frame === 0 ? { walk: 0, attack } : NO_INTENT;
    const step = advance(state, heroIntent, rivalIntent, STEP);
    state = step.state;
    for (const event of step.events) kinds.push(event.kind);
  }
  return { state, kinds };
}

describe("한 프레임", () => {
  it("닿는 거리에서 지르면 맞고, 맞은 쪽은 잠깐 못 움직인다", () => {
    const { state, kinds } = swing(stageAt(1.1), "jab", NO_INTENT, 12);
    expect(kinds).toContain("hit");
    expect(state.rival.hp).toBeLessThan(MAX_HP);
    expect(canAct(state.rival)).toBe(false);
  });

  it("거리 밖에서는 헛친다", () => {
    const { state, kinds } = swing(stageAt(2.4), "jab", NO_INTENT, 12);
    expect(kinds).toContain("whiff");
    expect(state.rival.hp).toBe(MAX_HP);
  });

  it("가드는 공격을 막는다: chip만 깎인다", () => {
    const guard: Intent = { walk: -1, attack: null };
    // 물러서며 막으므로 거리가 벌어진다. 약공격의 사거리 안에서 시작한다
    const { state, kinds } = swing(corneredAt(1), "jab", guard, 12);
    expect(kinds).toContain("block");
    expect(MAX_HP - state.rival.hp).toBe(ATTACKS.jab.chip);
  });

  it("잡기는 가드를 뚫는다", () => {
    const guard: Intent = { walk: -1, attack: null };
    const { state, kinds } = swing(corneredAt(0.95), "throw", guard, 20);
    expect(kinds).toContain("hit");
    expect(MAX_HP - state.rival.hp).toBeGreaterThan(ATTACKS.jab.chip);
  });

  it("상대가 내지르는 중이면 잡기가 깨지고 크게 문다", () => {
    // 둘이 같은 프레임에 내민다. 잡기(210ms)가 살아날 때 상대의 강공격(330ms)은 아직 발동 중이다
    let state = advance(
      stageAt(1),
      { walk: 0, attack: "throw" },
      { walk: 0, attack: "heavy" },
      STEP,
    ).state;
    let broke = false;
    for (let frame = 0; frame < 20 && !broke; frame += 1) {
      const next = advance(state, NO_INTENT, NO_INTENT, STEP);
      state = next.state;
      broke = next.events.some((event) => event.kind === "break");
    }
    expect(broke).toBe(true);
    expect(state.hero.stun).toBe("broken");
  });

  it("상대의 발동 중에 맞히면 카운터라 더 아프다", () => {
    const plain = swing(stageAt(1.1), "jab", NO_INTENT, 12).state;
    const countered = swing(stageAt(1.1), "jab", { walk: 0, attack: "heavy" }, 12).state;
    expect(MAX_HP - countered.rival.hp).toBeGreaterThan(MAX_HP - plain.rival.hp);
  });

  it("기술 중에는 걸을 수 없다", () => {
    let state = advance(stageAt(2.4), { walk: 0, attack: "heavy" }, NO_INTENT, STEP).state;
    const before = state.hero.x;
    for (let frame = 0; frame < 6; frame += 1) {
      state = advance(state, { walk: 1, attack: null }, NO_INTENT, STEP).state;
    }
    expect(state.hero.x).toBeCloseTo(before, 5);
  });

  it("구석까지 밀어붙여도 상대가 벽을 뚫지 않는다", () => {
    // 밀 몫을 늘 반씩 나눠 가지면, 벽에 붙은 쪽이 무대 밖으로 밀려 나간다
    let state = corneredAt(1.2);
    for (let frame = 0; frame < 120; frame += 1) {
      state = advance(state, { walk: 1, attack: null }, { walk: -1, attack: null }, STEP).state;
    }
    expect(state.rival.x).toBeLessThanOrEqual(STAGE_SPAN - 0.4 + 1e-6);
    expect(state.hero.x).toBeGreaterThanOrEqual(0.4 - 1e-6);
    expect(distanceOf(state)).toBeGreaterThanOrEqual(MIN_GAP - 1e-6);
  });

  it("서로 겹쳐 서지 않는다", () => {
    let state = stageAt(1.4);
    for (let frame = 0; frame < 60; frame += 1) {
      state = advance(state, { walk: 1, attack: null }, { walk: 1, attack: null }, STEP).state;
    }
    expect(distanceOf(state)).toBeGreaterThanOrEqual(MIN_GAP - 1e-6);
  });

  it("콤보가 쌓이면 한 방이 커진다", () => {
    expect(comboDamage(10, 2, false)).toBeGreaterThan(comboDamage(10, 1, false));
    expect(comboDamage(10, 1, true)).toBeGreaterThan(comboDamage(10, 1, false));
  });
});

describe("점프", () => {
  /** 뜬 채로 원하는 프레임까지 굴린다. */
  function jumpFor(frames: number, start = stageAt(1.6)) {
    let state = advance(start, { walk: 0, attack: null, jump: true }, NO_INTENT, STEP).state;
    for (let frame = 1; frame < frames; frame += 1) {
      state = advance(state, NO_INTENT, NO_INTENT, STEP).state;
    }
    return state;
  }

  it("뜨면 발이 땅에서 떨어지고, 착지하면 잠깐 굳는다", () => {
    const rising = jumpFor(6);
    expect(isAirborne(rising.hero)).toBe(true);
    expect(jumpHeight(rising.hero.airMs ?? 0)).toBeGreaterThan(0);

    const landed = jumpFor(Math.ceil(JUMP_MS / STEP) + 2);
    expect(isAirborne(landed.hero)).toBe(false);
    expect(landed.hero.stun).toBe("land");
  });

  it("뜬 몸은 잡히지 않는다", () => {
    let state = jumpFor(8);
    const kinds: string[] = [];
    for (let frame = 0; frame < 20; frame += 1) {
      const step = advance(
        state,
        NO_INTENT,
        frame === 0 ? { walk: 0, attack: "throw" } : NO_INTENT,
        STEP,
      );
      state = step.state;
      for (const event of step.events) kinds.push(event.kind);
    }
    expect(kinds).toContain("whiff");
    expect(state.hero.hp).toBe(MAX_HP);
  });

  it("뜬 몸은 막지 못한다", () => {
    // 물러서기(= 가드)를 누른 채 떠도 가드가 안 선다
    let state = advance(
      stageAt(1.2),
      { walk: -1, attack: null, jump: true },
      NO_INTENT,
      STEP,
    ).state;
    expect(state.hero.guarding).toBe(false);
    const kinds: string[] = [];
    for (let frame = 0; frame < 16; frame += 1) {
      const step = advance(
        state,
        { walk: -1, attack: null },
        frame === 0 ? { walk: 0, attack: "jab" } : NO_INTENT,
        STEP,
      );
      state = step.state;
      for (const event of step.events) kinds.push(event.kind);
    }
    expect(kinds).not.toContain("block");
  });

  it("공중에서는 한 번만 친다", () => {
    let state = advance(
      stageAt(1.2),
      { walk: 0, attack: "jab", jump: true },
      NO_INTENT,
      STEP,
    ).state;
    expect(state.hero.attack).toBe("jab");
    expect(state.hero.airAttacked).toBe(true);
    // 첫 기술이 끝난 뒤에도 같은 점프에서는 다시 못 친다
    // (한 방이 들어가면 히트스톱만큼 판이 멈추므로 프레임을 넉넉히 준다)
    for (let frame = 0; frame < 34; frame += 1) {
      state = advance(state, { walk: 0, attack: "jab" }, NO_INTENT, STEP).state;
    }
    expect(isAirborne(state.hero)).toBe(true);
    expect(state.hero.attack).toBeNull();
  });

  it("공중에서 맞으면 그대로 떨어진다", () => {
    let state = jumpFor(8, stageAt(1.2));
    for (let frame = 0; frame < 16; frame += 1) {
      state = advance(
        state,
        NO_INTENT,
        frame === 0 ? { walk: 0, attack: "jab" } : NO_INTENT,
        STEP,
      ).state;
    }
    expect(state.hero.hp).toBeLessThan(MAX_HP);
    expect(isAirborne(state.hero)).toBe(false);
  });
});

describe("판정", () => {
  it("체력이 0이면 끝난다", () => {
    expect(duelStatus({ ...DUEL_START, rival: { ...DUEL_START.rival, hp: 0 } })).toBe("won");
    expect(duelStatus({ ...DUEL_START, hero: { ...DUEL_START.hero, hp: 0 } })).toBe("lost");
  });

  it("시간이 다 되면 체력이 많은 쪽이 이긴다", () => {
    const timeUp = { ...DUEL_START, elapsedMs: MATCH_MS };
    expect(duelStatus({ ...timeUp, rival: { ...timeUp.rival, hp: 10 } })).toBe("won");
    expect(duelStatus({ ...timeUp, hero: { ...timeUp.hero, hp: 10 } })).toBe("lost");
  });
});

describe("상대의 머리", () => {
  it("막고만 있으면 잡으러 온다", () => {
    const mind = { ...RIVAL_MIND_START, guardSeen: HABIT_THRESHOLD };
    expect(chooseRivalAttack(mind, 1, 0.9)).toBe("throw");
  });

  it("잡으러만 들어오면 약공격으로 끊는다", () => {
    const mind = { ...RIVAL_MIND_START, throwSeen: HABIT_THRESHOLD };
    expect(chooseRivalAttack(mind, 1.4, 0.9)).toBe("jab");
  });

  it("예고를 걸고, 예고 시간이 지나야 지른다", () => {
    const tuning = DUEL_TUNINGS.normal;
    let mind = { ...RIVAL_MIND_START, waitMs: 0 };
    const state = stageAt(1.2);
    const first = stepRival(state, mind, STEP, 0.99, tuning);
    mind = first.mind;
    expect(mind.telegraph).not.toBeNull();
    expect(first.intent.attack).toBeNull();

    let attacked: Attack | null = null;
    for (let frame = 0; frame < 60 && attacked === null; frame += 1) {
      const step = stepRival(state, mind, STEP, 0.99, tuning);
      mind = step.mind;
      attacked = step.intent.attack;
    }
    expect(attacked).not.toBeNull();
  });

  it("몰리면 예고가 짧아진다", () => {
    const tuning = DUEL_TUNINGS.normal;
    expect(rivalTellMs(tuning, 10)).toBeLessThan(rivalTellMs(tuning, MAX_HP));
  });

  it("이지가 노멀보다 예고가 길고 한 방이 약하다", () => {
    expect(DUEL_TUNINGS.easy.tellMs).toBeGreaterThan(DUEL_TUNINGS.normal.tellMs);
    expect(DUEL_TUNINGS.easy.rivalDamageScale).toBeLessThan(DUEL_TUNINGS.normal.rivalDamageScale);
  });
});
