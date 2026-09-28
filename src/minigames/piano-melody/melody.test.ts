import { describe, expect, it } from "vitest";
import {
  barVisible,
  isComplete,
  isPrefix,
  MELODY,
  MELODY_BARS,
  MISSING_BAR,
  MISSING_FROM,
  MISSING_TO,
  NOTE_HZ,
  noteForKey,
  pressNote,
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

  it("조각이 없으면 지워진 마디는 무엇을 눌러도 어긋난다", () => {
    const before = MELODY.slice(0, MISSING_FROM);
    const right = MELODY[MISSING_FROM];
    expect(pressNote(before, right, true)).toMatchObject({ wrong: false });
    expect(pressNote(before, right, false)).toMatchObject({ wrong: true, missing: true });
    // 조각을 들고 오면 끝까지 칠 수 있다
    let played: Solfege[] = [];
    for (const note of MELODY) played = pressNote(played, note, true).played;
    expect(isComplete(played)).toBe(true);
    // 조각 없이는 끝까지 못 간다
    played = [];
    for (const note of MELODY) played = pressNote(played, note, false).played;
    expect(isComplete(played)).toBe(false);
    expect(MISSING_TO).toBeGreaterThan(MISSING_FROM);
  });

  it("어긋난 음이 첫 음이면 그 음부터 다시 센다", () => {
    const first = MELODY[0];
    const partial = MELODY.slice(0, 2);
    // 셋째 음 자리에 첫 음을 누르면(첫 음과 셋째 음이 다른 곡) 틀렸지만 새 시도의 첫 음이 된다
    expect(MELODY[2]).not.toBe(first);
    expect(pressNote(partial, first, true)).toEqual({
      played: [first],
      wrong: true,
      missing: false,
    });
    const other = MELODY[0] === "do" ? "re" : "do";
    expect(pressNote(partial, other, true).played).toEqual([]);
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
