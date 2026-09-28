import { describe, expect, it } from "vitest";
import { funnelIntoDoorway } from "./doorway-funnel";
import { DOORWAYS, walkColliders, walkZones } from "./spaces";
import { moveThroughZones, type Vec2 } from "./spatial";

const PLAYER_RADIUS = 0.38;
const OPEN = ["room-living", "living-bathroom", "living-parents"] as const;
const zones = walkZones([...OPEN]);
const colliders = walkColliders([...OPEN]);
const doorways = OPEN.map((id) => DOORWAYS[id].zone);

/** 한 방향으로 계속 민다 (조이스틱을 한쪽으로 꺾은 채). 한 걸음 0.1. */
function push(start: Vec2, direction: Vec2, frames = 250): Vec2 {
  const length = Math.hypot(direction.x, direction.z);
  let position = { ...start };
  for (let frame = 0; frame < frames; frame += 1) {
    const step = funnelIntoDoorway(
      position,
      { x: (direction.x / length) * 0.1, z: (direction.z / length) * 0.1 },
      doorways,
      { x: 0, z: 0 },
    );
    const next = moveThroughZones(position, step, PLAYER_RADIUS, zones, colliders);
    position = { x: next.x, z: next.z };
  }
  return position;
}

describe("funnelIntoDoorway", () => {
  it("거실에서 방문 쪽으로 밀면 문간 높이가 조금 어긋나도 방에 들어간다", () => {
    for (const z of [4.4, 4.8, 5.0, 5.2, 5.4, 5.6]) {
      expect(push({ x: -8, z }, { x: 1, z: 0 }).x, `z=${z}`).toBeGreaterThan(-4.5);
    }
  });

  it("비스듬히 밀고 들어가도 문짝과 문틀 사이에 끼지 않는다", () => {
    for (const across of [0.3, 0.6]) {
      expect(push({ x: -9, z: 3.5 }, { x: 1, z: across }).x, `${across}`).toBeGreaterThan(-4.5);
    }
  });

  it("방에서 거실로도 나간다", () => {
    for (const z of [4.4, 5.0, 5.6]) {
      expect(push({ x: -3, z }, { x: -1, z: 0 }).x, `z=${z}`).toBeLessThan(-7);
    }
  });

  it("화장실·안방 문도 가운데를 비껴 밀어도 들어간다", () => {
    const bath = DOORWAYS["living-bathroom"].zone;
    const parents = DOORWAYS["living-parents"].zone;
    for (const offset of [-0.6, -0.3, 0.3, 0.6]) {
      const inBath = push(
        { x: (bath.minX + bath.maxX) / 2 + offset, z: bath.minZ - 1.2 },
        { x: 0, z: 1 },
      );
      expect(inBath.z, `bath ${offset}`).toBeGreaterThan(bath.maxZ);
      const inParents = push(
        { x: parents.maxX + 1.2, z: (parents.minZ + parents.maxZ) / 2 + offset },
        { x: -1, z: 0 },
      );
      expect(inParents.x, `parents ${offset}`).toBeLessThan(parents.minX);
    }
  });

  it("문간과 상관없는 걸음은 건드리지 않는다", () => {
    const out = { x: 0, z: 0 };
    // 거실 한가운데
    expect(funnelIntoDoorway({ x: -11, z: 0 }, { x: 0.1, z: 0.02 }, doorways, out)).toEqual({
      x: 0.1,
      z: 0.02,
    });
    // 방문 앞이지만 벽을 따라 걷는다 (통과 축 입력이 없다)
    expect(funnelIntoDoorway({ x: -7, z: 4.5 }, { x: 0, z: 0.1 }, doorways, out)).toEqual({
      x: 0,
      z: 0.1,
    });
    // 방문 앞에서 문을 등지고 걸어 나간다
    expect(funnelIntoDoorway({ x: -8, z: 4.6 }, { x: -0.1, z: 0 }, doorways, out)).toEqual({
      x: -0.1,
      z: 0,
    });
  });
});
