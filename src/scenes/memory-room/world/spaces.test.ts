import { describe, expect, it } from "vitest";
import {
  ALL_COLLIDERS,
  DOORWAY_IDS,
  DOORWAYS,
  followLimits,
  reachableSpaces,
  SPACE_IDS,
  SPACES,
  type SpaceDef,
  spaceAt,
  spaceCenter,
  walkColliders,
  walkZones,
} from "./spaces";
import { isWalkable } from "./spatial";

const PLAYER_RADIUS = 0.38;
const DIAMETER = PLAYER_RADIUS * 2;

describe("공간 표", () => {
  it("거실의 확장부가 냉장고 쪽 오픈 키친을 품는다", () => {
    expect(SPACES.living.shell.minZ).toBeLessThan(-4);
    expect(
      SPACES.living.colliders.some(
        (box) => box.minZ === SPACES.living.shell.minZ && box.maxX > -14.5 && box.minX < -10,
      ),
    ).toBe(true);
    // 조리대 앞은 부엌을 따라 걸을 수 있어야 한다.
    expect(isWalkable(-12.25, -6, PLAYER_RADIUS, [SPACES.living.bounds], ALL_COLLIDERS)).toBe(true);
  });

  it("껍데기끼리 겹치지 않는다. 겹치면 한 자리가 두 공간이 된다", () => {
    for (const a of SPACE_IDS) {
      for (const b of SPACE_IDS) {
        if (a >= b) continue;
        const p = SPACES[a].shell;
        const q = SPACES[b].shell;
        const overlapX = Math.min(p.maxX, q.maxX) - Math.max(p.minX, q.minX);
        const overlapZ = Math.min(p.maxZ, q.maxZ) - Math.max(p.minZ, q.minZ);
        // 변만 맞닿을 수 있다 (0). 면적이 생기면 안 된다
        expect(Math.min(overlapX, overlapZ), `${a}~${b}`).toBeLessThanOrEqual(0);
      }
    }
  });

  it("몸을 떨어뜨리는 자리는 제 공간 안이고, 거기 설 수 있다", () => {
    for (const id of SPACE_IDS) {
      const { landing } = SPACES[id];
      // 그 자리에 섰을 때 판정이 제 공간으로 떨어져야 이동한 티가 난다
      expect(spaceAt(landing.x, landing.z, id), id).toBe(id);
      // 가구에 끼거나 벽을 밟고 서면 그 뒤로 한 발짝도 못 움직인다
      expect(
        isWalkable(landing.x, landing.z, PLAYER_RADIUS, [SPACES[id].bounds], ALL_COLLIDERS),
        id,
      ).toBe(true);
    }
  });

  it("가구 발자국은 제 공간의 껍데기 안에 있다", () => {
    // 홈(nooks)이 있는 공간은 껍데기와 홈을 감싼 상자 안이다
    for (const id of SPACE_IDS) {
      const space: SpaceDef = SPACES[id];
      const shells = [space.shell, ...(space.nooks ?? []).map((nook) => nook.shell)];
      const envelope = {
        minX: Math.min(...shells.map((shell) => shell.minX)),
        maxX: Math.max(...shells.map((shell) => shell.maxX)),
        minZ: Math.min(...shells.map((shell) => shell.minZ)),
        maxZ: Math.max(...shells.map((shell) => shell.maxZ)),
      };
      for (const box of space.colliders) {
        expect(box.minX, id).toBeGreaterThanOrEqual(envelope.minX);
        expect(box.maxX, id).toBeLessThanOrEqual(envelope.maxX);
        expect(box.minZ, id).toBeGreaterThanOrEqual(envelope.minZ);
        expect(box.maxZ, id).toBeLessThanOrEqual(envelope.maxZ);
      }
    }
  });

  it("현관 홈은 거실이고, 홈 안쪽까지 걸어 들어간다", () => {
    const nook = SPACES.living.nooks[0];
    const inside = { x: (nook.shell.minX + nook.shell.maxX) / 2, z: nook.shell.minZ + 1 };
    expect(spaceAt(inside.x, inside.z, "room")).toBe("living");
    expect(walkZones(["room-living"])).toContain(nook.bounds);
    expect(isWalkable(-7.9, -8.4, PLAYER_RADIUS, walkZones(["room-living"]), ALL_COLLIDERS)).toBe(
      true,
    );
  });

  it("spaceAt은 껍데기로 공간을 정하고, 벽 두께 안에서는 지금 공간을 지킨다", () => {
    expect(spaceAt(0, 2, "room")).toBe("room");
    expect(spaceAt(-10, 2, "room")).toBe("living");
    expect(spaceAt(-12, 8, "living")).toBe("bathroom");
    expect(spaceAt(-19.5, 3, "living")).toBe("parents");
    // 어느 껍데기에도 안 드는 점(집 밖)은 지금 공간 그대로
    expect(spaceAt(100, 100, "bathroom")).toBe("bathroom");
  });
});

