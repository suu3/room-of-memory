import { describe, expect, it } from "vitest";
import {
  ENTRY_LIGHT_LEVEL,
  ROOM_LIGHT_RAMP,
  ROOM_LIGHTING,
  roomLightLevel,
  roomLightValue,
  roomStageIndex,
  shouldHighlightMemory,
} from "./visual-state";

const FULL_RUN = { memoryTotal: 7, revisitTotal: 3 };
const atCollected = (collected: number) => ({ ...FULL_RUN, collected, revisited: 0 });
const atRevisited = (revisited: number) => ({ ...FULL_RUN, collected: 7, revisited });

describe("memory-room visual state", () => {
  it("highlights only an available memory within the player's interaction range", () => {
    expect(shouldHighlightMemory("available", "bat", "bat")).toBe(true);
    expect(shouldHighlightMemory("available", "bat", null)).toBe(false);
    expect(shouldHighlightMemory("available", "bat", "ball")).toBe(false);
    expect(shouldHighlightMemory("locked", "bat", "bat")).toBe(false);
    expect(shouldHighlightMemory("done", "bat", "bat")).toBe(false);
  });

  it("also highlights an available memory the mouse is hovering from anywhere", () => {
    expect(shouldHighlightMemory("available", "bat", null, true)).toBe(true);
    expect(shouldHighlightMemory("available", "bat", "ball", true)).toBe(true);
    // 클릭할 수 없는 기억은 호버해도 빛나지 않는다
    expect(shouldHighlightMemory("locked", "bat", null, true)).toBe(false);
    expect(shouldHighlightMemory("done", "bat", null, true)).toBe(false);
  });

  it("어둡지 않은 평범한 밝기로 시작한다 (기획안: 진입은 낮의 남고생 방)", () => {
    expect(roomLightLevel(atCollected(0))).toBeCloseTo(ENTRY_LIGHT_LEVEL);
    expect(ENTRY_LIGHT_LEVEL).toBeGreaterThan(0.5);
  });

  it("1바퀴는 조사할수록 어두워지고 완주 지점이 바닥이다", () => {
    const curve = [0, 2, 4, 6, 7].map((n) => roomLightLevel(atCollected(n)));
    for (let index = 1; index < curve.length; index += 1) {
      expect(curve[index]).toBeLessThan(curve[index - 1]);
    }
    expect(curve.at(-1)).toBe(0);
  });

  it("2바퀴는 재조사할수록 밝아져 완성에서 최대가 된다", () => {
    const curve = [0, 1, 2, 3].map((n) => roomLightLevel(atRevisited(n)));
    for (let index = 1; index < curve.length; index += 1) {
      expect(curve[index]).toBeGreaterThan(curve[index - 1]);
    }
    expect(curve.at(-1)).toBe(1);
  });

  it("전환점에서 밝기가 끊기지 않는다 — 1바퀴 끝과 2바퀴 시작이 같은 값", () => {
    expect(roomLightLevel(atCollected(7))).toBe(roomLightLevel(atRevisited(0)));
  });

  it("금빛 배경은 2바퀴에서만 나온다", () => {
    expect(roomStageIndex(1, 1)).toBeLessThan(2);
    expect(roomStageIndex(ENTRY_LIGHT_LEVEL, 1)).toBeLessThan(2);
    expect(roomStageIndex(1, 2)).toBe(2);
  });

  it("램프는 밝기를 따라 보간되고 양 끝을 넘지 않는다", () => {
    for (const ramp of Object.values(ROOM_LIGHT_RAMP)) {
      expect(roomLightValue(ramp, 0)).toBe(ramp[0]);
      expect(roomLightValue(ramp, 1)).toBe(ramp[1]);
      // 범위 밖 입력도 양 끝으로 잘린다
      expect(roomLightValue(ramp, -1)).toBe(ramp[0]);
      expect(roomLightValue(ramp, 2)).toBe(ramp[1]);
    }
    // 비네트만 반대 방향 — 어두울수록 조여든다
    expect(ROOM_LIGHT_RAMP.vignette[0]).toBeGreaterThan(ROOM_LIGHT_RAMP.vignette[1]);
  });

  it("고정 채움광은 그대로 유지한다", () => {
    expect(ROOM_LIGHTING.ceilingFill).toBeGreaterThanOrEqual(26);
    expect(ROOM_LIGHTING.hemisphereFill).toBeGreaterThanOrEqual(1.2);
  });
});
