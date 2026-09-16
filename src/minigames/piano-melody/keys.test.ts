import { describe, expect, it } from "vitest";
import { KEYBOARD_CENTER_X, PIANO_KEYS } from "./keys";
import { SOLFEGE } from "./melody";

const whites = PIANO_KEYS.filter((key) => !key.black);
const blacks = PIANO_KEYS.filter((key) => key.black);

describe("피아노 건반", () => {
  it("흰 건반 일곱과 검은 건반 다섯", () => {
    expect(whites).toHaveLength(SOLFEGE.length);
    expect(blacks).toHaveLength(5);
  });

  it("흰 건반은 계이름 순서로 왼쪽부터 선다", () => {
    expect(whites.map((key) => key.note)).toEqual([...SOLFEGE]);
    const xs = whites.map((key) => key.position[0]);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it("건반 줄은 몸통 가운데를 기준으로 좌우 대칭이다", () => {
    const xs = whites.map((key) => key.position[0]);
    const middle = (xs[0] + xs[xs.length - 1]) / 2;
    expect(middle).toBeCloseTo(KEYBOARD_CENTER_X, 6);
  });

  it("흰 건반끼리 겹치지 않는다", () => {
    for (let i = 0; i < whites.length - 1; i += 1) {
      const right = whites[i].position[0] + whites[i].size[0] / 2;
      const left = whites[i + 1].position[0] - whites[i + 1].size[0] / 2;
      expect(left).toBeGreaterThan(right);
    }
  });

  it("검은 건반은 흰 건반 사이 경계에 앉고, 미·파와 시·도 사이에는 없다", () => {
    const boundaries = blacks.map((key) => key.position[0]);
    for (const x of boundaries) {
      // 어느 흰 건반 두 장의 경계와 맞는가
      const nearest = whites.findIndex(
        (key, index) =>
          index < whites.length - 1 &&
          Math.abs((key.position[0] + whites[index + 1].position[0]) / 2 - x) < 1e-6,
      );
      expect(nearest).toBeGreaterThanOrEqual(0);
    }
    // 미(2)와 파(3) 사이, 시(6) 오른쪽에는 없다
    const miFa = (whites[2].position[0] + whites[3].position[0]) / 2;
    expect(boundaries.some((x) => Math.abs(x - miFa) < 1e-6)).toBe(false);
    expect(boundaries.every((x) => x < whites[6].position[0])).toBe(true);
  });

  it("검은 건반은 건반 줄 뒤쪽(+z) 끝에 맞춰 선다", () => {
    // 앞면이 로컬 -z라, 흰 건반의 앞부분이 드러나려면 검은 건반이 +z로 물러나야 한다
    const whiteBack = whites[0].position[2] + whites[0].size[2] / 2;
    for (const black of blacks) {
      expect(black.position[2]).toBeGreaterThan(whites[0].position[2]);
      expect(black.position[2] + black.size[2] / 2).toBeCloseTo(whiteBack, 6);
    }
  });

  it("검은 건반은 흰 건반보다 높고 짧다", () => {
    for (const black of blacks) {
      expect(black.position[1]).toBeGreaterThan(whites[0].position[1]);
      expect(black.size[2]).toBeLessThan(whites[0].size[2]);
    }
  });
});