describe("문간", () => {
  it("문간마다 양쪽 걷기 범위와 지름 이상 겹치고, 통로 폭도 지름보다 넓다", () => {
    for (const id of DOORWAY_IDS) {
      const { between, zone } = DOORWAYS[id];
      for (const side of between) {
        const bounds = SPACES[side].bounds;
        const overlapX = Math.min(bounds.maxX, zone.maxX) - Math.max(bounds.minX, zone.minX);
        const overlapZ = Math.min(bounds.maxZ, zone.maxZ) - Math.max(bounds.minZ, zone.minZ);
        // 잇는 축으로는 지름 이상, 가로지르는 축으로는 통로 폭 전체가 겹친다
        expect(Math.max(overlapX, overlapZ), `${id}/${side}`).toBeGreaterThan(DIAMETER);
        expect(Math.min(overlapX, overlapZ), `${id}/${side}`).toBeGreaterThan(DIAMETER);
      }
      expect(Math.min(zone.maxX - zone.minX, zone.maxZ - zone.minZ), id).toBeGreaterThan(DIAMETER);
    }
  });

  it("문간 앞뒤에 가구가 없다. 나오자마자 끼면 안 된다", () => {
    for (const id of DOORWAY_IDS) {
      const { zone } = DOORWAYS[id];
      for (const box of ALL_COLLIDERS) {
        const overlapsX = box.maxX > zone.minX && box.minX < zone.maxX;
        const overlapsZ = box.maxZ > zone.minZ && box.minZ < zone.maxZ;
        expect(overlapsX && overlapsZ, `${id} vs ${JSON.stringify(box)}`).toBe(false);
      }
    }
  });

  it("문이 열리면 문간 한가운데를 지나 저쪽 공간까지 설 수 있다", () => {
    const open = [...DOORWAY_IDS];
    const zones = walkZones(open);
    const colliders = walkColliders(open);
    for (const id of DOORWAY_IDS) {
      const { zone, between } = DOORWAYS[id];
      const cx = (zone.minX + zone.maxX) / 2;
      const cz = (zone.minZ + zone.maxZ) / 2;
      expect(isWalkable(cx, cz, PLAYER_RADIUS, zones, colliders), id).toBe(true);
      for (const side of between) {
        const { x, z } = spaceCenter(side);
        // 공간 가운데가 가구면 그 옆이라도: 가운데에서 가장 가까운 설 수 있는 칸을 찾는다
        let stands = false;
        for (let dx = -2; dx <= 2 && !stands; dx += 0.5) {
          for (let dz = -2; dz <= 2 && !stands; dz += 0.5) {
            stands = isWalkable(x + dx, z + dz, PLAYER_RADIUS, zones, colliders);
          }
        }
        expect(stands, `${id}/${side}`).toBe(true);
      }
    }
  });
});

describe("열린 문간에서 나오는 것들", () => {
  it("닿을 수 있는 공간은 방에서 열린 문을 따라간다", () => {
    expect(reachableSpaces([])).toEqual(["room"]);
    // 거실 너머 문만 열려 있고 방문이 닫혀 있으면 거실도 화장실도 못 간다
    expect(reachableSpaces(["living-bathroom"])).toEqual(["room"]);
    expect(reachableSpaces(["room-living"])).toEqual(["room", "living"]);
    expect(reachableSpaces(["room-living", "living-parents"])).toEqual([
      "room",
      "living",
      "parents",
    ]);
  });

  it("걷기 영역은 닿을 수 있는 공간과 열린 문간뿐이다", () => {
    expect(walkZones([])).toEqual([SPACES.room.bounds]);
    expect(walkZones(["room-living"])).toEqual([
      SPACES.room.bounds,
      SPACES.living.bounds,
      ...SPACES.living.nooks.map((nook) => nook.bounds),
      DOORWAYS["room-living"].zone,
    ]);
  });

  it("열린 방문의 문짝은 막고, 다른 문의 문짝은 막지 않는다", () => {
    expect(walkColliders([])).toEqual(ALL_COLLIDERS);
    expect(walkColliders(["room-living"]).length).toBe(
      ALL_COLLIDERS.length + DOORWAYS["room-living"].openLeafColliders.length,
    );
    expect(walkColliders(["room-living", "living-bathroom"]).length).toBe(
      walkColliders(["room-living"]).length,
    );
  });

  it("카메라 한계는 닿을 수 있는 공간들의 합집합을 안쪽으로 물린 상자다", () => {
    const inset = 1.6;
    const closed = followLimits([], inset);
    expect(closed.minX).toBeCloseTo(SPACES.room.bounds.minX + inset);
    const open = followLimits(["room-living"], inset);
    expect(open.minX).toBeCloseTo(SPACES.living.bounds.minX + inset);
    expect(open.maxX).toBeCloseTo(SPACES.room.bounds.maxX - inset);
    const deep = followLimits(["room-living", "living-parents"], inset);
    expect(deep.minX).toBeCloseTo(SPACES.parents.bounds.minX + inset);
  });
});
