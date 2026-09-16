import { describe, expect, it } from "vitest";
import {
  barVisible,
  isComplete,
  isPrefix,
  MELODY,
  MELODY_BARS,
  MISSING_BAR,
  NOTE_HZ,
  noteForKey,
  SOLFEGE,
  type Solfege,
} from "./melody";

describe("피아노 멜로디", () => {
  it("곡은 건반에 있는 음으로만 이루어진다", () => {
    for (const note of MELODY) expect(SOLFEGE).toContain(note);
  });

  it("음마다 주파수가 있고, 순서대로 높아진다", () => {
    const hz = SOLFEGE.map((note) => NOTE_HZ[note]);
    for (const value of hz) expect(value).toBeGreaterThan(0);
    expect([...hz].sort((a, b) => a - b)).toEqual(hz);
  });

  it("마디를 이으면 곡이 된다", () => {
    expect(MELODY_BARS.flat()).toEqual([...MELODY]);
  });

  it("지워진 마디는 조각을 들고 있을 때만 드러난다", () => {
    expect(barVisible(MISSING_BAR, false)).toBe(false);
    expect(barVisible(MISSING_BAR, true)).toBe(true);
    for (let bar = 0; bar < MELODY_BARS.length; bar += 1) {
      if (bar !== MISSING_BAR) expect(barVisible(bar, false)).toBe(true);
    }
  });

  it("맞게 가는 동안은 이어지고, 어긋나면 그 자리에서 끊긴다", () => {
    expect(isPrefix([])).toBe(true);
    expect(isPrefix(MELODY.slice(0, 3))).toBe(true);
    expect(isPrefix(MELODY)).toBe(true);
    const wrong: Solfege[] = [...MELODY.slice(0, 2), MELODY[2] === "mi" ? "do" : "mi"];
    expect(isPrefix(wrong)).toBe(false);
  });

  it("끝까지 쳐야 끝난 것이다", () => {
    expect(isComplete(MELODY.slice(0, -1))).toBe(false);
    expect(isComplete(MELODY)).toBe(true);
    expect(isComplete([...MELODY, MELODY[0]])).toBe(false);
  });

  it("숫자 키 1~7이 계이름 일곱에 차례로 붙는다", () => {
    SOLFEGE.forEach((note, index) => {
      expect(noteForKey(String(index + 1))).toBe(note);
    });
    expect(noteForKey("0")).toBeNull();
    expect(noteForKey("8")).toBeNull();
    expect(noteForKey("a")).toBeNull();
  });
});
