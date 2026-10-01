import { describe, expect, it } from "vitest";
import { LOGO_CANDIDATES, matchesLabel } from ".";

describe("computer-logo", () => {
  it("라온 로고는 하나뿐이다: 아빠 메일 첨부의 출입증 사진", () => {
    const matching = LOGO_CANDIDATES.filter(matchesLabel);
    expect(matching.map((candidate) => candidate.id)).toEqual(["badge"]);
    expect(matching[0]?.sourceKey).toBe("minigame.computerLogo.source.badge");
  });

  it("틀린 그림이 셋이다: 고르는 판이다", () => {
    expect(LOGO_CANDIDATES.filter((candidate) => !matchesLabel(candidate))).toHaveLength(3);
    // 같은 그림이 둘 있으면 "같은 그림 찾기"로 돌아간다
    expect(new Set(LOGO_CANDIDATES.map((candidate) => candidate.logo)).size).toBe(
      LOGO_CANDIDATES.length,
    );
  });
});
