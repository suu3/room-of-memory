import { describe, expect, it } from "vitest";
import { MAX_PIXEL_BLOCK, pixelBlock, stageScale } from "./pixel-block";

/** 실제 1막 기억 수. 게임기·창문·액자·폰·달력·사인볼·라디오. */
const TOTAL = 7;

describe("pixelBlock", () => {
  it("아무것도 모으지 않았으면 1이다: 처음 본 화면은 그대로여야 한다", () => {
    expect(pixelBlock(0, TOTAL)).toBe(1);
  });

  it("라디오 직전(total - 1)에 가장 굵어진다", () => {
    expect(pixelBlock(TOTAL - 1, TOTAL)).toBe(MAX_PIXEL_BLOCK);
  });

  it("항상 1 이상 MAX_PIXEL_BLOCK 이하의 정수다", () => {
    for (let count = -3; count <= TOTAL + 3; count += 1) {
      const block = pixelBlock(count, TOTAL);
      expect(Number.isInteger(block)).toBe(true);
      expect(block).toBeGreaterThanOrEqual(1);
      expect(block).toBeLessThanOrEqual(MAX_PIXEL_BLOCK);
    }
  });

  it("모을수록 굵어지기만 한다 (단조 증가)", () => {
    let previous = pixelBlock(0, TOTAL);
    for (let count = 1; count <= TOTAL; count += 1) {
      const block = pixelBlock(count, TOTAL);
      expect(block).toBeGreaterThanOrEqual(previous);
      previous = block;
    }
  });

  it("7개 기준의 계단: 첫 기억 하나에 이미 한 단계 굵어진다", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((count) => pixelBlock(count, TOTAL))).toEqual([
      1, 2, 2, 3, 3, 4, 4,
    ]);
  });

  it("분모가 서지 않는 입력(기억 1개 이하·NaN)은 1로 떨어진다", () => {
    expect(pixelBlock(0, 1)).toBe(1);
    expect(pixelBlock(3, 0)).toBe(1);
    expect(pixelBlock(Number.NaN, TOTAL)).toBe(1);
  });
});

describe("stageScale", () => {
  it("블록 크기의 역수다. 블록 1은 배율 1", () => {
    expect(stageScale(1)).toBe(1);
    expect(stageScale(2)).toBe(0.5);
    expect(stageScale(4)).toBe(0.25);
  });

  it("1 미만의 잘못된 블록은 그대로 그린다", () => {
    expect(stageScale(0)).toBe(1);
  });
});
