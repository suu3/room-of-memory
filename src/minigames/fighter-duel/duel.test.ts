import { describe, expect, it } from "vitest";
import {
  applyOutcome,
  counterTo,
  DUEL_START,
  duelStatus,
  MAX_LOSSES,
  MOVES,
  type Move,
  opponentMove,
  ROUNDS_TO_WIN,
  resolveRound,
} from "./duel";

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

describe("applyOutcome", () => {
  it("counts wins and losses separately and ignores draws", () => {
    expect(applyOutcome(DUEL_START, "win")).toEqual({ wins: 1, losses: 0 });
    expect(applyOutcome(DUEL_START, "lose")).toEqual({ wins: 0, losses: 1 });
    expect(applyOutcome(DUEL_START, "draw")).toBe(DUEL_START);
  });
});

describe("duelStatus", () => {
  it("keeps playing until a side reaches its threshold", () => {
    expect(duelStatus({ wins: ROUNDS_TO_WIN - 1, losses: MAX_LOSSES - 1 })).toBe("playing");
    expect(duelStatus({ wins: ROUNDS_TO_WIN, losses: 0 })).toBe("won");
    expect(duelStatus({ wins: 0, losses: MAX_LOSSES })).toBe("lost");
  });

  it("prefers the win when both thresholds land on the same score", () => {
    expect(duelStatus({ wins: ROUNDS_TO_WIN, losses: MAX_LOSSES })).toBe("won");
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
