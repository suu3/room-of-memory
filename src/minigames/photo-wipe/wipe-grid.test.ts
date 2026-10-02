import { describe, expect, it } from "vitest";
import { createWipeGrid, wipeCircle, wipedRatio } from "./wipe-grid";

const area = { width: 400, height: 400 };

describe("wipeCircle", () => {
  it("reports the wiped ratio of the grid", () => {
    // 한 셀(100x100)의 중심만 덮는 작은 반경 → 16칸 중 1칸
    const once = wipeCircle(createWipeGrid(4, 4), area, 50, 50, 10);
    expect(wipedRatio(once)).toBeCloseTo(1 / 16);
    expect(wipedRatio(wipeCircle(once, area, 150, 50, 10))).toBeCloseTo(2 / 16);
  });

  it("does not double count the same cell", () => {
    const once = wipeCircle(createWipeGrid(4, 4), area, 50, 50, 10);
    expect(wipedRatio(wipeCircle(once, area, 50, 50, 10))).toBeCloseTo(1 / 16);
  });

  it("reaches 1 when the whole area is covered", () => {
    expect(wipedRatio(wipeCircle(createWipeGrid(4, 4), area, 200, 200, 400))).toBe(1);
  });

  it("counts cells by their center, so a corner touch leaves the grid untouched", () => {
    expect(wipedRatio(wipeCircle(createWipeGrid(4, 4), area, 0, 0, 40))).toBe(0);
  });

  it("leaves the grid it was given untouched", () => {
    const grid = createWipeGrid(4, 4);
    const wiped = wipeCircle(grid, area, 50, 50, 10);
    expect(wipedRatio(grid)).toBe(0);
    expect(wiped).not.toBe(grid);
  });

  it("hands back the same grid when nothing new was wiped", () => {
    const once = wipeCircle(createWipeGrid(4, 4), area, 50, 50, 10);
    expect(wipeCircle(once, area, 50, 50, 10)).toBe(once);
  });
});

describe("wipedRatio", () => {
  it("is 0 for a fresh grid", () => {
    expect(wipedRatio(createWipeGrid(4, 4))).toBe(0);
  });
});
