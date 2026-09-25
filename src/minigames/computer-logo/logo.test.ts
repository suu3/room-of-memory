import { describe, expect, it } from "vitest";
import { LOGO_CANDIDATES, matchesLabel } from ".";

describe("computer-logo", () => {
  it("라온 로고가 두 군데(메일 첨부·캐시 뉴스)에 있고, 둘 다 맞다", () => {
    const matching = LOGO_CANDIDATES.filter(matchesLabel);
    expect(matching.map((candidate) => candidate.id).sort()).toEqual(["badge", "gate"]);
    expect(matching.map((candidate) => candidate.sourceKey)).toEqual([
      "minigame.computerLogo.source.badge",
      "minigame.computerLogo.source.gate",
    ]);
  });

  it("틀린 그림도 있다: 고르는 판이다", () => {
    expect(LOGO_CANDIDATES.some((candidate) => !matchesLabel(candidate))).toBe(true);
  });
});
