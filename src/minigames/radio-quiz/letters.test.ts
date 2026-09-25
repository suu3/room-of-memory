import { describe, expect, it } from "vitest";
import en from "@/i18n/locales/en/common.json";
import ja from "@/i18n/locales/ja/common.json";
import ko from "@/i18n/locales/ko/common.json";
import {
  answerLetters,
  hintCount,
  hintedSlots,
  judgeSlots,
  parsePool,
  poolCoversAnswer,
  shufflePool,
} from "./letters";

describe("letters", () => {
  it("공백 구분 풀을 글자 배열로 파싱한다", () => {
    expect(parsePool("좀 꿈 비  밤")).toEqual(["좀", "꿈", "비", "밤"]);
  });

  it("셔플은 원본을 보존하고 구성만 유지한다", () => {
    const pool = ["A", "B", "C", "D"];
    const shuffled = shufflePool(pool, () => 0);
    expect(pool).toEqual(["A", "B", "C", "D"]);
    expect([...shuffled].sort()).toEqual([...pool].sort());
  });

  it("빈칸이 남으면 판정하지 않는다", () => {
    expect(judgeSlots([0, null], ["좀", "비"], "좀비")).toBeNull();
  });

  it("채운 글자가 정답을 이루면 true", () => {
    expect(judgeSlots([0, 1], ["좀", "비"], "좀비")).toBe(true);
    expect(judgeSlots([1, 0], ["좀", "비"], "좀비")).toBe(false);
  });
});

/**
 * 세 언어 리소스가 풀 수 있는 퀴즈인지 지킨다. 풀에 정답 글자가 빠지면
 * 게임이 조용히 못 깨는 판이 된다.
 */
describe("radioQuiz 리소스", () => {
  const locales = { ko, en, ja };

  for (const [name, resource] of Object.entries(locales)) {
    const quiz = resource.minigame.radioQuiz;

    it(`${name}: 풀이 정답(${quiz.answer})을 만들 수 있다`, () => {
      expect(poolCoversAnswer(parsePool(quiz.pool), quiz.answer)).toBe(true);
    });

    it(`${name}: 정답이 두 글자 이상, 풀은 최소 10글자`, () => {
      expect(answerLetters(quiz.answer).length).toBeGreaterThanOrEqual(2);
      // 풀이 정답과 엇비슷하게 좁으면 고르는 맛이 없다. 선택지는 열 개부터.
      expect(parsePool(quiz.pool).length).toBeGreaterThanOrEqual(10);
    });
  }
});

describe("오답 세 번마다 글자 힌트 (v4 3-3)", () => {
  it("세 번 틀릴 때마다 한 글자, 마지막 글자는 끝까지 안 드러난다", () => {
    expect(hintCount(0, 2)).toBe(0);
    expect(hintCount(2, 2)).toBe(0);
    expect(hintCount(3, 2)).toBe(1);
    expect(hintCount(99, 2)).toBe(1);
    expect(hintCount(6, 6)).toBe(2);
  });

  it("드러난 칸에는 정답 글자의 풀 인덱스가 앞에서부터 들어간다", () => {
    const pool = ["비", "좀", "밤", "좀"];
    expect(hintedSlots(pool, "좀비", 1)).toEqual([1, null]);
    expect(hintedSlots(pool, "좀비", 0)).toEqual([null, null]);
  });
});
