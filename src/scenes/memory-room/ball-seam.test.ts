import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { ballSeamPoints, SEAM_PLANE, SEAM_SURFACE_RADIUS } from "./ball-seam";

/**
 * ch1-baseball.glb 구 표면에 파여 있는 홈에서 뽑은 길목들 (단위 벡터로 정규화).
 * 홈 정점 64개 가운데 네 반원이 만나는 자리와 각 반원의 한가운데다.
 */
const GROOVE_WAYPOINTS = [
  [0, -1, 1],
  [1, 0, 1],
  [0, 1, 1],
  [-1, 1, 0],
  [0, 1, -1],
  [1, 0, -1],
  [0, -1, -1],
  [-1, -1, 0],
].map(([x, y, z]) => new Vector3(x, y, z).normalize());

describe("baseball seam", () => {
  const points = ballSeamPoints();

  it("stays on the ball surface all the way round", () => {
    for (const point of points) {
      expect(point.length()).toBeCloseTo(SEAM_SURFACE_RADIUS, 9);
    }
  });

  it("passes through the groove carved into the model", () => {
    /*
     * 이게 이 파일의 존재 이유다. 예전 곡선(테니스공 솔기의 매개변수식)은 회전을
     * 최적화해도 홈에서 평균 0.059, 최대 0.168만큼 벗어났다 — 빨간 띠가 파인 자리를
     * 비껴 갔다. 길목까지의 거리는 표본 간격(π/32 × 반지름 ≈ 0.07)의 절반 안이어야
     * 한다: 그보다 멀면 곡선이 홈을 지나지 않는 것이다.
     */
    for (const waypoint of GROOVE_WAYPOINTS) {
      const target = waypoint.clone().multiplyScalar(SEAM_SURFACE_RADIUS);
      const nearest = Math.min(...points.map((point) => point.distanceTo(target)));
      expect(nearest).toBeLessThan(0.035);
    }
  });

  it("is built from four half circles, not a smooth figure eight", () => {
    /*
     * 네 반원은 각각 z = ±s 또는 y = ±s 평면 위에 있다. 그래서 곡선 위의 모든 점은
     * y나 z 가운데 적어도 하나가 ±s로 고정돼 있고, 조각이 만나는 네 자리에서만 둘
     * 다 고정된다 — 매끄러운 매개변수 곡선에는 없는 성질이라, 곡선을 다시 갈아
     * 끼우면 여기서 걸린다.
     */
    const pinnedCounts = points.map(
      (point) =>
        [point.y, point.z].filter((value) => Math.abs(Math.abs(value) - SEAM_PLANE) < 1e-9).length,
    );
    expect(Math.min(...pinnedCounts)).toBe(1);
    expect(pinnedCounts.filter((count) => count === 2)).toHaveLength(4);
  });

  it("closes into one loop with no kink where the arcs meet", () => {
    const steps = points.map((point, index) =>
      point.distanceTo(points[(index + 1) % points.length]),
    );
    // 표본이 고르면 이음매에서도 간격이 튀지 않는다 — 튄다면 조각이 어긋나 붙은 것이다.
    expect(Math.max(...steps) - Math.min(...steps)).toBeLessThan(1e-9);

    const turns = points.map((point, index) => {
      const previous = points[(index - 1 + points.length) % points.length];
      const next = points[(index + 1) % points.length];
      const incoming = point.clone().sub(previous).normalize();
      const outgoing = next.clone().sub(point).normalize();
      return incoming.angleTo(outgoing);
    });
    // 이음매에서 접선이 이어지므로 꺾이는 각도 역시 다른 곳과 다르지 않다.
    expect(Math.max(...turns)).toBeLessThan(Math.min(...turns) * 1.5);
  });
});
