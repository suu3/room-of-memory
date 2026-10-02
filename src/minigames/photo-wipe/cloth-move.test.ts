import { describe, expect, it } from "vitest";
import { type ClothDirection, type ClothPoint, clothStart, moveCloth } from "./cloth-move";
import { createWipeGrid, wipeCircle, wipedRatio } from "./wipe-grid";

const area = { width: 560, height: 511 };

describe("clothStart", () => {
  it("puts the cloth in the middle of the photo", () => {
    expect(clothStart(area)).toEqual({ x: 280, y: 255.5 });
  });
});

describe("moveCloth", () => {
  it.each([
    ["up", { x: 100, y: 72 }],
    ["down", { x: 100, y: 128 }],
    ["left", { x: 72, y: 100 }],
    ["right", { x: 128, y: 100 }],
  ] as const)("moves one step %s", (direction, expected) => {
    expect(moveCloth({ x: 100, y: 100 }, direction, area, 28)).toEqual(expected);
  });

  it("stops at the edge of the photo", () => {
    expect(moveCloth({ x: 10, y: 10 }, "left", area, 28)).toEqual({ x: 0, y: 10 });
    expect(moveCloth({ x: 10, y: 10 }, "up", area, 28)).toEqual({ x: 10, y: 0 });
    expect(moveCloth({ x: 550, y: 500 }, "right", area, 28)).toEqual({ x: 560, y: 500 });
    expect(moveCloth({ x: 550, y: 500 }, "down", area, 28)).toEqual({ x: 550, y: 511 });
  });

  it("does not change the point it was given", () => {
    const from = { x: 100, y: 100 };
    moveCloth(from, "right", area, 28);
    expect(from).toEqual({ x: 100, y: 100 });
  });

  // 게임이 쓰는 값 그대로 (걸음 28 · 반경 42 · 16px 격자): 방향키만으로 다 닦인다
  it("can wipe the whole photo with arrow keys alone", () => {
    const walk = (cloth: ClothPoint, direction: ClothDirection, times: number) => {
      let at = cloth;
      for (let i = 0; i < times; i++) {
        at = moveCloth(at, direction, area, 28);
        grid = wipeCircle(grid, area, at.x, at.y, 42);
      }
      return at;
    };
    let grid = createWipeGrid(35, 32);
    let cloth = walk(walk(clothStart(area), "left", 20), "up", 20);
    for (let sweep = 0; sweep < 10; sweep++) {
      cloth = walk(cloth, sweep % 2 === 0 ? "right" : "left", 20);
      cloth = walk(cloth, "down", 2);
    }
    expect(wipedRatio(grid)).toBe(1);
  });
});
