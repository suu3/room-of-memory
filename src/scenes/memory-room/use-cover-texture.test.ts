import { describe, expect, it } from "vitest";
import { coverTransform } from "./use-cover-texture";

/** 액자 구멍 비율 (MemoryObjects의 FRAME_OPENING_ASPECT와 같은 값). */
const FRAME_ASPECT = 0.43 / 0.31;
/** 실제로 걸리는 사진 (mg-photo-wipe-phase-1.webp, 1400x1063). */
const PHOTO_ASPECT = 1400 / 1063;

describe("cover transform", () => {
  it("leaves the image alone when it already matches the plane", () => {
    expect(coverTransform(1.5, 1.5)).toEqual({ repeat: [1, 1], offset: [0, 0] });
  });

  it("crops the sides of an image that is wider than the plane", () => {
    // 2:1 그림을 1:1 판에 = 가로를 절반만 쓰고, 남는 절반을 양쪽에 나눈다
    const { repeat, offset } = coverTransform(2, 1);
    expect(repeat).toEqual([0.5, 1]);
    expect(offset).toEqual([0.25, 0]);
  });

  it("crops the top and bottom of an image that is taller than the plane", () => {
    const { repeat, offset } = coverTransform(1, 2);
    expect(repeat).toEqual([1, 0.5]);
    expect(offset).toEqual([0, 0.25]);
  });

  it("always keeps the crop centered", () => {
    for (const imageAspect of [0.4, 1, 1.32, 3]) {
      const { repeat, offset } = coverTransform(imageAspect, FRAME_ASPECT);
      // 남은 여백이 양쪽에 똑같이 붙어야 가운데가 살아남는다
      expect(offset[0]).toBeCloseTo((1 - repeat[0]) / 2, 10);
      expect(offset[1]).toBeCloseTo((1 - repeat[1]) / 2, 10);
    }
  });

  it("never leaves a gap: one axis always fills the plane completely", () => {
    for (const imageAspect of [0.4, 1, 1.32, 3]) {
      const { repeat } = coverTransform(imageAspect, FRAME_ASPECT);
      // cover의 정의: 한 축은 꽉 차고(=1) 다른 축이 잘린다(<=1)
      expect(Math.max(repeat[0], repeat[1])).toBe(1);
      expect(Math.min(repeat[0], repeat[1])).toBeLessThanOrEqual(1);
      expect(Math.min(repeat[0], repeat[1])).toBeGreaterThan(0);
    }
  });

  it("trims only a sliver off the real frame photo", () => {
    const { repeat } = coverTransform(PHOTO_ASPECT, FRAME_ASPECT);
    // 사진이 액자보다 세로로 길어 위아래가 잘린다. 얼굴이 날아갈 만큼은 아니어야 한다
    expect(repeat[0]).toBe(1);
    expect(repeat[1]).toBeLessThan(1);
    expect(repeat[1]).toBeGreaterThan(0.9);
  });

  it("falls back to no crop when an aspect is unknown or nonsense", () => {
    // 이미지가 아직 안 왔을 때(0)나 값이 깨졌을 때는 자르지 않는다
    expect(coverTransform(0, FRAME_ASPECT)).toEqual({ repeat: [1, 1], offset: [0, 0] });
    expect(coverTransform(PHOTO_ASPECT, 0)).toEqual({ repeat: [1, 1], offset: [0, 0] });
    expect(coverTransform(Number.NaN, FRAME_ASPECT)).toEqual({ repeat: [1, 1], offset: [0, 0] });
    expect(coverTransform(Number.POSITIVE_INFINITY, FRAME_ASPECT)).toEqual({
      repeat: [1, 1],
      offset: [0, 0],
    });
    expect(coverTransform(-2, FRAME_ASPECT)).toEqual({ repeat: [1, 1], offset: [0, 0] });
  });
});
