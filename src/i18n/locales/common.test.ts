import { describe, expect, it } from "vitest";
import en from "./en/common.json";
import ja from "./ja/common.json";
import ko from "./ko/common.json";

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
