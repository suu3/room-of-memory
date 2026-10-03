import { Bone, Group, type Matrix4, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { findSleeveRoots, releaseSleeveRoots, settleSleeveRoots } from "./sleeve-root";

function arm() {
  const root = new Group();
  const shoulder = new Bone();
  shoulder.name = "shoulderL";
  shoulder.position.set(0.03, 0.8, 0);
  shoulder.quaternion.setFromAxisAngle(new Vector3(0, 0, 1), 0.4);
  const upper = new Bone();
  upper.name = "upper_armL";
  upper.position.set(0, 0.08, 0);
  upper.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), 0.3);
  const fore = new Bone();
  fore.position.set(0, 0.2, 0);
  root.add(shoulder);
  shoulder.add(upper);
  upper.add(fore);
  return { root, shoulder, upper, fore };
}

function worldOf(root: Group, bone: Bone): Matrix4 {
  root.updateMatrixWorld(true);
  return bone.matrixWorld.clone();
}

function expectSameMatrix(actual: Matrix4, expected: Matrix4) {
  for (let index = 0; index < 16; index += 1) {
    expect(actual.elements[index]).toBeCloseTo(expected.elements[index], 6);
  }
}

describe("sleeve roots", () => {
  it("leaves the rest pose untouched", () => {
    const { root, shoulder } = arm();
    const before = worldOf(root, shoulder);
    settleSleeveRoots(findSleeveRoots(root));
    expectSameMatrix(worldOf(root, shoulder), before);
  });

  it("turns the shoulder half as far as the arm without moving the arm", () => {
    const { root, shoulder, upper, fore } = arm();
    const roots = findSleeveRoots(root);
    const restShoulder = shoulder.quaternion.clone();
    upper.quaternion.premultiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 1.2));
    const armBefore = worldOf(root, upper);
    const foreBefore = worldOf(root, fore);

    settleSleeveRoots(roots);

    expectSameMatrix(worldOf(root, upper), armBefore);
    expectSameMatrix(worldOf(root, fore), foreBefore);
    expect(shoulder.quaternion.angleTo(restShoulder)).toBeCloseTo(0.6, 6);
  });

  it("releases back to what the animation left, and settling twice does not stack", () => {
    const { root, shoulder, upper } = arm();
    const roots = findSleeveRoots(root);
    upper.quaternion.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -1));
    const position = shoulder.position.clone();
    const quaternion = shoulder.quaternion.clone();
    const upperQuaternion = upper.quaternion.clone();

    settleSleeveRoots(roots);
    const settled = shoulder.quaternion.clone();
    settleSleeveRoots(roots);
    expect(shoulder.quaternion.angleTo(settled)).toBeCloseTo(0, 6);

    releaseSleeveRoots(roots);
    expect(shoulder.position.distanceTo(position)).toBeCloseTo(0, 6);
    expect(shoulder.quaternion.angleTo(quaternion)).toBeCloseTo(0, 6);
    expect(upper.quaternion.angleTo(upperQuaternion)).toBeCloseTo(0, 6);
  });

  it("finds nothing on a rig without shoulder bones", () => {
    expect(findSleeveRoots(new Group())).toEqual([]);
  });
});
