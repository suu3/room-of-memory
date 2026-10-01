import { describe, expect, it } from "vitest";
import { reconstructionAt, SETTLE_S, WIREFRAME_S } from "./reconstruction";

describe("reconstructionAt", () => {
  it("시작 전과 끝난 뒤는 아무 일도 없다", () => {
    expect(reconstructionAt(-1)).toEqual({ wireframe: false, settle: 0, done: true });
    expect(reconstructionAt(Number.POSITIVE_INFINITY).done).toBe(true);
    expect(reconstructionAt(WIREFRAME_S + SETTLE_S + 0.01).done).toBe(true);
  });

  it("앞 구간은 선, 뒤 구간은 면 위에 잦아드는 결이다", () => {
    expect(reconstructionAt(0.1)).toEqual({ wireframe: true, settle: 1, done: false });
    const mid = reconstructionAt(WIREFRAME_S + SETTLE_S / 2);
    expect(mid.wireframe).toBe(false);
    expect(mid.settle).toBeGreaterThan(0);
    expect(mid.settle).toBeLessThan(1);
    expect(mid.done).toBe(false);
  });

  it("결은 단조 감소한다", () => {
    let previous = 1;
    for (let t = WIREFRAME_S; t < WIREFRAME_S + SETTLE_S; t += 0.05) {
      const { settle } = reconstructionAt(t);
      expect(settle).toBeLessThanOrEqual(previous);
      previous = settle;
    }
  });
});
