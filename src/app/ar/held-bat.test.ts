import { Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { batDirection, placeHeldBat } from "./held-bat";

describe("held AR bat", () => {
  it("points forward at zero angles and to the character's left at +90°", () => {
    const out = new Vector3();
    expect(
      batDirection(0, 0, out)
        .toArray()
        .map((v) => +v.toFixed(6)),
    ).toEqual([0, 0, 1]);
    expect(batDirection(Math.PI / 2, 0, out).x).toBeCloseTo(1);
    expect(batDirection(0, Math.PI / 2, out).y).toBeCloseTo(1);
  });

  it("slides the bat so its grip sits between the hands and its barrel follows the direction", () => {
    const hands = new Vector3(0.1, 0.8, 0.2);
    const direction = batDirection(0.4, 0.3, new Vector3());
    const position = new Vector3();
    const rotation = new Quaternion();

    placeHeldBat(hands, direction, position, rotation);

    const batAxis = new Vector3(0, 1, 0).applyQuaternion(rotation);
    expect(batAxis.dot(direction)).toBeCloseTo(1);
    const grip = new Vector3(0, 0.12, 0).applyQuaternion(rotation).add(position);
    expect(grip.distanceTo(hands)).toBeCloseTo(0);
  });
});
