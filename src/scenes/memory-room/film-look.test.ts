import { describe, expect, it } from "vitest";
import {
  ABERRATION,
  aberrationAmount,
  decayPulse,
  FILM_GRAIN_OPACITY,
  restingAberration,
} from "./film-look";

describe("film-look", () => {
  it("그레인은 있는 듯 없는 듯한 양이다", () => {
    expect(FILM_GRAIN_OPACITY).toBeGreaterThan(0);
    expect(FILM_GRAIN_OPACITY).toBeLessThan(0.2);
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
