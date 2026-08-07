import type { MemoryId } from "@/data/memory-room";

type HighlightableStatus = "locked" | "available" | "done";

/** 잠긴 기억의 불투명도. 있는 건 보이되 만질 수 없다는 게 한눈에 와야 한다. */
const LOCKED_MEMORY_OPACITY = 0.45;

/**
 * 밝기 램프의 양 끝. 실제 값은 `roomLightLevel`(0~1)로 두 끝을 보간해 얻는다.
 * 예전에는 수집 개수만 보고 단조 증가시켰는데, 기획의 V자 감정선
 * (평범 → 어둠 → 희망)과 정반대였다.
 */
export const ROOM_LIGHT_RAMP = {
  ambient: [1.15, 3.6],
  key: [1.9, 5.6],
  windowGlow: [0.5, 2.9],
  /** 떠도는 먼지의 불투명도. 빛이 강할수록 걸리는 먼지가 많아 보인다. */
  dust: [0.16, 0.6],
  /** 창 광선의 세기. 먼지가 아니라 이 값이 "빛이 든다"는 인상을 만든다. */
  windowLight: [0.2, 1.15],
  /** 비네트. 어두울수록 가장자리가 조여든다. */
  vignette: [0.62, 0.24],
} as const;

export const ROOM_LIGHTING = {
  ceilingFill: 28,
  hemisphereFill: 1.25,
} as const;

/**
 * 1바퀴 진입 시점의 밝기. 기획상 "평범한 밝기 — 어둡지 않다. 그냥 낮의 남고생 방".
 * 2바퀴를 완주한 금빛(1.0)보다는 낮다. 같은 밝기라도 성격이 다른 지점이다.
 */
export const ENTRY_LIGHT_LEVEL = 0.62;

export interface OutsideDecayInput {
  collected: number;
  memoryTotal: number;
  phase: 1 | 2;
}

export interface RoomLightInput {
  /** 1바퀴에서 수집한 개수 */
  collected: number;
  memoryTotal: number;
  /** 2바퀴에서 재조사한 개수 */
  revisited: number;
  revisitTotal: number;
}

/**
 * 방의 밝기(0=바닥, 1=완성). 1바퀴는 깎고 2바퀴는 채운다.
 *
 * 진입 0.62(평범) → 1바퀴 완주 0(가장 어두움) → 2바퀴 완주 1(금빛).
 * 두 구간이 0에서 이어지므로 라디오 전환점에서 끊기지 않는다.
 */
export function roomLightLevel({
  collected,
  memoryTotal,
  revisited,
  revisitTotal,
}: RoomLightInput): number {
  if (collected < memoryTotal) {
    const progress = memoryTotal <= 0 ? 1 : collected / memoryTotal;
    return ENTRY_LIGHT_LEVEL * (1 - progress);
  }
  return revisitTotal <= 0 ? 1 : Math.min(1, revisited / revisitTotal);
}

/**
 * 전등을 껐을 때 남기는 비율. 0으로 두면 아무것도 안 보여 스위치를 다시 누를
 * 수조차 없다 — 커튼 틈으로 드는 빛만큼은 남긴다.
 */
export const LIGHTS_OFF_FACTOR = 0.26;

/**
 * 전등 스위치를 반영한다. 방 안의 빛(ambient·key)과 여기에 물린 BGM·비네트에만
 * 곱하고, 창으로 드는 빛에는 쓰지 않는다 — 밖에서 오는 빛은 방 스위치와 무관하다.
 */
export function lampScaled(value: number, lightsOn: boolean): number {
  return lightsOn ? value : value * LIGHTS_OFF_FACTOR;
}

/** 램프의 두 끝을 밝기로 보간한다. */
export function roomLightValue(ramp: readonly [number, number], level: number): number {
  const clamped = Math.min(1, Math.max(0, level));
  return ramp[0] + (ramp[1] - ramp[0]) * clamped;
}

/**
 * 배경 그라디언트 단계. 1바퀴는 평범(dim) → 어둠(dark)만 오가고,
 * 금빛(gold)은 2바퀴에서 되찾았을 때만 나온다.
 */
export function roomStageIndex(level: number, phase: 1 | 2): number {
  if (phase === 1) return level > 0.34 ? 1 : 0;
  if (level > 0.55) return 2;
  return level > 0.2 ? 1 : 0;
}

/**
 * 창밖이 얼마나 무너져 보이는지 (0=평범한 야경, 1=사태 이후).
 *
 * 방 밝기는 V자(평범 → 어둠 → 금빛)로 오르내리지만 창밖은 되돌아가지 않는다 —
 * 알게 된 사실이 도로 없던 일이 되지는 않으니까. 1바퀴에서 수집할수록 단조 증가하고
 * 2바퀴에서는 1로 고정된다.
 */
export function outsideDecay({ collected, memoryTotal, phase }: OutsideDecayInput): number {
  if (phase === 2) return 1;
  if (memoryTotal <= 0) return 1;
  return Math.min(1, Math.max(0, collected / memoryTotal));
}

/**
 * 잠긴 기억을 얼마나 흐리게 그릴지.
 *
 * 흐림은 "이 바퀴에 곧 열릴 물건"이라는 신호다. 그래서 **이 바퀴에 아예 없는**
 * 기억(1바퀴의 컴퓨터)에는 걸지 않는다 — 걸면 켜지지도 않은 물건이 반투명하게
 * 떠서 열릴 차례를 기다리는 것처럼 보인다. 그건 그냥 책상 위 가구여야 한다.
 */
export function memoryOpacity(status: HighlightableStatus, inThisRound: boolean): number {
  return status === "locked" && inThisRound ? LOCKED_MEMORY_OPACITY : 1;
}

/** 클릭 가능한(=available) 기억은 플레이어가 가까이 있거나 마우스를 올렸을 때 빛난다. */
export function shouldHighlightMemory(
  status: HighlightableStatus,
  id: MemoryId,
  nearbyMemoryId: MemoryId | null,
  hovered = false,
) {
  return status === "available" && (hovered || nearbyMemoryId === id);
}
