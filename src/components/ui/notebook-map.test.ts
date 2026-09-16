import { describe, expect, it } from "vitest";
import { CLUE_IDS, CLUE_SPACE } from "@/data/room-clues";
import { DOORWAY_IDS, DOORWAYS, SPACE_IDS } from "@/scenes/memory-room/spaces";
import { floorPlan, type PlanRect } from "./notebook-map";

/** 두 사각형이 면으로 겹치는가 (변만 맞닿는 건 안 겹친 것). */
function overlaps(a: PlanRect, b: PlanRect): boolean {
  const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return x > 0 && y > 0;
}

function viewBoxOf(plan: ReturnType<typeof floorPlan>): PlanRect {
  const [x, y, width, height] = plan.viewBox.split(" ").map(Number);
  return { x, y, width, height };
}

describe("수첩 평면도", () => {
  it("문이 하나도 안 열렸으면 내 방 한 칸뿐이다", () => {
    const plan = floorPlan([]);
    expect(plan.rooms.map((room) => room.id)).toEqual(["room"]);
    expect(plan.doors).toHaveLength(0);
  });

  it("방문만 열면 거실까지 두 칸이 그려진다. 그 너머는 아직 없다", () => {
    const plan = floorPlan(["room-living"]);
    expect(plan.rooms.map((room) => room.id).sort()).toEqual(["living", "room"]);
    expect(plan.doors.map((door) => door.id)).toEqual(["room-living"]);
  });

  it("문을 다 열면 네 칸과 문간 셋이 다 선다", () => {
    const plan = floorPlan(DOORWAY_IDS);
    expect(plan.rooms).toHaveLength(SPACE_IDS.length);
    expect(plan.doors).toHaveLength(DOORWAY_IDS.length);
  });

  it("닿을 수 없는 문간은 그리지 않는다. 다리만 떠 있으면 안 된다", () => {
    // 방문이 닫힌 채 거실~화장실만 열린 저장본: 거실에 닿을 길이 없다
    const plan = floorPlan(["living-bathroom"]);
    expect(plan.rooms.map((room) => room.id)).toEqual(["room"]);
    expect(plan.doors).toHaveLength(0);
  });

  it("칸끼리 겹치지 않는다", () => {
    const plan = floorPlan(DOORWAY_IDS);
    for (const a of plan.rooms) {
      for (const b of plan.rooms) {
        if (a.id >= b.id) continue;
        expect(overlaps(a, b), `${a.id}~${b.id}`).toBe(false);
      }
    }
  });

  it("문구멍은 잇는 두 칸을 다 물어야 양쪽 벽선이 지워진다", () => {
    const plan = floorPlan(DOORWAY_IDS);
    for (const door of plan.doors) {
      for (const id of DOORWAYS[door.id].between) {
        const room = plan.rooms.find((candidate) => candidate.id === id);
        expect(room, door.id).toBeDefined();
        expect(room && overlaps(door, room), `${door.id}~${id}`).toBe(true);
      }
    }
  });

  it("이름표 자리는 제 칸 안에 있다", () => {
    const plan = floorPlan(DOORWAY_IDS);
    for (const room of plan.rooms) {
      expect(room.center.x, room.id).toBeGreaterThan(room.x);
      expect(room.center.x, room.id).toBeLessThan(room.x + room.width);
      expect(room.center.y, room.id).toBeGreaterThan(room.y);
      expect(room.center.y, room.id).toBeLessThan(room.y + room.height);
    }
  });

  it("viewBox는 그려진 칸을 다 담는다", () => {
    for (const open of [[], ["room-living"], DOORWAY_IDS] as const) {
      const plan = floorPlan(open);
      const box = viewBoxOf(plan);
      for (const room of plan.rooms) {
        expect(room.x, room.id).toBeGreaterThanOrEqual(box.x);
        expect(room.y, room.id).toBeGreaterThanOrEqual(box.y);
        expect(room.x + room.width, room.id).toBeLessThanOrEqual(box.x + box.width);
        expect(room.y + room.height, room.id).toBeLessThanOrEqual(box.y + box.height);
      }
    }
  });
});

describe("단서가 놓인 공간", () => {
  it("적어 둔 공간은 전부 실재한다", () => {
    for (const id of CLUE_IDS) {
      const space = CLUE_SPACE[id];
      if (space === undefined) continue;
      expect(SPACE_IDS, id).toContain(space);
    }
  });

  it("거울은 단서가 아니라 빠져 있다", () => {
    expect(CLUE_SPACE.mirror).toBeUndefined();
  });

  it("거울 말고는 다 어느 공간인지 적혀 있다", () => {
    for (const id of CLUE_IDS) {
      if (id === "mirror") continue;
      expect(CLUE_SPACE[id], id).toBeDefined();
    }
  });
});
