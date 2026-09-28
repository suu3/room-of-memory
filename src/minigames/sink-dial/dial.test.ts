import { describe, expect, it } from "vitest";
import { HERO_JERSEY_NUMBER, SINK_DIAL_CODE } from "@/data/room-clues";
import { dialMatches, turnDigit } from ".";

describe("sink-dial", () => {
  it("답은 세 자리 숫자이고, 방에 늘 보이는 등번호와 겹치지 않는다", () => {
    expect(SINK_DIAL_CODE).toMatch(/^\d{3}$/);
    expect(SINK_DIAL_CODE).not.toContain(String(HERO_JERSEY_NUMBER));
  });

  it("눈금은 0~9를 돌아 순환한다", () => {
    expect(turnDigit(9, 1)).toBe(0);
    expect(turnDigit(0, -1)).toBe(9);
    expect(turnDigit(4, 1)).toBe(5);
  });

  it("세 칸이 답과 같을 때만 열린다", () => {
    expect(dialMatches([4, 0, 7], "407")).toBe(true);
    expect(dialMatches([4, 0, 8], "407")).toBe(false);
    expect(dialMatches(SINK_DIAL_CODE.split("").map(Number))).toBe(true);
  });
});
