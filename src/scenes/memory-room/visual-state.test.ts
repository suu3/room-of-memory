import { describe, expect, it } from "vitest";
import {
  BLACKOUT_FACTOR,
  ENTRY_LIGHT_LEVEL,
  LIGHTS_OFF_FACTOR,
  lampScaled,
  outsideDecay,
  ROOM_LIGHT_RAMP,
  ROOM_LIGHTING,
  roomLightLevel,
  roomLightMix,
  roomLightValue,
  roomStageIndex,
  shouldHighlightMemory,
} from "./visual-state";

const MEMORY_TOTAL = 7;
const atCollected = (collected: number) => ({ memoryTotal: MEMORY_TOTAL, collected, recovery: 0 });
/** 2막 진행도(0~1): 스토어의 actTwoProgress가 넘겨주는 값과 같은 축이다. */
const atRecovery = (recovery: number) => ({
  memoryTotal: MEMORY_TOTAL,
  collected: MEMORY_TOTAL,
  recovery,
});

describe("memory-room visual state", () => {
  it("highlights only an available memory within the player's interaction range", () => {
    expect(shouldHighlightMemory("available", "console", "console")).toBe(true);
    expect(shouldHighlightMemory("available", "console", null)).toBe(false);
    expect(shouldHighlightMemory("available", "console", "ball")).toBe(false);
    expect(shouldHighlightMemory("locked", "console", "console")).toBe(false);
    expect(shouldHighlightMemory("done", "console", "console")).toBe(false);
  });

  it("also highlights an available memory the mouse is hovering from anywhere", () => {
    expect(shouldHighlightMemory("available", "console", null, true)).toBe(true);
    expect(shouldHighlightMemory("available", "console", "ball", true)).toBe(true);
    // 클릭할 수 없는 기억은 호버해도 빛나지 않는다
    expect(shouldHighlightMemory("locked", "console", null, true)).toBe(false);
    expect(shouldHighlightMemory("done", "console", null, true)).toBe(false);
  });

  it("어둡지 않은 평범한 밝기로 시작한다 (기획안: 진입은 낮의 남고생 방)", () => {
    expect(roomLightLevel(atCollected(0))).toBeCloseTo(ENTRY_LIGHT_LEVEL);
    expect(ENTRY_LIGHT_LEVEL).toBeGreaterThan(0.5);
  });

  it("1막은 조사할수록 어두워지고 완주 지점이 바닥이다", () => {
    const curve = [0, 2, 4, 6, 7].map((n) => roomLightLevel(atCollected(n)));
    for (let index = 1; index < curve.length; index += 1) {
      expect(curve[index]).toBeLessThan(curve[index - 1]);
    }
    expect(curve.at(-1)).toBe(0);
  });

  it("2막은 추리가 진행될수록 밝아져 완성에서 최대가 된다", () => {
    const curve = [0, 0.25, 0.5, 1].map((n) => roomLightLevel(atRecovery(n)));
    for (let index = 1; index < curve.length; index += 1) {
      expect(curve[index]).toBeGreaterThan(curve[index - 1]);
    }
    expect(curve.at(-1)).toBe(1);
  });

  it("전환점에서 밝기가 끊기지 않는다. 1막 끝과 2막 시작이 같은 값", () => {
    expect(roomLightLevel(atCollected(7))).toBe(roomLightLevel(atRecovery(0)));
  });

  it("금빛 배경은 2막에서만 나온다", () => {
    expect(roomStageIndex(1, 1)).toBeLessThan(2);
    expect(roomStageIndex(ENTRY_LIGHT_LEVEL, 1)).toBeLessThan(2);
    expect(roomStageIndex(1, 2)).toBe(2);
  });

  it("2막은 dim 단계를 건너뛴다. 그 단계의 독백은 1막의 말이다", () => {
    // "심심하네, 뭐부터 해볼까"가 추리 중에 뜨면 2막의 톤이 무너진다
    expect(roomStageIndex(0.1, 2)).toBe(0);
    expect(roomStageIndex(0.3, 2)).toBe(2);
    expect(roomStageIndex(0.5, 2)).toBe(2);
  });

  it("dims the room when the wall switch is off, without blacking it out", () => {
    // 완전히 0이면 스위치를 다시 누를 수조차 없다
    expect(lampScaled(1, false)).toBeGreaterThan(0);
    expect(lampScaled(1, false)).toBeLessThan(lampScaled(1, true));
    // 켜져 있을 때는 아무것도 건드리지 않는다. 기존 밝기가 그대로여야 한다
    expect(lampScaled(0.62, true)).toBe(0.62);
    expect(lampScaled(0, false)).toBe(0);
  });

  it("램프는 밝기를 따라 보간되고 양 끝을 넘지 않는다", () => {
    for (const ramp of Object.values(ROOM_LIGHT_RAMP)) {
      expect(roomLightValue(ramp, 0)).toBe(ramp[0]);
      expect(roomLightValue(ramp, 1)).toBe(ramp[1]);
      // 범위 밖 입력도 양 끝으로 잘린다
      expect(roomLightValue(ramp, -1)).toBe(ramp[0]);
      expect(roomLightValue(ramp, 2)).toBe(ramp[1]);
    }
    // 비네트만 반대 방향: 어두울수록 조여든다
    expect(ROOM_LIGHT_RAMP.vignette[0]).toBeGreaterThan(ROOM_LIGHT_RAMP.vignette[1]);
  });

  it("고정 채움광은 그대로 유지한다", () => {
    expect(ROOM_LIGHTING.ceilingFill).toBeGreaterThanOrEqual(26);
    expect(ROOM_LIGHTING.hemisphereFill).toBeGreaterThanOrEqual(1.2);
  });
});

