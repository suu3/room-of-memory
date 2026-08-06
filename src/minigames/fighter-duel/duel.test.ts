import { describe, expect, it } from "vitest";
import {
  applyRound,
  BASE_DAMAGE,
  COMBO_CAP,
  COMBO_STEP,
  CRITICAL_MS,
  CRITICAL_SCALE,
  canUseSpecial,
  counterTo,
  DUEL_START,
  damageOf,
  duelStatus,
  FEINT_AT,
  FEINT_FROM_ROUND,
  feintChance,
  feintTo,
  HABIT_THRESHOLD,
  heroDamage,
  hpRatio,
  isCritical,
  isEnraged,
  MAX_HP,
  MOVES,
  type Move,
  opponentMove,
  planRound,
  RAGE_HP_RATIO,
  RIVAL_BASE_DAMAGE,
  RIVAL_DAMAGE_CAP,
  readHabit,
  resolveRound,
  rivalDamage,
  SPECIAL_USES,
  shouldFeint,
  TELL_FLOOR_MS,
  TELL_START_MS,
  tellDurationMs,
} from "./duel";

/** 이겼을 때의 라운드 결과 한 줄. 테스트마다 같은 뼈대를 다시 쓰지 않으려고. */
const won = (critical = false) =>
  ({ player: "strike", opponent: "throw", outcome: "win", critical }) as const;
const lost = { player: "throw", opponent: "strike", outcome: "lose", critical: false } as const;
const drew = { player: "strike", opponent: "strike", outcome: "draw", critical: false } as const;

describe("resolveRound", () => {
  it("resolves the triangle: strike > throw > guard > strike", () => {
    expect(resolveRound("strike", "throw")).toBe("win");
    expect(resolveRound("throw", "guard")).toBe("win");
    expect(resolveRound("guard", "strike")).toBe("win");
  });

  it("loses to the move that beats it", () => {
    expect(resolveRound("throw", "strike")).toBe("lose");
    expect(resolveRound("guard", "throw")).toBe("lose");
    expect(resolveRound("strike", "guard")).toBe("lose");
  });

  it("draws on a mirror match", () => {
    for (const move of MOVES) expect(resolveRound(move, move)).toBe("draw");
  });
});

describe("counterTo", () => {
  it("returns the move that beats the given one", () => {
    for (const move of MOVES) {
      expect(resolveRound(counterTo(move), move)).toBe("win");
    }
  });
});

describe("heroDamage", () => {
  it("pays more for every read in a row, up to a cap", () => {
    expect(heroDamage(1, false)).toBe(BASE_DAMAGE);
    expect(heroDamage(2, false)).toBe(BASE_DAMAGE + COMBO_STEP);
    expect(heroDamage(COMBO_CAP, false)).toBe(BASE_DAMAGE + COMBO_STEP * (COMBO_CAP - 1));
    expect(heroDamage(COMBO_CAP + 5, false)).toBe(heroDamage(COMBO_CAP, false));
  });

  it("scales a critical read", () => {
    expect(heroDamage(1, true)).toBe(Math.round(BASE_DAMAGE * CRITICAL_SCALE));
  });

  it("never falls below a single clean hit", () => {
    expect(heroDamage(0, false)).toBe(BASE_DAMAGE);
  });
});

describe("rivalDamage", () => {
  it("gets heavier as the duel drags on, then stops", () => {
    expect(rivalDamage(0)).toBe(RIVAL_BASE_DAMAGE);
    expect(rivalDamage(1)).toBeGreaterThan(rivalDamage(0));
    expect(rivalDamage(50)).toBe(RIVAL_DAMAGE_CAP);
  });
});

describe("applyRound", () => {
  it("takes the rival's health on a read and grows the combo", () => {
    const next = applyRound(DUEL_START, won());
    expect(next.rivalHp).toBe(MAX_HP - BASE_DAMAGE);
    expect(next.heroHp).toBe(MAX_HP);
    expect(next.combo).toBe(1);
    expect(next.round).toBe(1);
  });

  it("takes the hero's health on a miss and drops the combo", () => {
    const built = applyRound(applyRound(DUEL_START, won()), won());
    expect(built.combo).toBe(2);
    const hit = applyRound(built, lost);
    expect(hit.heroHp).toBe(MAX_HP - rivalDamage(built.round));
    expect(hit.combo).toBe(0);
  });

  it("keeps the combo through a draw but still advances the round", () => {
    const built = applyRound(DUEL_START, won());
    const next = applyRound(built, drew);
    expect(next.combo).toBe(1);
    expect(next.heroHp).toBe(built.heroHp);
    expect(next.rivalHp).toBe(built.rivalHp);
    expect(next.round).toBe(built.round + 1);
    expect(damageOf(built, drew)).toBe(0);
  });

  it("never drives health below zero", () => {
    const nearly = { ...DUEL_START, rivalHp: 3 };
    expect(applyRound(nearly, won()).rivalHp).toBe(0);
  });

  it("ends in five reads in a row, four when all critical, and six clean hits taken", () => {
    // 판이 얼마나 걸리는가는 규칙의 일부다 — 30초~2분 안에 끝나야 한다.
    const rounds = (resolution: () => Parameters<typeof applyRound>[1]) => {
      let state = DUEL_START;
      let count = 0;
      while (duelStatus(state) === "playing" && count < 20) {
        state = applyRound(state, resolution());
        count += 1;
      }
      return { count, status: duelStatus(state) };
    };
    expect(rounds(() => won())).toEqual({ count: 5, status: "won" });
    expect(rounds(() => won(true))).toEqual({ count: 4, status: "won" });
    // 지는 쪽이 한 대 더 길다 — 규칙을 배우는 판이 그대로 패배가 되지 않게.
    expect(rounds(() => lost)).toEqual({ count: 6, status: "lost" });
  });
});

