import type { MemoryId } from "@/data/memory-room";

type HighlightableStatus = "locked" | "available" | "done";

/**
 * 밝기 램프의 양 끝. 실제 값은 `roomLightLevel`(0~1)로 두 끝을 보간해 얻는다.
 * 예전에는 수집 개수만 보고 단조 증가시켰는데, 기획의 V자 감정선
 * (평범 → 어둠 → 희망)과 정반대였다.
 */
export const ROOM_LIGHTING = {
  /** 천장 전등(point light)의 최대 세기. 전등 램프의 윗끝이다. */
  ceilingFill: 28,
  /** 하늘-바닥 반구광의 최대 세기. */
  hemisphereFill: 1.25,
} as const;

/**
 * 빛은 두 축이다 (DESIGN.md > Lighting).
 *
 * - **cool**: 차가운 간접광(ambient·반구·키·전등). 1막에 깎이고, 2막에도 낮게 남는다.
 *   되찾는다고 방 전체가 밝아지면 안 된다. 구석은 차갑고 어둡게 남아야 한다.
 * - **warm**: 창으로 드는 볕(창가 point light·directional 볕·광선·먼지). 1막에는 없고
 *   2막 회복도를 그대로 따른다. 실제 창 경로로 책상 일부·바닥 일부에만 닿는다.
 *
 * 램프 값은 그 축의 0과 1에서의 값이다. `roomLightValue`로 보간한다.
 */
export const ROOM_LIGHT_RAMP = {
  /* cool: 바닥값은 실루엣과 조사 대상이 남는 최저치, 윗값은 커튼 닫은 낮의 방 */
  ambient: [0.3, 2.6],
  key: [0.25, 3.6],
  hemisphere: [0.2, ROOM_LIGHTING.hemisphereFill],
  lamp: [4, ROOM_LIGHTING.ceilingFill],
  /* warm */
  windowGlow: [0.35, 4],
  /** 창 방향의 directional 볕. 뒷벽의 창 개구부가 그림자로 모양을 만든다. */
  sun: [0, 5],
  /** 떠도는 먼지의 불투명도. 빛이 강할수록 걸리는 먼지가 많아 보인다. */
  dust: [0.14, 0.6],
  /** 창 광선의 세기. 먼지가 아니라 이 값이 "빛이 든다"는 인상을 만든다. */
  windowLight: [0.15, 1],
  /* overall */
  /** 비네트. 어두울수록 가장자리가 조여든다. */
  vignette: [0.62, 0.24],
} as const;

export interface RoomLightMix {
  /** 차가운 간접광의 양 (0~1) */
  cool: number;
  /** 창으로 드는 볕의 양 (0~1) */
  warm: number;
}

/**
 * 2막에서 간접광이 되돌아오는 상한. 되찾을수록 아주 조금만 트인다. 온기는 볕이
 * 맡고, 간접광은 그림자를 지키는 몫이다.
 */
const ACT2_COOL_CEILING = 0.16;

/**
 * 진행도를 두 빛의 양으로 가른다.
 *
 * 1막: cool은 `roomLightLevel`과 같은 곡선으로 깎이고 warm은 없다.
 * 2막: warm이 회복도를 그대로 따르고, cool은 바닥에서 아주 조금만 올라온다.
 * 전환점(1막 완주 = 2막 0)에서 두 축 모두 0으로 이어진다.
 */
export function roomLightMix(input: RoomLightInput): RoomLightMix {
  if (input.collected < input.memoryTotal) {
    return { cool: roomLightLevel(input), warm: 0 };
  }
  const recovery = Math.min(1, Math.max(0, input.recovery));
  return { cool: ACT2_COOL_CEILING * recovery, warm: recovery };
}

/**
 * 1바퀴 진입 시점의 밝기. 기획상 "평범한 밝기: 어둡지 않다. 그냥 낮의 남고생 방".
 * 2바퀴를 완주한 금빛(1.0)보다는 낮다. 같은 밝기라도 성격이 다른 지점이다.
 */
export const ENTRY_LIGHT_LEVEL = 0.62;

export interface OutsideDecayInput {
  collected: number;
  memoryTotal: number;
  phase: 1 | 2;
}