describe("outsideDecay", () => {
  const memoryTotal = 7;

  it("only ever gets worse as the first loop uncovers more", () => {
    let previous = -1;
    for (let collected = 0; collected <= memoryTotal; collected += 1) {
      const decay = outsideDecay({ collected, memoryTotal, phase: 1 });
      expect(decay).toBeGreaterThanOrEqual(previous);
      previous = decay;
    }
    expect(outsideDecay({ collected: 0, memoryTotal, phase: 1 })).toBe(0);
    expect(outsideDecay({ collected: memoryTotal, memoryTotal, phase: 1 })).toBe(1);
  });

  it("stays at the bottom through the second loop: the room brightens, the street does not", () => {
    expect(outsideDecay({ collected: 0, memoryTotal, phase: 2 })).toBe(1);
    expect(outsideDecay({ collected: memoryTotal, memoryTotal, phase: 2 })).toBe(1);
  });

  it("clamps nonsense input instead of blowing past the ramp", () => {
    expect(outsideDecay({ collected: 99, memoryTotal, phase: 1 })).toBe(1);
    expect(outsideDecay({ collected: -3, memoryTotal, phase: 1 })).toBe(0);
    expect(outsideDecay({ collected: 1, memoryTotal: 0, phase: 1 })).toBe(1);
  });
});

describe("roomLightMix", () => {
  const total = 7;
  const act1 = (collected: number) => roomLightMix({ memoryTotal: total, collected, recovery: 0 });
  const act2 = (recovery: number) =>
    roomLightMix({ memoryTotal: total, collected: total, recovery });

  it("1막에는 볕이 없고 간접광만 깎인다", () => {
    expect(act1(0).warm).toBe(0);
    expect(act1(0).cool).toBeCloseTo(ENTRY_LIGHT_LEVEL);
    expect(act1(4).cool).toBeLessThan(act1(0).cool);
    expect(act1(7).cool).toBe(0);
  });

  it("2막에는 볕이 회복도를 따르고 간접광은 낮게 남는다", () => {
    expect(act2(0.5).warm).toBe(0.5);
    expect(act2(1).warm).toBe(1);
    // 되찾아도 방 전체가 밝아지지는 않는다. 구석은 차갑게 남는다
    expect(act2(1).cool).toBeLessThan(ENTRY_LIGHT_LEVEL / 2);
    expect(act2(1).cool).toBeGreaterThan(act2(0).cool);
  });

  it("전환점에서 두 축 모두 이어진다", () => {
    expect(act1(7)).toEqual(act2(0));
  });
});

describe("lampScaled와 인트로의 어둠", () => {
  it("불이 켜져 있으면 blackout은 아무 뜻이 없다", () => {
    expect(lampScaled(2, true, true)).toBe(2);
  });

  it("인트로의 어둠은 평소 소등보다 깊되 0은 아니다", () => {
    expect(BLACKOUT_FACTOR).toBeGreaterThan(0);
    expect(BLACKOUT_FACTOR).toBeLessThan(LIGHTS_OFF_FACTOR);
    expect(lampScaled(2, false, true)).toBeCloseTo(2 * BLACKOUT_FACTOR);
    expect(lampScaled(2, false)).toBeCloseTo(2 * LIGHTS_OFF_FACTOR);
  });
});
