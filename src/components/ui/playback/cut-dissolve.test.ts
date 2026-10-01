import { describe, expect, it } from "vitest";
import {
  bakeNoise,
  dissolveThreshold,
  grainForCut,
  meanNeighborDifference,
  type NoiseGrain,
} from "./cut-dissolve";

const GRAINS: readonly NoiseGrain[] = ["paper", "film", "water"];

describe("cut-dissolve", () => {
  it("결은 컷 번호를 따라 세 개가 돌아가며 나온다", () => {
    const first = [0, 1, 2].map(grainForCut);
    expect(new Set(first).size).toBe(3);
    // 한 바퀴 돌면 같은 자리
    expect(grainForCut(3)).toBe(grainForCut(0));
    expect(grainForCut(4)).toBe(grainForCut(1));
    expect(grainForCut(7)).toBe(grainForCut(1));
  });

  it("문턱값은 1에서 0으로 smoothstep으로 내려가고 범위 밖은 끝값에 붙는다", () => {
    expect(dissolveThreshold(0, 600)).toBe(1);
    expect(dissolveThreshold(600, 600)).toBe(0);
    expect(dissolveThreshold(-50, 600)).toBe(1);
    expect(dissolveThreshold(900, 600)).toBe(0);
    // 가운데는 정확히 반. 양끝은 직선보다 느리다 (smoothstep의 모양)
    expect(dissolveThreshold(300, 600)).toBeCloseTo(0.5);
    expect(dissolveThreshold(60, 600)).toBeGreaterThan(0.9);
    expect(dissolveThreshold(540, 600)).toBeLessThan(0.1);
    // 길이 0은 곧바로 끝
    expect(dissolveThreshold(0, 0)).toBe(0);
  });

  it("노이즈 판은 width*height 길이이고 값은 바이트 범위다", () => {
    for (const grain of GRAINS) {
      const noise = bakeNoise(64, 32, grain, 7);
      expect(noise).toBeInstanceOf(Uint8Array);
      expect(noise.length).toBe(64 * 32);
      let min = 255;
      let max = 0;
      for (const value of noise) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeLessThanOrEqual(255);
      // 통짜 회색 판이면 문턱값이 한 번에 걷힌다. 어둠과 밝음이 둘 다 있어야 한다
      expect(min).toBeLessThan(64);
      expect(max).toBeGreaterThan(191);
    }
  });

  it("같은 시드는 같은 판, 다른 시드는 다른 판", () => {
    for (const grain of GRAINS) {
      const a = bakeNoise(32, 32, grain, 11);
      const b = bakeNoise(32, 32, grain, 11);
      const c = bakeNoise(32, 32, grain, 12);
      expect(Array.from(a)).toEqual(Array.from(b));
      expect(Array.from(a)).not.toEqual(Array.from(c));
    }
  });

  it("물 얼룩은 필름 그레인보다 부드럽고, 종이는 그 사이다", () => {
    const size = 128;
    const film = meanNeighborDifference(bakeNoise(size, size, "film", 3), size, size);
    const paper = meanNeighborDifference(bakeNoise(size, size, "paper", 3), size, size);
    const water = meanNeighborDifference(bakeNoise(size, size, "water", 3), size, size);
    // 백색 잡음의 이웃 차 기대값은 255/3 근처
    expect(film).toBeGreaterThan(60);
    expect(water).toBeLessThan(film / 4);
    expect(paper).toBeLessThan(film);
    expect(paper).toBeGreaterThan(water);
  });

  it("종이 결은 가로로 눕는다: 가로 이웃 차가 세로 이웃 차보다 작다", () => {
    const size = 128;
    const noise = bakeNoise(size, size, "paper", 5);
    let across = 0;
    let down = 0;
    for (let y = 0; y < size - 1; y += 1) {
      for (let x = 0; x < size - 1; x += 1) {
        const here = noise[y * size + x];
        across += Math.abs(here - noise[y * size + x + 1]);
        down += Math.abs(here - noise[(y + 1) * size + x]);
      }
    }
    expect(across).toBeLessThan(down * 0.6);
  });

  it("빈 판은 빈 배열", () => {
    expect(bakeNoise(0, 10, "film", 1).length).toBe(0);
  });
});
