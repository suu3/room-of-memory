import { describe, expect, it } from "vitest";
import { ROOM_DOOR_POSITION, ROOM_SHELL_BOUNDS } from "./layout";
import { DOOR_OPENING_Z, LEFT_SKIRTING } from "./RoomShell";

const [, , SKIRTING_CENTER_Z] = LEFT_SKIRTING.position;
const SKIRTING_HALF_DEPTH = LEFT_SKIRTING.size[2] / 2;
const SKIRTING_MIN_Z = SKIRTING_CENTER_Z - SKIRTING_HALF_DEPTH;
const SKIRTING_MAX_Z = SKIRTING_CENTER_Z + SKIRTING_HALF_DEPTH;

describe("room shell skirting", () => {
  it("stops the left skirting at the door instead of crossing the door panel", () => {
    expect(DOOR_OPENING_Z.min).toBeLessThan(DOOR_OPENING_Z.max);
    expect(ROOM_DOOR_POSITION[2]).toBeGreaterThan(DOOR_OPENING_Z.min);
    expect(ROOM_DOOR_POSITION[2]).toBeLessThan(DOOR_OPENING_Z.max);

    // 걸레받이가 문 개구부 안으로 들어가면 문짝 아래를 가로질러 보인다
    expect(SKIRTING_MAX_Z).toBeLessThanOrEqual(DOOR_OPENING_Z.min);
  });

  it("still runs the rest of the left wall", () => {
    expect(SKIRTING_MIN_Z).toBeCloseTo(ROOM_SHELL_BOUNDS.minZ + 0.16, 5);
    expect(LEFT_SKIRTING.size[2]).toBeGreaterThan(7);
    // 벽 길이의 대부분은 여전히 덮는다 (문 앞 구간만 빠진다)
    const wallDepth = ROOM_SHELL_BOUNDS.maxZ - ROOM_SHELL_BOUNDS.minZ;
    expect(LEFT_SKIRTING.size[2] / wallDepth).toBeGreaterThan(0.7);
  });
});
