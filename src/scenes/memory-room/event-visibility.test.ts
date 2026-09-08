import { Group, type Intersection, Mesh } from "three";
import { describe, expect, it } from "vitest";
import { isVisibleInTree, visibleHitsOnly } from "./event-visibility";

function hitOf(object: Mesh): Intersection {
  return { distance: 1, point: object.position, object };
}

describe("event-visibility", () => {
  it("treats an object as hidden when any ancestor is hidden", () => {
    const room = new Group();
    const ball = new Mesh();
    room.add(ball);
    expect(isVisibleInTree(ball)).toBe(true);
    room.visible = false;
    expect(isVisibleInTree(ball)).toBe(false);
  });

  it("drops hits on the hidden space and keeps the visible one", () => {
    const room = new Group();
    const living = new Group();
    const ball = new Mesh();
    const sofa = new Mesh();
    room.add(ball);
    living.add(sofa);
    room.visible = false;
    const hits = visibleHitsOnly([hitOf(ball), hitOf(sofa)]);
    expect(hits.map((hit) => hit.object)).toEqual([sofa]);
  });
});
