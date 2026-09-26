import { describe, expect, it } from "vitest";
import { ampouleObject } from "./inspect-objects";

describe("ampoule inspect object", () => {
  it("uses the shared vial GLB instead of a primitive cylinder", () => {
    expect(ampouleObject()).toEqual({
      shape: "model",
      model: "ampoule",
      size: [0.28, 0.78, 0.28],
      foundYaw: Math.PI * 0.525,
      tilt: 0.1,
    });
  });
});
