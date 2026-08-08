import { describe, expect, it } from "vitest";
import { ANSWER, BOARD, isCorrect, isIndexFlipped, printedColor, suitColor } from "./cards";

describe("suitColor", () => {
  it("keeps the real deck's colors", () => {
    expect(suitColor("spade")).toBe("black");
    expect(suitColor("club")).toBe("black");
    expect(suitColor("heart")).toBe("red");
    expect(suitColor("diamond")).toBe("red");
  });
});

describe("printedColor", () => {
  it("prints the natural color when nothing is wrong", () => {
    expect(printedColor({ suit: "heart", rank: 3 })).toBe("red");
    expect(printedColor({ suit: "spade", rank: 3 })).toBe("black");
  });

  it("flips the color only for the color flaw", () => {
    expect(printedColor({ suit: "heart", rank: 3, flaw: "color" })).toBe("black");
    expect(printedColor({ suit: "spade", rank: 3, flaw: "color" })).toBe("red");
    // 대칭이 깨진 카드는 색까지 건드리면 단서가 둘이 된다 — 한 장은 한 규칙만 어긴다
    expect(printedColor({ suit: "heart", rank: 3, flaw: "asymmetry" })).toBe("red");
  });
});

describe("isIndexFlipped", () => {
  it("leaves only the asymmetric card's lower index upright", () => {
    expect(isIndexFlipped({ suit: "club", rank: 5 })).toBe(true);
    expect(isIndexFlipped({ suit: "club", rank: 5, flaw: "color" })).toBe(true);
    expect(isIndexFlipped({ suit: "club", rank: 5, flaw: "asymmetry" })).toBe(false);
  });
});

describe("BOARD", () => {
  it("never repeats a card", () => {
    // 한 벌에서 뽑은 카드다. 같은 장이 두 번 나오면 그것부터 오류로 읽힌다.
    const faces = BOARD.map((card) => `${card.suit}-${card.rank}`);
    expect(new Set(faces).size).toBe(BOARD.length);
  });

  it("keeps every rank drawable without a face card", () => {
    for (const card of BOARD) {
      expect(card.rank).toBeGreaterThanOrEqual(1);
      expect(card.rank).toBeLessThanOrEqual(10);
    }
  });

  it("shows both rules, so neither clue is dead weight", () => {
    /*
     * 색 단서와 대칭 단서를 방 곳곳에 흩어 두었다. 판에 한쪽 오류만 있으면 나머지
     * 단서는 아무것도 가리키지 않는 문장이 된다.
     */
    const flaws = BOARD.map((card) => card.flaw).filter(Boolean);
    expect(flaws).toContain("color");
    expect(flaws).toContain("asymmetry");
  });

  it("hides the flaws away from the first card", () => {
    // 첫 장이 답이면 훑기도 전에 눈에 걸린다
    expect(BOARD[0].flaw).toBeUndefined();
  });
});

describe("ANSWER", () => {
  it("reads the flawed cards left to right", () => {
    expect(ANSWER).toBe("237");
  });

  it("has one digit per flawed card", () => {
    // 10이 섞이면 자릿수가 흔들려 답이 두 갈래로 읽힌다
    expect(ANSWER).toHaveLength(BOARD.filter((card) => card.flaw).length);
  });
});

describe("isCorrect", () => {
  it("accepts the answer", () => {
    expect(isCorrect(ANSWER)).toBe(true);
  });

  it("accepts the answer however it is spaced out", () => {
    // 답을 알고도 형식에서 막히면 그건 문제가 아니라 함정이다
    expect(isCorrect(" 2 3 7 ")).toBe(true);
    expect(isCorrect("2,3,7")).toBe(true);
    expect(isCorrect("2-3-7")).toBe(true);
  });

  it("rejects a wrong or reordered answer", () => {
    expect(isCorrect("")).toBe(false);
    expect(isCorrect("732")).toBe(false);
    expect(isCorrect("23")).toBe(false);
    expect(isCorrect("2371")).toBe(false);
  });
});
