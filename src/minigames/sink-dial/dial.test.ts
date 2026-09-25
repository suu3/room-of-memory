import { describe, expect, it } from "vitest";
import { HERO_JERSEY_NUMBER, SINK_DIAL_CODE } from "@/data/room-clues";
import { dialMatches, turnDigit } from ".";

describe("sink-dial", () => {
  it("답은 등번호 두 자리다", () => {
    expect(SINK_DIAL_CODE).toBe(String(HERO_JERSEY_NUMBER).padStart(2, "0"));
    expect(SINK_DIAL_CODE).toBe("11");
  });

  it("눈금은 0~9를 돌아 순환한다", () => {
    expect(turnDigit(9, 1)).toBe(0);
    expect(turnDigit(0, -1)).toBe(9);
    expect(turnDigit(4, 1)).toBe(5);
  });

  it("두 칸이 답과 같을 때만 열린다", () => {
    expect(dialMatches([1, 1])).toBe(true);
    expect(dialMatches([1, 0])).toBe(false);
  });
});
