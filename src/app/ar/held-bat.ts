import { type Object3D, Quaternion, Vector3 } from "three";

/*
 * 두 손으로 쥔 배트.
 *
 * 배트의 방향은 동작(ar-motion의 batMotionAt)이 정하고, 두 팔은 그 손잡이를 향해 뻗는다(IK).
 * 배트는 실제로 모인 두 손 사이에 끼운다: 팔이 목표에 다 못 닿아도 배트가 손을 떠나지 않는다.
 * 모델(ch1-baseball-bat.glb)은 손잡이 끝이 원점이고 +Y로 길다. 그립은 y 0.04~0.28이다.
 */

const BAT_MODEL_AXIS = new Vector3(0, 1, 0);
/** 두 손 한가운데가 오는 자리 (손잡이 끝에서 배트 축을 따라). 그립 아래쪽, 노브 바로 위다. */
const GRIP_FROM_KNOB = 0.12;
/** 두 손 사이 간격 (배트 축을 따라). 오른손 타자는 오른손이 위(배럴 쪽)다. */
export const HAND_GAP = 0.075;

/** 수평각·올림각 → 모델 공간의 단위 방향. 0,0이 정면(+Z), 수평각 +가 캐릭터의 왼쪽(+X). */
export function batDirection(yaw: number, pitch: number, out: Vector3): Vector3 {
  const flat = Math.cos(pitch);
  return out.set(Math.sin(yaw) * flat, Math.sin(pitch), Math.cos(yaw) * flat);
}

/** 두 손 한가운데와 배트 방향에서 배트의 자리와 회전을 낸다. */
export function placeHeldBat(
  handsMiddle: Vector3,
  direction: Vector3,
  position: Vector3,
  rotation: Quaternion,
): void {
  rotation.setFromUnitVectors(BAT_MODEL_AXIS, direction);
  position.copy(handsMiddle).addScaledVector(direction, -GRIP_FROM_KNOB);
}

/**
 * 손 뼈의 기준점은 손목이다. 배트와 IK는 주먹 한가운데에 맞춘다: 손목에 맞추면 배트가 손목을
 * 지나가 손과 따로 논다. 값은 손 뼈에 붙은 정점(가중치 0.5 이상)들의 중심을 손 뼈 좌표로 잰 것
 * (player-blocky.glb, 좌우 거의 같다). 모델을 바꾸면 다시 잰다.
 */
const PALM_LOCAL = new Vector3(0.005, 0.05, 0.014);

/** 주먹 한가운데 (월드 좌표). */
export function palmPoint(hand: Object3D, out: Vector3): Vector3 {
  return hand.localToWorld(out.copy(PALM_LOCAL));
}

const pivot = new Vector3();
const handWorld = new Vector3();
const toHand = new Vector3();
const toTarget = new Vector3();
const turn = new Quaternion();
const boneWorld = new Quaternion();
const parentWorld = new Quaternion();
const startUpper = new Quaternion();
const startFore = new Quaternion();

/** 뼈 하나를 돌려 손바닥이 목표 쪽을 보게 한다 (CCD 한 걸음). */
function turnToward(bone: Object3D, hand: Object3D, target: Vector3) {
  const parent = bone.parent;
  if (!parent) return;
  bone.getWorldPosition(pivot);
  palmPoint(hand, handWorld);
  toHand.subVectors(handWorld, pivot);
  toTarget.subVectors(target, pivot);
  if (toHand.lengthSq() < 1e-8 || toTarget.lengthSq() < 1e-8) return;
  turn.setFromUnitVectors(toHand.normalize(), toTarget.normalize());
  bone.getWorldQuaternion(boneWorld);
  parent.getWorldQuaternion(parentWorld);
  bone.quaternion.copy(parentWorld.invert().multiply(turn.multiply(boneWorld)));
  bone.updateMatrixWorld(true);
}

/** CCD 반복 수. 뼈가 둘이라 몇 번이면 수렴한다. */
const IK_ITERATIONS = 4;

/**
 * 위팔·아래팔을 돌려 손바닥을 target(월드 좌표)에 댄다. weight만큼만 섞는다 (0이면 그대로).
 * 호출 전에 팔 뼈의 월드 행렬이 최신이어야 한다.
 */
export function reachHandTo(
  upper: Object3D,
  fore: Object3D,
  hand: Object3D,
  target: Vector3,
  weight: number,
): void {
  if (weight <= 0) return;
  startUpper.copy(upper.quaternion);
  startFore.copy(fore.quaternion);
  for (let step = 0; step < IK_ITERATIONS; step += 1) {
    turnToward(fore, hand, target);
    turnToward(upper, hand, target);
  }
  if (weight < 1) {
    upper.quaternion.copy(startUpper.slerp(upper.quaternion, weight));
    fore.quaternion.copy(startFore.slerp(fore.quaternion, weight));
    upper.updateMatrixWorld(true);
  }
}
