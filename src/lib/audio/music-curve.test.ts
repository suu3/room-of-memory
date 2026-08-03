import { describe, expect, it } from "vitest";
import { foldLoopTail, musicCutoff, musicVolume } from "./music-curve";

describe("music brightness curve", () => {
  it("opens the filter as the room brightens", () => {
    expect(musicCutoff(0)).toBeLessThan(musicCutoff(0.5));
    expect(musicCutoff(0.5)).toBeLessThan(musicCutoff(1));
  });

  it("keeps the dark end muffled but audible", () => {
    // 400Hz 아래로 내려가면 피아노가 아니라 웅웅거림으로 들린다
    expect(musicCutoff(0)).toBeGreaterThanOrEqual(400);
    // 가청 대역을 다 열어야 "선명해졌다"가 성립한다
    expect(musicCutoff(1)).toBeGreaterThan(12_000);
  });

  it("moves the filter evenly across the range, not just at the bright end", () => {
    // 선형 보간이면 중간값이 두 끝의 산술평균에 붙는다. 지수 보간이라야
    // 어두운 구간에서도 변화가 들린다.
    const midpoint = musicCutoff(0.5);
    const arithmetic = (musicCutoff(0) + musicCutoff(1)) / 2;
    expect(midpoint).toBeLessThan(arithmetic / 2);
  });

  it("clamps out-of-range levels instead of running off the scale", () => {
    expect(musicCutoff(-1)).toBe(musicCutoff(0));
    expect(musicCutoff(4)).toBe(musicCutoff(1));
    expect(musicVolume(-1)).toBe(musicVolume(0));
    expect(musicVolume(4)).toBe(musicVolume(1));
    expect(musicVolume(Number.NaN)).toBe(musicVolume(0));
  });

  it("stays audible as a bed without covering the sound effects", () => {
    // voices.ts에서 제일 큰 소리가 0.5다. BGM이 그걸 넘으면 조작음이 묻힌다.
    expect(musicVolume(1)).toBeLessThan(0.5);
    // 배경음이라도 0.25 아래로 내려가면 마스터 0.7을 거치며 사실상 안 들린다
    expect(musicVolume(0)).toBeGreaterThan(0.25);
    expect(musicVolume(0)).toBeLessThan(musicVolume(1));
  });
});

describe("loop crossfade folding", () => {
  const ramp = (length: number, value: (index: number) => number) =>
    Float32Array.from({ length }, (_, index) => value(index));

  it("shortens the buffer by exactly the fade width", () => {
    const source = ramp(100, () => 1);
    expect(foldLoopTail(source, 10)).toHaveLength(90);
  });

  it("starts the loop with the old tail and hands over to the head", () => {
    // 머리는 1, 꼬리는 -1 — 접힌 구간이 어느 쪽에서 어느 쪽으로 넘어가는지 본다
    const source = ramp(120, (index) => (index >= 100 ? -1 : 1));
    const folded = foldLoopTail(source, 20);

    // 루프가 다시 시작하는 순간은 직전에 흐르던 꼬리를 이어받는다
    expect(folded[0]).toBeCloseTo(-1, 5);
    // 접힌 구간을 지나며 머리 쪽으로 넘어간다 (끝 지점은 아직 꼬리가 조금 남아 있다)
    expect(folded[19]).toBeGreaterThan(0.9);
    // 되돌아가는 구간 없이 한 방향으로만 넘어간다
    for (let index = 1; index < 20; index += 1) {
      expect(folded[index]).toBeGreaterThan(folded[index - 1]);
    }
  });

  it("holds the level steady through the fold instead of dipping", () => {
    // 등출력 곡선이라야 겹치는 구간에서 음량이 파이지 않는다. 선형이면 중간이 0.707로 꺼진다.
    const source = ramp(300, () => 1);
    const folded = foldLoopTail(source, 60);
    for (let index = 0; index < 60; index += 1) {
      expect(Math.abs(folded[index])).toBeGreaterThan(0.99);
    }
  });

  it("never eats more than a third of the track", () => {
    const source = ramp(90, () => 1);
    // 짧은 트랙에 긴 페이드를 요청해도 곡이 사라지지 않는다
    expect(foldLoopTail(source, 500).length).toBeGreaterThanOrEqual(60);
  });

  it("returns a copy when there is nothing to fold", () => {
    const source = ramp(10, (index) => index);
    const folded = foldLoopTail(source, 0);
    expect(Array.from(folded)).toEqual(Array.from(source));
    expect(folded).not.toBe(source);
  });
});
