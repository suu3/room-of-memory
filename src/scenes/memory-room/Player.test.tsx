/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { captureMovementKeyDown } from "./player-input";

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
});
