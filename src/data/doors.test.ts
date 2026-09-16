import { describe, expect, it } from "vitest";
import { DOORWAY_IDS } from "@/scenes/memory-room/spaces";
import { DOOR_RULES } from "./doors";
import { ITEM_IDS, ITEM_SPACE } from "./items";

describe("문 규칙과 물건", () => {
  it("규칙은 실제 문간을 가리키고, 방문은 규칙 밖이다", () => {
    for (const id of Object.keys(DOOR_RULES)) {
      expect(DOORWAY_IDS).toContain(id);
      expect(id).not.toBe("room-living");
    }
    // 거실 너머의 문은 전부 규칙이 있어야 한다. 없으면 영영 안 열린다
    for (const id of DOORWAY_IDS) {
      if (id !== "room-living") expect(DOOR_RULES).toHaveProperty(id);
    }
  });

  it("문이 요구하는 물건은 있는 물건이고, 그 물건은 그 문 너머가 아닌 곳에 있다", () => {
    for (const [doorway, rule] of Object.entries(DOOR_RULES)) {
      if (!("item" in rule) || rule.item === undefined) continue;
      expect(ITEM_IDS).toContain(rule.item);
      // 열쇠가 잠긴 방 안에 있으면 못 연다
      const beyond = doorway.split("-")[1];
      expect(ITEM_SPACE[rule.item]).not.toBe(beyond);
    }
  });

  it("물건 id는 kebab-case다. i18n 키와 3D 오브젝트 이름에 그대로 들어간다", () => {
    for (const id of ITEM_IDS) expect(id).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
  });
});
