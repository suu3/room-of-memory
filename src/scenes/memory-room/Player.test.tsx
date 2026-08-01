/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { captureMovementKeyDown, resolveMovementInput } from "./player-input";

function createMovementKey(code: string, repeat = false) {
  return new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    code,
    repeat,
  });
}

describe("Player keyboard capture", () => {
  it("captures accepted movement keydowns but not repeated or input-locked keydowns", () => {
    const keys = new Set<string>();
    const accepted = createMovementKey("ArrowUp");

    expect(captureMovementKeyDown(accepted, keys, false)).toBe(true);
    expect(accepted.defaultPrevented).toBe(true);
    expect(keys.has("ArrowUp")).toBe(true);

    keys.clear();
    const repeated = createMovementKey("ArrowUp", true);
    expect(captureMovementKeyDown(repeated, keys, false)).toBe(false);
    expect(repeated.defaultPrevented).toBe(false);
    expect(keys.size).toBe(0);

    const locked = createMovementKey("ArrowUp");
    expect(captureMovementKeyDown(locked, keys, true)).toBe(false);
    expect(locked.defaultPrevented).toBe(false);
    expect(keys.size).toBe(0);
  });

  it("combines keyboard and joystick axes without exceeding unit speed", () => {
    const target = { horizontal: 0, vertical: 0 };

    resolveMovementInput(new Set(), { horizontal: 0.75, vertical: 0 }, target);
    expect(target).toEqual({ horizontal: 0.75, vertical: 0 });

    resolveMovementInput(
      new Set(["ArrowRight", "ArrowUp"]),
      { horizontal: 0.5, vertical: 0 },
      target,
    );
    expect(Math.hypot(target.horizontal, target.vertical)).toBeCloseTo(1);
    expect(target.horizontal).toBeGreaterThan(target.vertical);
  });
});
