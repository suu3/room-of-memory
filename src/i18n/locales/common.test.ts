import { describe, expect, it } from "vitest";
import en from "./en/common.json";
import enRoom from "./en/memory-room.json";
import ja from "./ja/common.json";
import jaRoom from "./ja/memory-room.json";
import ko from "./ko/common.json";
import koRoom from "./ko/memory-room.json";

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

/**
 * 대사는 세 언어를 함께 쓰는 것이 규칙이라(.claude/rules/narrative-content.md), 스토리
 * 네임스페이스도 공용 UI와 같은 잣대로 본다. 컷씬·재조사 대사처럼 한 번에 여러 줄이
 * 늘어나는 자리에서 한 언어만 빠뜨리기 쉽다.
 */
describe("memoryRoom locale parity", () => {
  it.each([
    ["English", enRoom],
    ["Japanese", jaRoom],
  ])("gives %s every story key Korean has, and no extras", (_language, locale) => {
    expect(flatKeys(locale).sort()).toEqual(flatKeys(koRoom).sort());
  });
});

describe("ball-catching timing feedback locales", () => {
  it.each([
    ["Korean", ko, "빨랐다", "늦었다"],
    ["English", en, "EARLY", "LATE"],
    ["Japanese", ja, "早い", "遅い"],
  ])("keeps the exact approved %s early and late copy", (_language, locale, early, late) => {
    expect(locale.minigame.ballCatch.early).toBe(early);
    expect(locale.minigame.ballCatch.late).toBe(late);
  });
});
