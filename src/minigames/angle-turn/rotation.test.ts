import { describe, expect, it } from "vitest";
import { ANSWER, ANSWER_LENGTH, isCorrect, PAIRS } from "./rotation";

describe("PAIRS", () => {
  it("keeps the original maze puzzle", () => {
    // 5년 전 미궁게임 1층 문제. 순서까지 그대로여야 답이 9018045로 읽힌다.
    expect(PAIRS.map((pair) => [pair.from, pair.to, pair.degrees])).toEqual([
      ["m", "3", 90],
      ["곡", "눈", 180],
      ["|", "/", 45],
    ]);
  });

  it("never asks the player to read a letter", () => {
    /*
     * 한글이 섞여 있지만 뜻도 소리도 쓰이지 않는다. 도형이 겹치는지만 보면 되므로
     * en/ja에서도 그대로 선다. 여기 낱글자 말고 단어가 들어오면 그 전제가 깨진다.
     */
    for (const pair of PAIRS) {
      expect([...pair.from]).toHaveLength(1);
      expect([...pair.to]).toHaveLength(1);
    }
  });

  it("stays within a single turn", () => {
    for (const pair of PAIRS) {
      expect(pair.degrees).toBeGreaterThan(0);
      expect(pair.degrees).toBeLessThan(360);
    }
  });

  it("does not lay the angles out in size order", () => {
    // 45·90·180으로 늘어놓으면 "작은 것부터"라는 없는 규칙이 보인다
    const degrees = PAIRS.map((pair) => pair.degrees);
    expect(degrees).not.toEqual([...degrees].sort((a, b) => a - b));
  });
});

describe("ANSWER", () => {
  it("reads the angles left to right", () => {
    expect(ANSWER).toBe("9018045");
    expect(ANSWER_LENGTH).toBe(7);
  });
});

describe("isCorrect", () => {
  it("accepts the answer", () => {
    expect(isCorrect(ANSWER)).toBe(true);
  });

  it("accepts the answer however it is spaced out", () => {
    // 답을 알고도 형식에서 막히면 그건 문제가 아니라 함정이다
    expect(isCorrect("90 180 45")).toBe(true);
    expect(isCorrect(" 90,180,45 ")).toBe(true);
  });

  it("rejects a wrong or reordered answer", () => {
    expect(isCorrect("")).toBe(false);
    expect(isCorrect("4518090")).toBe(false);
    expect(isCorrect("901804")).toBe(false);
  });
});
