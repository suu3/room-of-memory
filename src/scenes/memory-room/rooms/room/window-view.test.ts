import { describe, expect, it } from "vitest";
import { resolveRoomPalette } from "../../world/palette";
import { skyColors } from "./WindowView";

describe("skyColors", () => {
  const palette = resolveRoomPalette();

  it("평범한 저녁은 팔레트 색 그대로다", () => {
    const colors = skyColors(palette, 0);
    expect(colors).toHaveLength(5);
    expect(colors[0]).toBe(palette.abyss);
    expect(colors[1]).toBe(palette.storm);
  });

  it("사태가 번지면 아래 띠만 식고 위 띠는 그대로다", () => {
    const before = skyColors(palette, 0);
    const after = skyColors(palette, 1);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(after[4]).not.toBe(before[4]);
  });

  it("범위 밖 값은 0~1로 눌린다", () => {
    expect(skyColors(palette, 7)).toEqual(skyColors(palette, 1));
    expect(skyColors(palette, Number.NaN)).toEqual(skyColors(palette, 0));
  });
});