describe("duelStatus", () => {
  it("keeps playing while both sides still stand", () => {
    expect(duelStatus({ ...DUEL_START, heroHp: 1, rivalHp: 1 })).toBe("playing");
  });

  it("reads a knockout on either side", () => {
    expect(duelStatus({ ...DUEL_START, rivalHp: 0 })).toBe("won");
    expect(duelStatus({ ...DUEL_START, heroHp: 0 })).toBe("lost");
  });

  it("prefers the win when both go down on the same round", () => {
    expect(duelStatus({ ...DUEL_START, heroHp: 0, rivalHp: 0 })).toBe("won");
  });
});

describe("hpRatio", () => {
  it("clamps to 0~1 so the gauge never overflows its track", () => {
    expect(hpRatio(MAX_HP * 2)).toBe(1);
    expect(hpRatio(-30)).toBe(0);
    expect(hpRatio(MAX_HP / 2)).toBeCloseTo(0.5);
  });
});

describe("tellDurationMs", () => {
  it("shortens as the duel goes on but never past the floor", () => {
    expect(tellDurationMs(0, MAX_HP)).toBe(TELL_START_MS);
    expect(tellDurationMs(3, MAX_HP)).toBeLessThan(TELL_START_MS);
    expect(tellDurationMs(60, MAX_HP)).toBe(TELL_FLOOR_MS);
  });

  it("shortens once more when the rival is cornered", () => {
    const cornered = MAX_HP * RAGE_HP_RATIO;
    expect(tellDurationMs(1, cornered)).toBeLessThan(tellDurationMs(1, MAX_HP));
    expect(tellDurationMs(1, cornered)).toBeGreaterThanOrEqual(TELL_FLOOR_MS);
  });

  it("leaves time to read the feint that lands mid-round", () => {
    // 페인트는 예고 시간의 FEINT_AT 지점에서 들어온다. 제일 짧은 라운드에서도
    // 그 뒤에 남는 시간이 간파 판정 창보다는 넉넉해야, 바뀐 자세를 읽고 누르는
    // 게 반사신경 시험이 아니라 판단이 된다.
    expect(TELL_FLOOR_MS * (1 - FEINT_AT)).toBeGreaterThan(CRITICAL_MS);
  });
});

describe("isEnraged", () => {
  it("marks the cornered rival, but not a knocked-out one", () => {
    expect(isEnraged(MAX_HP)).toBe(false);
    expect(isEnraged(MAX_HP * RAGE_HP_RATIO)).toBe(true);
    expect(isEnraged(0)).toBe(false);
  });
});

describe("isCritical", () => {
  it("rewards the read that lands inside the window", () => {
    expect(isCritical(0)).toBe(true);
    expect(isCritical(CRITICAL_MS)).toBe(true);
    expect(isCritical(CRITICAL_MS + 1)).toBe(false);
  });
});

describe("feintChance", () => {
  it("stays off while the rules are still being learned", () => {
    for (let round = 0; round < FEINT_FROM_ROUND; round += 1) {
      expect(feintChance(round)).toBe(0);
      expect(shouldFeint(round, 0)).toBe(false);
    }
  });

  it("ramps up and then holds", () => {
    expect(feintChance(FEINT_FROM_ROUND)).toBeGreaterThan(0);
    expect(feintChance(FEINT_FROM_ROUND + 1)).toBeGreaterThan(feintChance(FEINT_FROM_ROUND));
    expect(feintChance(40)).toBe(feintChance(20));
    expect(feintChance(40)).toBeLessThan(1);
  });

  it("reads the roll as a probability", () => {
    const round = FEINT_FROM_ROUND + 1;
    expect(shouldFeint(round, feintChance(round) - 0.001)).toBe(true);
    expect(shouldFeint(round, feintChance(round))).toBe(false);
  });
});