export interface RoomLightInput {
  /** 1막에서 조사한 개수 */
  collected: number;
  memoryTotal: number;
  /**
   * 2막 추리의 진행도 (0~1). 재조사 **개수**가 아니라 비율을 받는다.
   * 무엇이 필수 체인이고 무엇이 곁가지인지는 스토어가 알고(actTwoProgress),
   * 여기는 "얼마나 되찾았는가"만 알면 된다.
   */
  recovery: number;
}

/**
 * 공간의 밝기(0=바닥, 1=완성). 1막은 깎고 2막은 채운다.
 * 기획의 V자 감정선 (docs/story/content-design.md 5장).
 *
 * 진입 0.62(평범) → 1막 완주 0(가장 어두움) → 2막 완주 1(금빛).
 * 두 구간이 0에서 이어지므로 라디오 전환점에서 끊기지 않는다.
 */
export function roomLightLevel({ collected, memoryTotal, recovery }: RoomLightInput): number {
  if (collected < memoryTotal) {
    const progress = memoryTotal <= 0 ? 1 : collected / memoryTotal;
    return ENTRY_LIGHT_LEVEL * (1 - progress);
  }
  return Math.min(1, Math.max(0, recovery));
}

/**
 * 전등을 껐을 때 남기는 비율. 0으로 두면 아무것도 안 보여 스위치를 다시 누를
 * 수조차 없다. 커튼 틈으로 드는 빛만큼은 남긴다.
 */
export const LIGHTS_OFF_FACTOR = 0.26;

/**
 * 인트로(1인칭으로 스위치를 찾는 구간)의 어둠. 평소 소등(0.26)보다 한 단계 더
 * 어둡되 방의 윤곽은 남는다. **일부만 보이는** 느낌은 조명이 아니라 화면 가운데만
 * 남기는 비네트(MemoryRoom의 인트로 비네트)가 만든다. 조명으로 만들면 방이 통째로
 * 검어져 어디가 벽인지도 모른다 (0.05로 해 봤다: 창밖만 남았다).
 */
export const BLACKOUT_FACTOR = 0.18;

/**
 * 전등 스위치를 반영한다. 방 안의 빛(ambient·key)과 여기에 물린 BGM·비네트에만
 * 곱하고, 창으로 드는 빛에는 쓰지 않는다. 밖에서 오는 빛은 방 스위치와 무관하다.
 *
 * `blackout`은 인트로의 어둠이다. 불이 꺼져 있을 때만 뜻이 있다: 켜져 있으면 무시한다.
 */
export function lampScaled(value: number, lightsOn: boolean, blackout = false): number {
  if (lightsOn) return value;
  return value * (blackout ? BLACKOUT_FACTOR : LIGHTS_OFF_FACTOR);
}

/** 램프의 두 끝을 밝기로 보간한다. */
export function roomLightValue(ramp: readonly [number, number], level: number): number {
  const clamped = Math.min(1, Math.max(0, level));
  return ramp[0] + (ramp[1] - ramp[0]) * clamped;
}

/**
 * 배경 그라디언트 단계. 1막은 평범(dim) → 어둠(dark)만 오가고,
 * 금빛(gold)은 2막에서 되찾기 시작했을 때만 나온다.
 *
 * 2막은 dim을 건너뛴다. 평범한 낮의 방은 1막의 것이고, 추리 중에 그게 다시 뜨면
 * 2막의 톤(직면)이 무너진다. 바닥에서 곧장 온기로 넘어가는 편이 기획의
 * "정적 위에 새로 드는 다른 온기"와도 맞는다 (docs/story/content-design.md 8장).
 * 상단 독백은 이 단계와 무관하게 조사 개수를 따른다 (src/data/monologue.ts).
 */
export function roomStageIndex(level: number, phase: 1 | 2): number {
  if (phase === 1) return level > 0.34 ? 1 : 0;
  return level > 0.2 ? 2 : 0;
}

/**
 * 창밖이 얼마나 무너져 보이는지 (0=평범한 야경, 1=사태 이후).
 *
 * 방 밝기는 V자(평범 → 어둠 → 금빛)로 오르내리지만 창밖은 되돌아가지 않는다.
 * 알게 된 사실이 도로 없던 일이 되지는 않으니까. 1바퀴에서 수집할수록 단조 증가하고
 * 2바퀴에서는 1로 고정된다.
 */
export function outsideDecay({ collected, memoryTotal, phase }: OutsideDecayInput): number {
  if (phase === 2) return 1;
  if (memoryTotal <= 0) return 1;
  return Math.min(1, Math.max(0, collected / memoryTotal));
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
