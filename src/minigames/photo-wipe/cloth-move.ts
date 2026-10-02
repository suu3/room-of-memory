import type { WipeArea } from "./wipe-grid";

/** 헝겊이 놓인 자리. 캔버스 좌표(사진의 원래 크기 기준)다. */
export interface ClothPoint {
  x: number;
  y: number;
}

export type ClothDirection = "up" | "down" | "left" | "right";

const OFFSETS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const satisfies Record<ClothDirection, ClothPoint>;

/** 키보드 헝겊이 처음 놓이는 자리: 사진 한가운데. */
export function clothStart(area: WipeArea): ClothPoint {
  return { x: area.width / 2, y: area.height / 2 };
}

/**
 * 헝겊을 한 걸음 옮긴 자리. 사진 밖으로는 나가지 않는다: 가장자리에 닿으면 거기서 멈춘다
 * (가장자리 셀은 헝겊 중심이 테두리 위에 있어야 닦인다).
 */
export function moveCloth(
  from: ClothPoint,
  direction: ClothDirection,
  area: WipeArea,
  step: number,
): ClothPoint {
  const offset = OFFSETS[direction];
  return {
    x: Math.min(area.width, Math.max(0, from.x + offset.x * step)),
    y: Math.min(area.height, Math.max(0, from.y + offset.y * step)),
  };
}