describe("readHabit", () => {
  it("finds nothing in a varied history", () => {
    expect(readHabit(["strike", "guard", "throw", "strike"])).toBeNull();
  });

  it("names the button that keeps getting pressed", () => {
    expect(readHabit(["guard", "strike", "strike", "strike"])).toBe("strike");
  });

  it("only looks at the recent window", () => {
    const stale: Move[] = ["strike", "strike", "strike", "guard", "throw", "guard", "throw"];
    expect(readHabit(stale)).toBeNull();
  });

  it("needs the threshold, not a plurality", () => {
    const short = Array<Move>(HABIT_THRESHOLD - 1).fill("throw");
    expect(readHabit(short)).toBeNull();
  });
});

describe("feintTo", () => {
  it("always switches to a different move than the tell", () => {
    for (const tell of MOVES) expect(feintTo(tell)).not.toBe(tell);
  });

  it("beats the player who answered the tell by the book", () => {
    for (const tell of MOVES) {
      expect(resolveRound(counterTo(tell), feintTo(tell))).toBe("lose");
    }
  });

  it("punishes a habit instead when one is showing", () => {
    const habit: Move[] = ["guard", "guard", "guard"];
    // 버릇이 tell과 어긋나는 조합에서만 버릇 쪽이 우선한다.
    const tell = MOVES.find((move) => counterTo("guard") !== move) as Move;
    expect(feintTo(tell, habit)).toBe(counterTo("guard"));
  });

  it("falls back to the book when punishing the habit would not be a switch", () => {
    const habit: Move[] = ["guard", "guard", "guard"];
    const tell = counterTo("guard");
    expect(feintTo(tell, habit)).toBe(feintTo(tell));
    expect(feintTo(tell, habit)).not.toBe(tell);
  });
});

describe("opponentMove", () => {
  it("is deterministic for the same round and salt", () => {
    expect(opponentMove(3, 11)).toBe(opponentMove(3, 11));
  });

  it("always returns a legal move", () => {
    for (let round = 0; round < 40; round += 1) {
      expect(MOVES).toContain(opponentMove(round, round * 7));
    }
  });

  it("does not lock onto a single move across a run", () => {
    const seen = new Set<Move>();
    for (let round = 0; round < 24; round += 1) seen.add(opponentMove(round, 5));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("planRound", () => {
  it("carries the tell, the round's clock, and no feint on a high roll", () => {
    const plan = planRound(DUEL_START, 7, [], 0.99);
    expect(plan.tell).toBe(opponentMove(0, 7));
    expect(plan.durationMs).toBe(tellDurationMs(0, MAX_HP));
    expect(plan.feint).toBeNull();
  });

  it("plans a feint once the rounds allow it", () => {
    const state = { ...DUEL_START, round: FEINT_FROM_ROUND };
    const plan = planRound(state, 7, [], 0);
    expect(plan.feint).toBe(feintTo(plan.tell, []));
  });

  it("tightens the clock when the rival is cornered", () => {
    const cornered = { ...DUEL_START, round: 1, rivalHp: 10 };
    expect(planRound(cornered, 7, [], 1).durationMs).toBeLessThan(
      planRound({ ...cornered, rivalHp: MAX_HP }, 7, [], 1).durationMs,
    );
  });
});

describe("필살기 게이지", () => {
  /** 필살기로 이긴 라운드 / 헛디딘 라운드. player가 throw인 것이 게이지를 쓴다. */
  const specialWon = {
    player: "throw",
    opponent: "guard",
    outcome: "win",
    critical: false,
  } as const;
  const specialWhiffed = {
    player: "throw",
    opponent: "strike",
    outcome: "lose",
    critical: false,
  } as const;

  it("hands out a fixed number per match", () => {
    expect(DUEL_START.special).toBe(SPECIAL_USES);
  });

  it("never gives one back — not for a read, not for a landed special", () => {
    /*
     * 읽어낼 때마다 채워 주던 때는 잘 읽는 사람에게 사실상 무제한이라 제한이
     * 아니었다 (UT: "필살기는 횟수 제한 있어야 하지 않나"). 줄기만 해야 한다.
     */
    expect(applyRound(DUEL_START, won()).special).toBe(SPECIAL_USES);
    expect(applyRound(DUEL_START, specialWon).special).toBe(SPECIAL_USES - 1);
    expect(applyRound(DUEL_START, specialWhiffed).special).toBe(SPECIAL_USES - 1);
  });

  it("runs out after the last one and stays out", () => {
    let state = DUEL_START;
    for (let use = 0; use < SPECIAL_USES; use += 1) {
      expect(canUseSpecial(state)).toBe(true);
      state = applyRound(state, specialWon);
    }

    expect(state.special).toBe(0);
    expect(canUseSpecial(state)).toBe(false);
    // 다 쓴 뒤에도 아래로 새지 않는다
    expect(applyRound(state, specialWhiffed).special).toBe(0);
  });

  it("leaves the other two moves free — only the special is counted", () => {
    const drained = { ...DUEL_START, special: 0 };

    expect(applyRound(drained, drew).special).toBe(0);
    expect(applyRound(drained, won()).special).toBe(0);
  });
});
