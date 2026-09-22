import { describe, expect, it } from "vitest";
import {
  ABERRATION,
  aberrationAmount,
  decayPulse,
  FILM_GRAIN_OPACITY,
  GRAIN_PULSE_GAIN,
  grainOpacity,
  restingAberration,
} from "./film-look";

describe("film-look", () => {
  it("그레인은 있는 듯 없는 듯한 양이다", () => {
    expect(FILM_GRAIN_OPACITY).toBeGreaterThan(0);
    expect(FILM_GRAIN_OPACITY).toBeLessThan(0.2);
  });

  it("그레인은 펄스 꼭대기에서 (1 + gain)배까지 진해지고 범위 밖은 끝값에 붙는다", () => {
    expect(grainOpacity(0)).toBe(FILM_GRAIN_OPACITY);
    expect(grainOpacity(1)).toBeCloseTo(FILM_GRAIN_OPACITY * (1 + GRAIN_PULSE_GAIN));
    expect(grainOpacity(5)).toBeCloseTo(grainOpacity(1));
    expect(grainOpacity(-1)).toBe(grainOpacity(0));
  });

  it("밝은 방에서는 base, 가장 어두운 지점에서는 base의 (1 + dimGain)배", () => {
    expect(restingAberration(0)).toBeCloseTo(ABERRATION.base);
    expect(restingAberration(1)).toBeCloseTo(ABERRATION.base * (1 + ABERRATION.dimGain));
    // 범위 밖은 끝값에 붙는다
    expect(restingAberration(-3)).toBeCloseTo(restingAberration(0));
    expect(restingAberration(7)).toBeCloseTo(restingAberration(1));
  });

  it("튄 값은 쉬는 값 위에 곧바로 얹힌다", () => {
    const resting = restingAberration(0.5);
    expect(aberrationAmount(resting, 0)).toBe(resting);
    expect(aberrationAmount(resting, 1)).toBeCloseTo(resting + ABERRATION.pulse);
    expect(aberrationAmount(resting, 4)).toBeCloseTo(resting + ABERRATION.pulse);
  });

  it("잡음은 펄스와 상한을 나눠 쓴다: 둘 중 큰 값 하나만 센다", () => {
    const resting = restingAberration(0.2);
    expect(aberrationAmount(resting, 0, 1)).toBeCloseTo(resting + ABERRATION.pulse);
    expect(aberrationAmount(resting, 1, 1)).toBeCloseTo(resting + ABERRATION.pulse);
    expect(grainOpacity(0, 0.5)).toBeCloseTo(grainOpacity(0.5));
    expect(grainOpacity(1, 1)).toBeCloseTo(grainOpacity(1));
  });

  it("깨끗해지는 값이 1이면 색수차도 그레인도 사라진다", () => {
    expect(aberrationAmount(restingAberration(1), 1, 1, 1)).toBe(0);
    expect(grainOpacity(1, 1, 1)).toBe(0);
    expect(grainOpacity(0, 0, 0.5)).toBeCloseTo(FILM_GRAIN_OPACITY * 0.5);
  });

  it("튄 값은 1초 남짓이면 거의 사라지고, 아주 작아지면 0으로 끊긴다", () => {
    let pulse = 1;
    for (let frame = 0; frame < 60; frame++) pulse = decayPulse(pulse, 1 / 60);
    expect(pulse).toBeLessThan(0.03);
    for (let frame = 0; frame < 120; frame++) pulse = decayPulse(pulse, 1 / 60);
    expect(pulse).toBe(0);
  });

  it("감쇠는 프레임 길이와 무관하게 같은 곡선이다", () => {
    let fine = 1;
    for (let frame = 0; frame < 30; frame++) fine = decayPulse(fine, 1 / 60);
    const coarse = decayPulse(1, 0.5);
    expect(fine).toBeCloseTo(coarse, 5);
  });
});
