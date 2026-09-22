import { describe, expect, it } from "vitest";
import { TALLY_PER_MARK, tallyGroups } from "./calendar";
import {
  clampStrokes,
  glyphStartMs,
  strokeDelays,
  TALLY_GLYPH_GAP_MS,
  TALLY_STROKE_MAX_MS,
  TALLY_STROKE_MIN_MS,
  TALLY_STROKES,
  TALLY_TOTAL_MS,
  tallyEndMs,
  tallyPace,
} from "./tally-glyph";

describe("正 strokes", () => {
  it("has exactly one stroke per counted day", () => {
    // 正 한 글자가 세는 날 수와 획 수가 같아야 remainder가 곧 미완 획 수다
    expect(TALLY_STROKES).toHaveLength(TALLY_PER_MARK);
    expect(TALLY_STROKES).toHaveLength(5);
  });

  it("gives every stroke a path that starts with a move", () => {
    for (const d of TALLY_STROKES) {
      expect(d.length).toBeGreaterThan(0);
      expect(d.startsWith("M")).toBe(true);
    }
    // 같은 획을 두 번 긋지 않는다
    expect(new Set(TALLY_STROKES).size).toBe(TALLY_STROKES.length);
  });

  it("clamps the stroke count to 0..5", () => {
    expect(clampStrokes(-1)).toBe(0);
    expect(clampStrokes(3.7)).toBe(3);
    expect(clampStrokes(9)).toBe(5);
  });
});

describe("stroke delays", () => {
  it("draws the strokes of one glyph one after another", () => {
    const delays = strokeDelays(0, 5, 80, 55);
    expect(delays).toEqual([0, 80, 160, 240, 320]);
  });

  it("starts the next glyph only after the previous one is finished, plus a breath", () => {
    const first = strokeDelays(0, 5, 80, 55);
    const second = strokeDelays(1, 5, 80, 55);
    // 앞 글자의 마지막 획이 끝나는 시각(320+80) + 숨(55)
    expect(second[0]).toBe(first[4] + 80 + 55);
    expect(glyphStartMs(1, 80, 55)).toBe(455);
    expect(glyphStartMs(0, 80, 55)).toBe(0);
  });

  it("is monotonic across a whole row", () => {
    const row = [0, 1, 2, 3].flatMap((index) => strokeDelays(index, 5, 60));
    for (let step = 1; step < row.length; step += 1) {
      expect(row[step]).toBeGreaterThan(row[step - 1]);
    }
  });

  it("gives a partial glyph only its remaining strokes", () => {
    const { remainder } = tallyGroups(13);
    expect(remainder).toBe(3);
    const delays = strokeDelays(2, remainder, 60);
    expect(delays).toHaveLength(3);
    // 미완 글자도 제자리 순서를 지킨다: 앞 두 글자 뒤에서 시작한다
    expect(delays[0]).toBe(glyphStartMs(2, 60));
    expect(strokeDelays(0, 0, 60)).toEqual([]);
  });
});

describe("pace", () => {
  it("fits a full November (six 正) inside the total budget", () => {
    const { full, remainder } = tallyGroups(30);
    const glyphs = full + (remainder > 0 ? 1 : 0);
    expect(glyphs).toBe(6);
    const pace = tallyPace(glyphs);
    expect(pace).toBeGreaterThanOrEqual(TALLY_STROKE_MIN_MS);
    expect(tallyEndMs(glyphs, pace)).toBeLessThanOrEqual(TALLY_TOTAL_MS);
  });

  it("slows down for fewer glyphs but never past the ceiling", () => {
    expect(tallyPace(1)).toBe(TALLY_STROKE_MAX_MS);
    expect(tallyPace(6)).toBeLessThan(tallyPace(3));
    // 글자가 아무리 많아도 획이 보이지 않을 만큼 빨라지지는 않는다
    expect(tallyPace(40)).toBe(TALLY_STROKE_MIN_MS);
  });

  it("uses the 55ms list stagger as the breath between glyphs", () => {
    expect(TALLY_GLYPH_GAP_MS).toBe(55);
  });
});
