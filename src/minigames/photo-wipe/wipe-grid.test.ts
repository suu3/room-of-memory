import { describe, expect, it } from "vitest";
import { createWipeGrid, wipeCircle } from "./wipe-grid";

const area = { width: 400, height: 400 };

describe("wipeCircle", () => {
  it("reports the wiped ratio of the grid", () => {
    const grid = createWipeGrid(4, 4);
    // 한 셀(100x100)의 중심만 덮는 작은 반경 → 16칸 중 1칸
    expect(wipeCircle(grid, area, 50, 50, 10)).toBeCloseTo(1 / 16);
    expect(wipeCircle(grid, area, 150, 50, 10)).toBeCloseTo(2 / 16);
  });

  it("does not double count the same cell", () => {
    const grid = createWipeGrid(4, 4);
    wipeCircle(grid, area, 50, 50, 10);
    expect(wipeCircle(grid, area, 50, 50, 10)).toBeCloseTo(1 / 16);
  });

  it("reaches 1 when the whole area is covered", () => {
    const grid = createWipeGrid(4, 4);
    expect(wipeCircle(grid, area, 200, 200, 400)).toBe(1);
  });

  it("counts cells by their center, so a corner touch leaves the grid untouched", () => {
    const grid = createWipeGrid(4, 4);
    expect(wipeCircle(grid, area, 0, 0, 40)).toBe(0);
  });
});
