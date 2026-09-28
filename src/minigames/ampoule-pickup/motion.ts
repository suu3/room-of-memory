/**
 * 앰플 집기의 움직임: 서랍이 밀려 나오는 거리와, 집어 든 앰플이 손 높이로 오르는 자세.
 *
 * 전부 순수 함수다. 프레임마다 ref만 만지는 useFrame(.claude/rules/r3f.md)이 이 값을
 * 읽고, 테스트는 화면 없이 곡선만 본다.
 *
 * 좌표는 기억 자리(MEMORY_PLACEMENTS.ampoule)의 **1배 로컬** 단위다. 거실 가구 배율은
 * 그 그룹이 통째로 입힌다.
 */

import { DRAWER_TRAVEL } from "@/scenes/memory-room/fridge-drawer";

export { DRAWER_TRAVEL };
/** 서랍이 다 열리는 데 걸리는 시간(초). 서랍 소리(voices.drawer)의 멎는 박자와 맞춘다. */
export const DRAWER_OPEN_DURATION = 0.55;
/** 앰플이 서랍에서 손 높이까지 오르는 시간(초). */
export const LIFT_DURATION = 0.9;

export type Vec3 = readonly [number, number, number];

/**
 * 서랍 안에 누운 앰플의 자리와 자세 (서랍이 닫혀 있을 때 기준. 열리면 z가 따라온다).
 * 앞판 바로 뒤에 두면 비스듬히 내려다보는 카메라에서 앞판에 통째로 가린다. 식량 캔들
 * 사이, 안쪽 벽 가까이에 눕힌다.
 */
export const AMPOULE_REST: { position: Vec3; rotation: Vec3 } = {
  position: [0.04, -0.13, -0.4],
  rotation: [0, 0.35, Math.PI / 2],
};

/**
 * 집어 든 앰플이 머무는 자리: 서랍 위, 카메라 쪽(+z)으로 한 뼘 앞. 카메라 프리셋
 * (CAMERA_PRESETS.ampoule)이 냉장고 아래칸을 비스듬히 내려다보므로 이 자리가 화면
 * 가운데쯤에 온다.
 */
export const AMPOULE_RAISED: Vec3 = [0.3, 0.6, 0.45];
/**
 * 들고 있을 때의 배율. 카메라가 직교라 가까이 들어도 커지지 않는다. "눈앞에 든다"를
 * 배율로 대신한다. 야구공만 한 물건이 손바닥 안에서 읽힐 만큼만.
 */
export const HELD_SCALE = 1.8;
/** 들고 있을 때의 기울기(x축). 똑바로 세우면 라벨이 카메라를 등진다. */
export const RAISED_TILT = 0.18;
/** 들고 있을 때 천천히 도는 속도 (rad/s). 라벨의 지워진 면이 한 바퀴 안에 보인다. */
export const RAISED_SPIN = 0.8;
/** 들고 있는 손이 숨 쉬듯 오르내리는 폭과 속도. */
export const HOLD_BOB_AMPLITUDE = 0.012;
export const HOLD_BOB_RATE = 2.2;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** 빠르게 나왔다가 끝에서 멎는 곡선. 서랍도 손도 이 박자로 움직인다. */
export function easeOutCubic(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

/** 서랍이 열리기 시작한 뒤 `elapsed`초에 앞면이 나와 있는 거리. */
export function drawerOffset(elapsed: number): number {
  return DRAWER_TRAVEL * easeOutCubic(elapsed / DRAWER_OPEN_DURATION);
}

/** 서랍이 다 열렸는가: 이때부터 앰플을 집을 수 있다. */
export function drawerOpen(elapsed: number): boolean {
  return elapsed >= DRAWER_OPEN_DURATION;
}

export interface AmpoulePose {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

/**
 * 집어 든 뒤 `elapsed`초의 자세. 서랍 안(열린 자리)에서 손 높이로 오르며 눕힌 몸을
 * 세운다. 다 오르면 그 자리에서 천천히 돌고 숨 쉬듯 오르내린다 (`time`은 씬 시계).
 */
export function liftPose(elapsed: number, time: number): AmpoulePose {
  const t = easeOutCubic(elapsed / LIFT_DURATION);
  const rest = AMPOULE_REST;
  const restZ = rest.position[2] + DRAWER_TRAVEL;
  const settled = elapsed >= LIFT_DURATION;
  const bob = settled ? Math.sin(time * HOLD_BOB_RATE) * HOLD_BOB_AMPLITUDE : 0;
  return {
    position: [
      rest.position[0] + (AMPOULE_RAISED[0] - rest.position[0]) * t,
      rest.position[1] + (AMPOULE_RAISED[1] - rest.position[1]) * t + bob,
      restZ + (AMPOULE_RAISED[2] - restZ) * t,
    ],
    rotation: [
      rest.rotation[0] + (RAISED_TILT - rest.rotation[0]) * t,
      rest.rotation[1] + (settled ? time * RAISED_SPIN : 0),
      rest.rotation[2] * (1 - t),
    ],
    scale: 1 + (HELD_SCALE - 1) * t,
  };
}
