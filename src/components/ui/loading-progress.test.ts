import { describe, expect, it } from "vitest";
import { advanceLoadProgress } from "./loading-progress";

/** 프레임 하나(≈60fps)씩 여러 번 굴린다. */
function run({
  shown,
  target,
  frames,
  deltaMs = 16,
}: {
  shown: number;
  target: number;
  frames: number;
  deltaMs?: number;
}): number {
  let value = shown;
  for (let index = 0; index < frames; index += 1) {
    value = advanceLoadProgress({ shown: value, target, deltaMs });
  }
  return value;
}

describe("advanceLoadProgress", () => {
  it("보고가 0에 멈춰 있어도 바는 움직인다 — 멈춘 바는 고장 난 것처럼 보인다", () => {
    const afterOneSecond = run({ shown: 0, target: 0, frames: 60 });

    expect(afterOneSecond).toBeGreaterThan(0.1);
  });

  it("기어오르기에는 상한이 있다 — 아무것도 안 받았는데 90%를 그리면 거짓말이다", () => {
    // 30초를 굴려도 남은 구간의 몫(38%)을 넘지 않는다
    const afterHalfMinute = run({ shown: 0, target: 0, frames: 1800 });

    expect(afterHalfMinute).toBeLessThanOrEqual(0.38);
    expect(afterHalfMinute).toBeCloseTo(0.38, 2);
  });

  it("상한은 보고를 따라 감속한다 — 뒤로 갈수록 덜 앞서 나간다", () => {
    const early = run({ shown: 0, target: 0, frames: 1800 });
    const late = run({ shown: 0.8, target: 0.8, frames: 1800 });

    // 0%에서는 38%를 앞서지만 80%에서는 7.6%만 앞선다
    expect(early - 0).toBeGreaterThan(late - 0.8);
    expect(late).toBeCloseTo(0.88, 2);
  });

  it("계단이 튀면 빠르게 따라붙는다", () => {
    // 파일 하나가 통째로 끝나 보고가 0.2에서 0.6으로 뛴 직후
    const afterQuarterSecond = run({ shown: 0.2, target: 0.6, frames: 15 });

    expect(afterQuarterSecond).toBeGreaterThan(0.4);
    expect(afterQuarterSecond).toBeLessThan(0.6);
  });

  it("한 프레임으로는 목표에 닿지 않는다 — 그래야 계단이 경사로가 된다", () => {
    const next = advanceLoadProgress({ shown: 0.2, target: 0.6, deltaMs: 16 });

    expect(next).toBeGreaterThan(0.2);
    expect(next).toBeLessThan(0.35);
  });

  it("다 받으면 1에 정확히 못을 박는다 — 0.9998에 멈추면 커튼도 같이 안 걷힌다", () => {
    const afterOneSecond = run({ shown: 0.4, target: 1, frames: 60 });

    expect(afterOneSecond).toBe(1);
  });

  it("되감지 않는다", () => {
    // 기어오른 값보다 보고가 뒤에 있는 순간 (0.3까지 기어올랐는데 보고는 아직 0.1)
    const next = advanceLoadProgress({ shown: 0.3, target: 0.1, deltaMs: 16 });

    expect(next).toBeGreaterThanOrEqual(0.3);
  });

  it("탭이 쉬다 돌아와 델타가 크게 튀어도 상한을 넘지 않는다", () => {
    const next = advanceLoadProgress({ shown: 0.1, target: 0.1, deltaMs: 30_000 });

    expect(next).toBeLessThanOrEqual(0.1 + 0.9 * 0.38);
  });

  it("델타가 0이면 아무 일도 없다 — 첫 프레임에는 흐른 시간을 모른다", () => {
    expect(advanceLoadProgress({ shown: 0.25, target: 0.9, deltaMs: 0 })).toBe(0.25);
  });
});
