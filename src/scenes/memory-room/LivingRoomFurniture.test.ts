import { describe, expect, it } from "vitest";
import { DINING_SET } from "./LivingRoomFurniture";

/**
 * 회전한 등받이 직사각형의 네 꼭짓점 (XZ 평면).
 *
 * 등받이는 로컬 -z(offsetZ)에 있고 의자가 rotationY로 돈다. three.js의 Y 회전은
 * XZ 평면에서 x' = x·cosθ + z·sinθ, z' = -x·sinθ + z·cosθ.
 */
function backrestCorners(chair: (typeof DINING_SET.chairs)[number]) {
  const { halfWidth, halfThickness, offsetZ } = DINING_SET.backrest;
  const cos = Math.cos(chair.rotationY);
  const sin = Math.sin(chair.rotationY);
  const locals: readonly [number, number][] = [
    [-halfWidth, offsetZ - halfThickness],
    [halfWidth, offsetZ - halfThickness],
    [halfWidth, offsetZ + halfThickness],
    [-halfWidth, offsetZ + halfThickness],
  ];
  return locals.map(([x, z]) => [
    chair.position[0] + x * cos + z * sin,
    chair.position[2] + -x * sin + z * cos,
  ]) as [number, number][];
}

/** 분리축 판정 — 두 볼록 사각형이 겹치는가. 축은 양쪽 변의 법선 넷이면 충분하다. */
function convexOverlap(a: readonly [number, number][], b: readonly [number, number][]) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i += 1) {
      const [x1, z1] = poly[i];
      const [x2, z2] = poly[(i + 1) % poly.length];
      const axis: [number, number] = [-(z2 - z1), x2 - x1];
      const project = (points: readonly [number, number][]) => {
        const dots = points.map(([x, z]) => x * axis[0] + z * axis[1]);
        return [Math.min(...dots), Math.max(...dots)] as const;
      };
      const [aMin, aMax] = project(a);
      const [bMin, bMax] = project(b);
      if (aMax < bMin || bMax < aMin) return false; // 분리축 발견 — 안 겹친다
    }
  }
  return true;
}

describe("식탁과 의자", () => {
  const { tableTop } = DINING_SET;
  const tableCorners: readonly [number, number][] = [
    [tableTop.minX, tableTop.minZ],
    [tableTop.maxX, tableTop.minZ],
    [tableTop.maxX, tableTop.maxZ],
    [tableTop.minX, tableTop.maxZ],
  ];

  it("등받이가 상판을 관통하지 않는다", () => {
    /*
     * 등받이(y 0.62~1.12)와 상판 슬래브(y 0.885~0.975)는 높이가 항상 겹친다 —
     * XZ 발자국만 안 겹치면 된다. 눈으로는 식탁 아래 그늘이라 뚫려도 안 보인다.
     */
    for (const chair of DINING_SET.chairs) {
      expect(convexOverlap(backrestCorners(chair), tableCorners)).toBe(false);
    }
  });
});
