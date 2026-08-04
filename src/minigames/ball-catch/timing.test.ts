import { describe, expect, it } from "vitest";
import {
  classifySwing,
  nextPitch,
  nextTempo,
  PITCH_OFFSET_MAX,
  PITCH_OFFSET_MIN,
  PITCH_TEMPOS,
  type PitchSide,
  type PitchTempoKey,
  ROUND_MS_FLOOR,
  ROUND_MS_MIN,
  ROUND_MS_START,
  ROUND_MS_STEP,
  remainingChances,
  roundDuration,
} from "./timing";

describe("classifySwing", () => {
  const window = [0.78, 1.12] as const;

  it("classifies attempts before, inside, and after the hit window", () => {
    expect(classifySwing(0.77, window)).toBe("early");
    expect(classifySwing(0.78, window)).toBe("hit");
    expect(classifySwing(1.12, window)).toBe("hit");
    expect(classifySwing(1.13, window)).toBe("late");
  });
});

describe("remainingChances", () => {
  it("clamps remaining misses at zero", () => {
    expect(remainingChances(1, 5)).toBe(4);
    expect(remainingChances(7, 5)).toBe(0);
  });
});

describe("nextPitch", () => {
  it("alternates sides so the same angle never repeats", () => {
    let side: PitchSide = 1;
    const sides: PitchSide[] = [];
    for (let round = 0; round < 6; round += 1) {
      const pitch = nextPitch(side, 0.5);
      side = pitch.side;
      sides.push(side);
    }
    expect(sides).toEqual([-1, 1, -1, 1, -1, 1]);
  });

  it("always leaves the mound off-centre by a readable amount", () => {
    // 한가운데(50)에서 던지면 궤적이 늘 같아 타이밍만 외우면 끝난다
    for (const random of [0, 0.25, 0.5, 0.75, 1]) {
      for (const lastSide of [-1, 1] as PitchSide[]) {
        const { startX } = nextPitch(lastSide, random);
        const offset = Math.abs(startX - 50);
        expect(offset).toBeGreaterThanOrEqual(PITCH_OFFSET_MIN);
        expect(offset).toBeLessThanOrEqual(PITCH_OFFSET_MAX);
      }
    }
  });

  it("keeps the ball inside the field at both extremes", () => {
    // 0~100%가 필드 폭이다. 공이 밖에서 출발하면 첫 프레임이 안 보인다.
    for (const lastSide of [-1, 1] as PitchSide[]) {
      const { startX } = nextPitch(lastSide, 1);
      expect(startX).toBeGreaterThan(4);
      expect(startX).toBeLessThan(96);
    }
  });

  it("clamps a random outside 0..1 instead of throwing the ball off-field", () => {
    expect(nextPitch(1, -5).startX).toBe(50 - PITCH_OFFSET_MIN);
    expect(nextPitch(1, 5).startX).toBe(50 - PITCH_OFFSET_MAX);
  });
});

describe("nextTempo", () => {
  it("never repeats the previous tempo", () => {
    // 같은 속도가 이어지면 두 번째 공은 변주가 아니라 기준이 된다
    for (const tempo of PITCH_TEMPOS) {
      for (const random of [0, 0.49, 0.5, 0.99]) {
        expect(nextTempo(tempo.key, random).key).not.toBe(tempo.key);
      }
    }
  });

  it("reaches both remaining tempos", () => {
    const seen = new Set([nextTempo("normal", 0).key, nextTempo("normal", 0.99).key]);
    expect(seen).toEqual(new Set(["slow", "fast"]));
  });

  it("stays on a real tempo when random lands outside 0..1", () => {
    // Math.random()은 1을 내지 않지만, 1이 들어와도 배열 밖을 짚으면 안 된다
    for (const random of [-1, 1, 5]) {
      expect(PITCH_TEMPOS).toContain(nextTempo("slow", random));
    }
  });
});

describe("roundDuration", () => {
  it("shortens the flight as hits pile up, then holds at the base minimum", () => {
    expect(roundDuration(0, 1)).toBe(ROUND_MS_START);
    expect(roundDuration(1, 1)).toBe(ROUND_MS_START - ROUND_MS_STEP);
    expect(roundDuration(9, 1)).toBe(ROUND_MS_MIN);
  });

  it("moves the flight time in both directions around the base", () => {
    const base = roundDuration(0, 1);
    const slow = PITCH_TEMPOS.find((tempo) => tempo.key === "slow");
    const fast = PITCH_TEMPOS.find((tempo) => tempo.key === "fast");
    expect(roundDuration(0, slow?.scale ?? 1)).toBeGreaterThan(base);
    expect(roundDuration(0, fast?.scale ?? 1)).toBeLessThan(base);
  });

  it("never lets a fast pitch drop below the reaction floor", () => {
    // 변주가 난이도 램프 위에 얹히므로, 둘이 겹친 최악의 경우를 못 박아 둔다
    for (let catches = 0; catches <= 20; catches += 1) {
      for (const tempo of PITCH_TEMPOS) {
        expect(roundDuration(catches, tempo.scale)).toBeGreaterThanOrEqual(ROUND_MS_FLOOR);
      }
    }
  });
});

describe("pitch variety", () => {
  it("changes both direction and speed on every pitch", () => {
    // 방향만 바뀌고 속도가 같으면 박자를 외워서 안 보고도 맞힐 수 있다
    let side: PitchSide = 1;
    let tempoKey: PitchTempoKey = "normal";
    const pitches: Array<{ side: PitchSide; tempoKey: PitchTempoKey }> = [];
    for (let round = 0; round < 8; round += 1) {
      const pitch = nextPitch(side, (round * 0.37) % 1);
      const tempo = nextTempo(tempoKey, (round * 0.61) % 1);
      side = pitch.side;
      tempoKey = tempo.key;
      pitches.push({ side, tempoKey });
    }
    for (let index = 1; index < pitches.length; index += 1) {
      expect(pitches[index].side).not.toBe(pitches[index - 1].side);
      expect(pitches[index].tempoKey).not.toBe(pitches[index - 1].tempoKey);
    }
  });
});
