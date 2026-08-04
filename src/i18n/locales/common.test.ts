import { describe, expect, it } from "vitest";
import en from "./en/common.json";
import ja from "./ja/common.json";
import ko from "./ko/common.json";

/** 중첩 객체를 "a.b.c" 키 목록으로 편다. */
function flatKeys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    child !== null && typeof child === "object"
      ? flatKeys(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("locale parity", () => {
  it.each([
    ["English", en],
    ["Japanese", ja],
  ])("gives %s every key Korean has, and no extras", (_language, locale) => {
    // 조작 안내의 _touch 변형은 기기별로 갈리는 문구라 한 언어만 빠뜨리기 쉽다.
    expect(flatKeys(locale).sort()).toEqual(flatKeys(ko).sort());
  });
});

describe("ball-catching timing feedback locales", () => {
  it.each([
    ["Korean", ko, "빨랐어", "늦었어"],
    ["English", en, "EARLY", "LATE"],
    ["Japanese", ja, "早い", "遅い"],
  ])("keeps the exact approved %s early and late copy", (_language, locale, early, late) => {
    expect(locale.minigame.ballCatch.early).toBe(early);
    expect(locale.minigame.ballCatch.late).toBe(late);
  });
});
