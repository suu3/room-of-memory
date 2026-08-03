/**
 * 카메라를 가리는 벽을 지우는 규칙.
 *
 * 사면벽 방에 아이소메트릭 카메라를 두면, 카메라 쪽 두 벽이 방을 통째로 가린다.
 * 이 카메라의 부각은 약 22°라 높이 4.8짜리 벽 하나가 그 뒤 바닥을 11유닛 넘게 덮는다
 * — 방 폭(14)의 대부분이다. 그래서 카메라를 향한 벽은 걷어내야 한다.
 *
 * 다만 통째로 지우면 바닥이 허공에 뜬 판으로 보인다. 아래쪽 굽도리(STUB)는 남기고
 * 윗부분만 지운다 — 바닥과 벽이 만나는 선이 남아 있어야 "방 안"으로 읽힌다.
 * 남기는 높이 0.55는 같은 계산으로 그 뒤 바닥을 1.3유닛만 가린다(허용 범위).
 */

export type WallSide = "back" | "front" | "left" | "right";

export const WALL_SIDES = ["back", "front", "left", "right"] as const satisfies readonly WallSide[];

/** 각 벽의 바깥쪽 법선(XZ). 카메라가 이 방향에 있으면 그 벽이 방을 가린다. */
export const WALL_NORMALS = {
  back: [0, -1],
  front: [0, 1],
  left: [-1, 0],
  right: [1, 0],
} as const satisfies Record<WallSide, readonly [x: number, z: number]>;

/**
 * 페이드 구간. facing(법선·카메라방향)이 FADE_START 아래면 그대로 두고,
 * FADE_END 위면 완전히 지운다.
 *
 * 0에서 바로 지우면 안 된다 — 카메라가 벽과 정면으로 나란한 각도(facing=0)에서는
 * 그 벽이 화면 옆구리를 이루고 있을 뿐 아무것도 가리지 않는다. 거기서 지우면
 * 방의 옆면이 통째로 뚫려 보인다.
 *
 * 구간을 좁게 잡는다. 넓게 잡았더니 회전 범위(±0.5rad) 안에서 벽이 40~60%
 * 불투명도로 오래 머물렀는데, 반쯤 비치는 벽은 서 있는 것도 걷힌 것도 아니라
 * 그냥 고장난 것처럼 보인다. 좁으면 사실상 켜짐/꺼짐이고, 그 사이 전환은
 * CulledWall의 시간 damp가 부드럽게 만든다.
 */
const FADE_START = 0.28;
const FADE_END = 0.42;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * 방 중심에서 카메라가 (dirX, dirZ) 쪽에 있을 때, 그 벽 윗부분의 불투명도.
 * 1이면 그대로 서 있고 0이면 굽도리만 남는다.
 */
export function wallOpacity(side: WallSide, dirX: number, dirZ: number): number {
  const length = Math.hypot(dirX, dirZ);
  if (!Number.isFinite(length) || length === 0) return 1;

  const [normalX, normalZ] = WALL_NORMALS[side];
  const facing = (normalX * dirX + normalZ * dirZ) / length;
  return 1 - smoothstep(FADE_START, FADE_END, facing);
}
