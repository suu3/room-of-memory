import { describe, expect, it } from "vitest";
import { downsample, WAVEFORM_POINTS, waveformPath } from "./waveform";

describe("downsample", () => {
  it("target 길이만큼 채우고 첫 샘플은 소스의 첫 샘플이다", () => {
    const source = Float32Array.from({ length: 256 }, (_, i) => i);
    const out = downsample(source, new Float32Array(WAVEFORM_POINTS));
    expect(out).toHaveLength(WAVEFORM_POINTS);
    expect(out[0]).toBe(0);
  });

  it("순서를 지키며 고르게 골라 뽑는다 (평균을 내지 않는다)", () => {
    // 오름차순 램프를 넣으면 골라 뽑은 값도 오름차순이어야 한다. 평균을 냈다면
    // 정수 아닌 값이 섞여 나온다.
    const source = Float32Array.from({ length: 256 }, (_, i) => i);
    const out = downsample(source, new Float32Array(64));
    for (let i = 1; i < out.length; i += 1) {
      expect(out[i]).toBeGreaterThan(out[i - 1]);
      expect(Number.isInteger(out[i])).toBe(true);
    }
    expect(out[63]).toBe(252);
  });

  it("소스가 짧으면 반복하고, 비어 있으면 0으로 채운다", () => {
    const short = downsample([1, 2], new Float32Array(4));
    expect([...short]).toEqual([1, 1, 2, 2]);
    const target = new Float32Array(3).fill(9);
    expect([...downsample([], target)]).toEqual([0, 0, 0]);
  });

  it("받은 배열을 그대로 돌려준다 (프레임마다 재사용한다)", () => {
    const target = new Float32Array(8);
    expect(downsample([0.5], target)).toBe(target);
  });
});

describe("waveformPath", () => {
  it("0만 있으면 세로 가운데의 평평한 선이다", () => {
    const path = waveformPath(new Float32Array(4), 300, 40);
    expect(path).toHaveLength(8);
    for (let i = 1; i < path.length; i += 2) expect(path[i]).toBe(20);
  });

  it("x는 0에서 width까지 고르게 벌린다", () => {
    const path = waveformPath(new Float32Array(5), 100, 10);
    expect([path[0], path[2], path[4], path[6], path[8]]).toEqual([0, 25, 50, 75, 100]);
  });

  it("양수는 위로, 음수는 아래로. gain이 세로 배율이다", () => {
    const [, up, , down] = waveformPath([0.5, -0.5], 10, 100);
    expect(up).toBe(25);
    expect(down).toBe(75);
    const [, gained] = waveformPath([0.05], 10, 100, 10);
    expect(gained).toBe(25);
  });

  it("배율을 곱한 값이 넘치면 캔버스 안(0~height)에서 잘린다", () => {
    const [, top, , bottom] = waveformPath([4, -4], 10, 100, 3);
    expect(top).toBe(0);
    expect(bottom).toBe(100);
  });

  it("NaN은 가운데로 눕힌다", () => {
    const [, y] = waveformPath([Number.NaN], 10, 60);
    expect(y).toBe(30);
  });

  it("점 하나면 왼쪽 끝에 선다", () => {
    const [x] = waveformPath([1], 50, 10);
    expect(x).toBe(0);
  });

  it("받은 배열에 써넣고 그대로 돌려준다", () => {
    const target = new Float32Array(4);
    expect(waveformPath([1, -1], 10, 10, 1, target)).toBe(target);
    expect([...target]).toEqual([0, 0, 10, 10]);
  });
});
