import { describe, expect, it } from "vitest";
import {
  BROKEN_GLYPHS,
  RESEARCH_REDACTION_RATIO,
  type RedactedSegment,
  RUN_MAX,
  RUN_MIN,
  redactLine,
} from "./redaction";

const KO = "부모님은 연구소에서 앰플을 만들었다. 무엇을 치료하는지는 적혀 있지 않다.";
const EN = "Mother and father made the ampoule at the institute. What it treats is not written.";
const JA = "両親は研究所でアンプルを作った。何を治すのかは書かれていない。";

function join(segments: RedactedSegment[]): string {
  return segments.map((segment) => segment.text).join("");
}

/** 깨진 조각마다의 글자 수. 조각은 이미 같은 상태끼리 이어져 있어 곧 뭉치 길이다. */
function runLengths(segments: RedactedSegment[]): number[] {
  return segments
    .filter((segment) => segment.broken)
    .map((segment) => Array.from(segment.text).length);
}

function brokenCount(segments: RedactedSegment[]): number {
  return runLengths(segments).reduce((sum, length) => sum + length, 0);
}

const BLOCK_ONLY = new RegExp(`^[${BROKEN_GLYPHS.join("")}]+$`, "u");

describe("redactLine", () => {
  it("같은 입력이면 몇 번을 불러도 같은 자리가 깨진다", () => {
    const first = redactLine(KO, 1, RESEARCH_REDACTION_RATIO);
    const second = redactLine(KO, 1, RESEARCH_REDACTION_RATIO);
    expect(second).toEqual(first);
    expect(brokenCount(first)).toBeGreaterThan(0);
  });

  it("줄 번호가 다르면 다른 자리가 깨진다", () => {
    const line0 = redactLine(EN, 0, 0.3);
    const line1 = redactLine(EN, 1, 0.3);
    expect(join(line0)).not.toBe(join(line1));
  });

  it("ratio 0이면 원문 그대로인 조각 하나다", () => {
    for (const text of [KO, EN, JA, ""]) {
      expect(redactLine(text, 0, 0)).toEqual([{ text, broken: false }]);
    }
  });

  it("ratio는 0~1로 잘리고 NaN은 0이다", () => {
    expect(redactLine(EN, 0, -1)).toEqual(redactLine(EN, 0, 0));
    expect(redactLine(EN, 0, Number.NaN)).toEqual(redactLine(EN, 0, 0));
    expect(redactLine(EN, 0, 7)).toEqual(redactLine(EN, 0, 1));
    // ratio 1이면 대부분이 깨진다: 공백과 뭉치 사이의 한 글자만 남는다
    expect(brokenCount(redactLine(EN, 0, 1)) / Array.from(EN).length).toBeGreaterThan(0.5);
  });

  it("깨진 글자 수는 목표 비율을 넘지 않고 그 근처에 선다", () => {
    for (const [text, ratio] of [
      [KO, 0.22],
      [EN, 0.22],
      [JA, 0.22],
      [EN, 0.5],
    ] as const) {
      const count = Array.from(text).length;
      const target = Math.round(ratio * count);
      const actual = brokenCount(redactLine(text, 2, ratio));
      expect(actual).toBeLessThanOrEqual(target);
      expect(actual).toBeGreaterThanOrEqual(target - RUN_MIN - 1);
    }
  });

  it("뭉치는 2~5자다: 낱글자도, 긴 검열 막대도 없다", () => {
    for (const text of [KO, EN, JA]) {
      for (const ratio of [0.1, 0.22, 0.5, 1]) {
        for (let line = 0; line < 6; line += 1) {
          for (const length of runLengths(redactLine(text, line, ratio))) {
            expect(length).toBeGreaterThanOrEqual(RUN_MIN);
            expect(length).toBeLessThanOrEqual(RUN_MAX);
          }
        }
      }
    }
  });

  it("글자 수가 보존되고 깨진 자리에는 블록 문자만 선다", () => {
    for (const text of [KO, EN, JA]) {
      const segments = redactLine(text, 3, 0.4);
      expect(Array.from(join(segments)).length).toBe(Array.from(text).length);
      for (const segment of segments) {
        if (segment.broken) expect(segment.text).toMatch(BLOCK_ONLY);
        else expect(text).toContain(segment.text);
      }
    }
  });

  it("공백은 깨지지 않는다", () => {
    const original = Array.from(EN);
    const redacted = Array.from(join(redactLine(EN, 0, 1)));
    original.forEach((char, index) => {
      if (/\s/u.test(char)) expect(redacted[index]).toBe(char);
    });
    expect(redactLine("     ", 0, 1)).toEqual([{ text: "     ", broken: false }]);
  });

  it("언어와 상관없이 같은 상대 위치가 깨진다", () => {
    // 글자 수와 공백 자리가 같으면 글자가 달라도 깨지는 자리가 같다
    const latin = "abcde fghij klmno pqrst";
    const hangul = "가나다라마 바사아자차 카타파하거 너더러머버";
    const mask = (segments: RedactedSegment[]) =>
      segments.map((segment) => `${segment.broken ? "x" : "o"}${Array.from(segment.text).length}`);
    expect(mask(redactLine(hangul, 0, 0.4))).toEqual(mask(redactLine(latin, 0, 0.4)));
  });

  it("서로게이트 쌍도 글자 하나로 센다", () => {
    const text = "𝒜𝒷𝒸𝒹𝑒𝒻𝑔𝒽𝒾𝒿";
    const segments = redactLine(text, 0, 0.5);
    expect(Array.from(join(segments)).length).toBe(10);
  });
});
