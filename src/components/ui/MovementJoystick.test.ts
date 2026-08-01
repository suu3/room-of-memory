import { describe, expect, it } from "vitest";
import { joystickVectorFromOffset } from "./movement-joystick";

describe("joystickVectorFromOffset", () => {
  it("maps a right drag to rightward movement and an upward drag to forward movement", () => {
    expect(joystickVectorFromOffset(40, 0, 40)).toEqual({ horizontal: 1, vertical: -0 });
    expect(joystickVectorFromOffset(0, -40, 40)).toEqual({ horizontal: 0, vertical: 1 });
  });

  it("clamps diagonal drags and ignores the center dead zone", () => {
    const diagonal = joystickVectorFromOffset(80, -80, 40);
    expect(Math.hypot(diagonal.horizontal, diagonal.vertical)).toBeCloseTo(1);
    expect(joystickVectorFromOffset(2, 2, 40)).toEqual({ horizontal: 0, vertical: 0 });
  });
});
