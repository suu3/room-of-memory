import { describe, expect, it } from "vitest";
import type { Vec3Tuple } from "../../world/types";
import { DECOR_BY_WALL } from "./RoomDecor";

/**
 * 벽 장식은 전부 벽면에서 시작해 두께만큼 튀어나온 납작한 판이다.
 * 그래서 두 판이 화면상 겹치면서 두께까지 같으면 앞면이 정확히 같은 평면에 놓이고,
 * 깊이값이 같아져 프레임마다 어느 쪽이 앞인지 뒤집히며 깜빡인다(z-fighting).
 *
 * 겹치는 것 자체는 의도된 표현이다. 포스터는 바탕(0.04) → 색면(0.06) → 띠(0.08)로
 * 일부러 겹쳐 쌓는다. 금지해야 하는 건 "겹치는데 두께가 같은" 조합뿐이다.
 */

interface Plaque {
  size: Vec3Tuple;
  position: Vec3Tuple;
}

/** 벽면에 평행한 두 축. 벽이 x축을 보고 서면 두께가 x이므로 남는 축은 z와 y다. */
const PLANE_AXES = {
  back: [0, 1],
  front: [0, 1],
  left: [2, 1],
  right: [2, 1],
} as const;

/** 벽면에 수직인 축 = 두께가 실린 축. */
const DEPTH_AXIS = { back: 2, front: 2, left: 0, right: 0 } as const;

function overlapsOnAxis(a: Plaque, b: Plaque, axis: number): boolean {
  const aMin = a.position[axis] - a.size[axis] / 2;
  const aMax = a.position[axis] + a.size[axis] / 2;
  const bMin = b.position[axis] - b.size[axis] / 2;
  const bMax = b.position[axis] + b.size[axis] / 2;
  // 딱 맞닿는 건 겹침이 아니다. 면적이 있어야 깜빡인다
  return Math.min(aMax, bMax) - Math.max(aMin, bMin) > 1e-6;
}

describe("wall decor", () => {
  it("never stacks two plaques of the same thickness on the same spot", () => {
    for (const [wall, parts] of Object.entries(DECOR_BY_WALL)) {
      const [planeA, planeB] = PLANE_AXES[wall as keyof typeof PLANE_AXES];
      const depthAxis = DEPTH_AXIS[wall as keyof typeof DEPTH_AXIS];

      for (let i = 0; i < parts.length; i += 1) {
        for (let j = i + 1; j < parts.length; j += 1) {
          const a = parts[i];
          const b = parts[j];
          if (!overlapsOnAxis(a, b, planeA) || !overlapsOnAxis(a, b, planeB)) continue;

          const depthA = a.size[depthAxis];
          const depthB = b.size[depthAxis];
          expect(
            Math.abs(depthA - depthB),
            `${wall} 벽에서 겹치는 두 판의 두께가 같다 (${depthA}): 앞면이 같은 평면에 놓여 깜빡인다`,
          ).toBeGreaterThan(1e-6);
        }
      }
    }
  });

  it("keeps every plaque flush against its wall", () => {
    // 판이 벽에서 떠 있으면 그림자와 어긋나고, 벽을 뚫으면 반대편에서 보인다
    for (const parts of Object.values(DECOR_BY_WALL)) {
      for (const part of parts) {
        const depths = part.size.filter((value) => value <= 0.12);
        expect(depths.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
