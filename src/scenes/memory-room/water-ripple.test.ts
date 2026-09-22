import { describe, expect, it } from "vitest";
import { RIPPLE, rippleAlive, rippleAmplitude, rippleWavefront } from "./water-ripple";

describe("water-ripple", () => {
  it("닿기 전에는 물이 정지다: 진폭도 파두도 0", () => {
    expect(rippleAmplitude(-1)).toBe(0);
    expect(rippleAmplitude(0)).toBe(0);
    expect(rippleWavefront(-0.5)).toBe(0);
    expect(rippleWavefront(0)).toBe(0);
    expect(rippleAmplitude(Number.NaN)).toBe(0);
    expect(rippleAlive(0)).toBe(false);
  });

  it("진폭은 0~1 안이고 attack 근처에서 꼭대기를 찍는다", () => {
    let peakAt = 0;
    let peak = 0;
    for (let t = 0; t <= RIPPLE.duration; t += 0.005) {
      const amp = rippleAmplitude(t);
      expect(amp).toBeGreaterThanOrEqual(0);
      expect(amp).toBeLessThanOrEqual(1);
      if (amp > peak) {
        peak = amp;
        peakAt = t;
      }
    }
    expect(peak).toBeGreaterThan(0.8);
    expect(peakAt).toBeGreaterThan(0);
    expect(peakAt).toBeLessThanOrEqual(RIPPLE.attack * 1.5);
  });

  it("꼭대기 뒤로는 한 번도 되살아나지 않고 duration에서 거의 0이다", () => {
    let previous = rippleAmplitude(RIPPLE.attack);
    for (let t = RIPPLE.attack + 0.01; t <= RIPPLE.duration + 1; t += 0.01) {
      const amp = rippleAmplitude(t);
      expect(amp).toBeLessThanOrEqual(previous + 1e-12);
      previous = amp;
    }
    expect(rippleAmplitude(RIPPLE.duration)).toBeLessThan(0.025);
    expect(rippleAmplitude(RIPPLE.duration)).toBeGreaterThan(0);
    expect(rippleAlive(RIPPLE.duration)).toBe(false);
    expect(rippleAlive(RIPPLE.duration / 2)).toBe(true);
  });

  it("파두는 단조롭게 벌어지고 판 가장자리(0.5)를 넘되 reach를 넘지 않는다", () => {
    let previous = 0;
    for (let t = 0.01; t <= RIPPLE.duration; t += 0.01) {
      const front = rippleWavefront(t);
      expect(front).toBeGreaterThanOrEqual(previous);
      expect(front).toBeLessThan(RIPPLE.reach);
      previous = front;
    }
    // 잦아들기 전에 판 끝까지 닿아야 "대야 전체가 흔들리다 잔다"가 된다
    expect(rippleWavefront(RIPPLE.duration)).toBeGreaterThan(0.5);
    // 처음이 빠르다: 앞 절반 시간에 뒤 절반보다 더 멀리 간다
    const half = rippleWavefront(RIPPLE.duration / 2);
    expect(half).toBeGreaterThan(rippleWavefront(RIPPLE.duration) - half);
  });

  it("위상 속도는 파두보다 느리지 않다: 마루가 파두 안쪽에서 태어나 뒤로 흘러 나간다", () => {
    // 파두의 초기 속도 reach * spread 와 위상 속도 angularSpeed / waveNumber 를 견준다.
    // 초기 파두가 더 빨라 마루가 파두를 앞서지 못하고, 뒤에서 한 줄씩 따라붙는 그림이다
    const phaseSpeed = RIPPLE.angularSpeed / RIPPLE.waveNumber;
    expect(phaseSpeed).toBeGreaterThan(0.1);
    expect(phaseSpeed).toBeLessThan(RIPPLE.reach * RIPPLE.spread);
  });
});
