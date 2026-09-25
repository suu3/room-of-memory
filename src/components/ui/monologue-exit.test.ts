import { describe, expect, it } from "vitest";
import {
  EXIT_CHAR_MS,
  EXIT_SPREAD_MS,
  EXIT_TOTAL_MS,
  exitDirection,
  exitPlan,
} from "./monologue-exit";

const SAMPLE = "불을 켜지 않아도 어디에 뭐가 있는지 안다.";

describe("monologue-exit", () => {
  it("1막은 떨어지고 2막부터는 모인다", () => {
    expect(exitDirection(1)).toBe("down");
    expect(exitDirection(2)).toBe("up");
    expect(exitDirection(3)).toBe("up");
  });

  it("전체 시간은 지연의 폭에 글자 하나의 길이를 더한 것이다", () => {
    expect(EXIT_TOTAL_MS).toBe(EXIT_SPREAD_MS + EXIT_CHAR_MS);
  });

  it("글자 수를 보존하고 공백도 한 글자로 남긴다", () => {
    for (const act of [1, 2, 3] as const) {
      const plan = exitPlan(SAMPLE, act, 220);
      expect(plan).toHaveLength(Array.from(SAMPLE).length);
      expect(plan.map((entry) => entry.char).join("")).toBe(SAMPLE);
    }
  });

  it("서로게이트 쌍(이모지)도 한 글자다", () => {
    const plan = exitPlan("a😀b", 2, 100);
    expect(plan.map((entry) => entry.char)).toEqual(["a", "😀", "b"]);
  });

  it("지연은 전부 [0, totalMs] 안이다", () => {
    for (const act of [1, 2, 3] as const) {
      for (const entry of exitPlan(SAMPLE, act, 220)) {
        expect(entry.delayMs).toBeGreaterThanOrEqual(0);
        expect(entry.delayMs).toBeLessThanOrEqual(220);
      }
    }
  });

  it("1막: 마지막 글자가 0, 앞으로 갈수록 늘고, 꼬리 밖은 전부 totalMs", () => {
    const plan = exitPlan(SAMPLE, 1, 220);
    const length = plan.length;
    const tail = Math.min(8, Math.ceil(length * 0.4));
    expect(plan[length - 1]?.delayMs).toBe(0);
    // 꼬리 안에서는 앞 글자일수록 늦다
    for (let index = length - tail + 1; index < length; index += 1) {
      const current = plan[index]?.delayMs ?? 0;
      const before = plan[index - 1]?.delayMs ?? 0;
      expect(before).toBeGreaterThan(current);
    }
    // 꼬리의 첫 글자가 totalMs에 닿고, 그 앞은 전부 같은 값으로 한꺼번에 꺼진다
    expect(plan[length - tail]?.delayMs).toBeCloseTo(220);
    for (let index = 0; index < length - tail; index += 1) {
      expect(plan[index]?.delayMs).toBe(220);
    }
  });

  it("1막 꼬리는 8글자를 넘지 않고, 짧은 문장은 40%다", () => {
    const long = exitPlan("가".repeat(40), 1, 100);
    const staggeredLong = long.filter((entry) => entry.delayMs < 100).length;
    // 꼬리 8글자 중 첫 글자(delay=100)를 뺀 7글자만 100 미만
    expect(staggeredLong).toBe(7);

    const short = exitPlan("가".repeat(5), 1, 100);
    // ceil(5 * 0.4) = 2: 마지막은 0, 그 앞은 100, 나머지도 100
    expect(short.map((entry) => entry.delayMs)).toEqual([100, 100, 100, 100, 0]);
  });

  it("2막·3막: 첫 글자가 0, 마지막 글자가 totalMs, 사이는 고르게 늘어난다", () => {
    for (const act of [2, 3] as const) {
      const plan = exitPlan(SAMPLE, act, 220);
      expect(plan[0]?.delayMs).toBe(0);
      expect(plan[plan.length - 1]?.delayMs).toBeCloseTo(220);
      for (let index = 1; index < plan.length; index += 1) {
        expect(plan[index]?.delayMs).toBeGreaterThan(plan[index - 1]?.delayMs ?? 0);
      }
    }
  });

  it("글자 하나·빈 문자열에서도 0으로 나누지 않는다", () => {
    expect(exitPlan("가", 1, 220)).toEqual([{ char: "가", delayMs: 0 }]);
    expect(exitPlan("가", 2, 220)).toEqual([{ char: "가", delayMs: 0 }]);
    expect(exitPlan("", 1, 220)).toEqual([]);
    expect(exitPlan("", 2, 220)).toEqual([]);
  });

  it("음수 totalMs는 0으로 본다", () => {
    for (const entry of exitPlan(SAMPLE, 2, -50)) expect(entry.delayMs).toBe(0);
  });
});
