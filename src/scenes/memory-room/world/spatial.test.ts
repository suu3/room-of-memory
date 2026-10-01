import { describe, expect, it } from "vitest";
import { initialLook } from "../camera/first-person";
import { DOORWAY_ZONE, LIVING_BOUNDS, ROOM_BOUNDS } from "./layout";
import { walkColliders, walkZones } from "./spaces";
import {
  findNearestMemory,
  isWalkable,
  moveCircle,
  moveThroughZones,
  normalizeMovement,
} from "./spatial";

describe("normalizeMovement", () => {
  it("keeps diagonal movement at unit length", () => {
    expect(normalizeMovement({ x: 1, z: 1 })).toEqual({
      x: Math.SQRT1_2,
      z: Math.SQRT1_2,
    });
  });
});

describe("moveCircle", () => {
  const room = { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
  const obstacle = { minX: 0.5, maxX: 1.5, minZ: -0.5, maxZ: 0.5 };

  it("clamps to room bounds and slides on obstacle axes", () => {
    expect(moveCircle({ x: 1.8, z: 0 }, { x: 1, z: 0 }, 0.2, room, [])).toEqual({
      x: 1.8,
      z: 0,
    });
    expect(moveCircle({ x: 0, z: 0 }, { x: 0.8, z: 0.4 }, 0.2, room, [obstacle])).toEqual({
      x: 0,
      z: 0.4,
    });
  });

  it("writes into a reusable output object for allocation-free frame loops", () => {
    const output = { x: 0, z: 0 };

    const result = moveCircle({ x: 0, z: 0 }, { x: -0.6, z: 0.4 }, 0.2, room, [], output);

    expect(result).toBe(output);
    expect(output).toEqual({ x: -0.6, z: 0.4 });
  });
});

describe("moveThroughZones", () => {
  const RADIUS = 0.38;
  const zones = [ROOM_BOUNDS, DOORWAY_ZONE, LIVING_BOUNDS] as const;
  /** 문간 한가운데 (공유벽 x=-6 위, 문 z 범위 안). */
  const doorway = { x: -6, z: 5.35 };

  it("behaves like moveCircle inside a single zone", () => {
    expect(
      moveThroughZones({ x: 0, z: 0 }, { x: 0.4, z: -0.2 }, RADIUS, [ROOM_BOUNDS], []),
    ).toEqual({ x: 0.4, z: -0.2 });
  });

  it("clamps at the shared wall while the door is closed", () => {
    const nearWall = { x: ROOM_BOUNDS.minX + RADIUS + 0.05, z: doorway.z };

    const result = moveThroughZones(nearWall, { x: -0.3, z: 0 }, RADIUS, [ROOM_BOUNDS], []);

    expect(result.x).toBeCloseTo(ROOM_BOUNDS.minX + RADIUS, 5);
  });

  it("walks through the doorway once the living room zones are added", () => {
    // 방 안 문 앞 → 문간을 지나 거실까지, 걸음 크기(0.12)로 밀어본다
    const step = 0.12;
    const position = { x: ROOM_BOUNDS.minX + RADIUS + 0.05, z: doorway.z };
    for (let index = 0; index < 40; index += 1) {
      moveThroughZones(position, { x: -step, z: 0 }, RADIUS, zones, [], position);
    }

    expect(position.x).toBeLessThan(LIVING_BOUNDS.maxX);
  });

  it("keeps the walker inside the doorway strip while crossing", () => {
    const inside = { x: doorway.x, z: doorway.z };

    // 문간 한가운데서 벽 쪽(z 양방향)으로 밀어도 문틀 폭을 벗어나지 않는다
    const up = moveThroughZones(inside, { x: 0, z: 2 }, RADIUS, zones, []);
    const down = moveThroughZones(inside, { x: 0, z: -2 }, RADIUS, zones, []);

    expect(up.z).toBeLessThanOrEqual(DOORWAY_ZONE.maxZ - RADIUS);
    expect(down.z).toBeGreaterThanOrEqual(DOORWAY_ZONE.minZ + RADIUS);
  });

  it("never jumps into a zone the walker is not standing in", () => {
    // 방 왼벽에 붙어 서 있되 문간 z 밖: 왼쪽으로 밀어도 거실로 순간이동하지 않는다
    const againstWall = { x: ROOM_BOUNDS.minX + RADIUS, z: 0 };

    const result = moveThroughZones(againstWall, { x: -1, z: 0 }, RADIUS, zones, []);

    expect(result.x).toBeCloseTo(ROOM_BOUNDS.minX + RADIUS, 5);
  });

  it("still blocks a box the walker is not already inside", () => {
    const box = { minX: 0.5, maxX: 1.5, minZ: -0.5, maxZ: 0.5 };

    const result = moveThroughZones({ x: 0, z: 0 }, { x: 0.3, z: 0 }, RADIUS, [ROOM_BOUNDS], [box]);

    expect(result.x).toBe(0);
  });

  it("lets a walker the open door leaf landed on walk on, but not deeper into it", () => {
    /*
     * 문 옆(판이 젖혀지는 자리)에 서서 방문을 열면 열린 문짝 콜라이더가 몸과 겹친 채
     * 생긴다. 1인칭 문 넘기는 문을 보고 시작하므로 앞으로 걸으면 문 쪽이다.
     * 문을 앞벽과 나란히(90°) 열면서 판이 벽 쪽으로 물러나, 겹치는 자리는 앞벽 가까이다.
     */
    const open = walkColliders(["room-living"]);
    const openZones = walkZones(["room-living"]);
    const start = { x: -4.8, z: 5.66 };
    expect(isWalkable(start.x, start.z, RADIUS, openZones, open)).toBe(false);

    const look = initialLook("doorway", start);
    const forward = { x: -Math.sin(look.yaw), z: -Math.cos(look.yaw) };
    const step = 0.04;
    const position = { ...start };
    for (let index = 0; index < 60; index += 1) {
      moveThroughZones(
        position,
        { x: forward.x * step, z: forward.z * step },
        RADIUS,
        openZones,
        open,
        position,
      );
    }
    expect(position.x).toBeLessThan(ROOM_BOUNDS.minX);

    // 판 쪽(+z)으로는 더 파고들지 못한다
    const deeper = moveThroughZones(start, { x: 0, z: step }, RADIUS, openZones, open);
    expect(deeper.z).toBe(start.z);
  });
});

describe("zone continuity", () => {
  const DIAMETER = 0.76;

  it("overlaps every seam wider than the player, so nobody wedges in a gap", () => {
    /*
     * 문간 영역은 방·거실의 걷기 범위와 지름 이상 겹쳐야 한다. 겹침이 그보다
     * 얇으면 중심이 어느 영역에도 못 들어가는 틈이 생겨 문턱에서 몸이 끼인다.
     */
    expect(DOORWAY_ZONE.maxX - ROOM_BOUNDS.minX).toBeGreaterThan(DIAMETER);
    expect(LIVING_BOUNDS.maxX - DOORWAY_ZONE.minX).toBeGreaterThan(DIAMETER);
    // 문간의 z 폭 자체도 지름보다 넓어야 지나갈 수 있다
    expect(DOORWAY_ZONE.maxZ - DOORWAY_ZONE.minZ).toBeGreaterThan(DIAMETER);
  });
});

describe("findNearestMemory", () => {
  it("ignores locked and out-of-range targets", () => {
    const targets = [
      { id: "console" as const, position: [0, 0, 0] as const, interactionRadius: 1 },
      { id: "ball" as const, position: [0.5, 0, 0] as const, interactionRadius: 1 },
    ];
    expect(findNearestMemory({ x: 0, z: 0 }, targets, (id) => id === "ball")).toBe("ball");
    expect(findNearestMemory({ x: 3, z: 0 }, targets, () => true)).toBeNull();
  });
});
