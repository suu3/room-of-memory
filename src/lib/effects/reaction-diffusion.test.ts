import { describe, expect, it } from "vitest";
import { bakeGrayScott, stainPixels } from "./reaction-diffusion";

describe("reaction-diffusion", () => {
  it("값은 0~1이고 격자 크기를 지킨다", () => {
    const field = bakeGrayScott({ width: 24, height: 16, steps: 40, seed: 3 });
    expect(field.length).toBe(24 * 16);
    for (const value of field) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("같은 씨앗이면 같은 무늬다", () => {
    const one = bakeGrayScott({ width: 16, height: 16, steps: 30, seed: 7 });
    const two = bakeGrayScott({ width: 16, height: 16, steps: 30, seed: 7 });
    expect(Array.from(one)).toEqual(Array.from(two));
  });

  it("스텝을 돌리면 무늬가 씨앗 밖으로 번진다", () => {
    const early = bakeGrayScott({ width: 32, height: 32, steps: 1, seed: 1 });
    const late = bakeGrayScott({ width: 32, height: 32, steps: 120, seed: 1 });
    const covered = (field: Float32Array) => field.filter((value) => value > 0.05).length;
    expect(covered(late)).toBeGreaterThan(covered(early));
  });

  it("픽셀은 무늬가 진할수록 어둡고, depth 0이면 전부 흰색이다", () => {
    const field = Float32Array.from([0, 0.5, 1]);
    const pixels = stainPixels(field, 0.4);
    expect(pixels[0]).toBe(255);
    expect(pixels[4]).toBeLessThan(255);
    expect(pixels[8]).toBeLessThan(pixels[4]);
    expect(pixels[3]).toBe(255);
    expect(Array.from(stainPixels(field, 0)).filter((_, index) => index % 4 !== 3)).toEqual([
      255, 255, 255, 255, 255, 255, 255, 255, 255,
    ]);
  });
});
