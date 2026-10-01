import { type Object3D, Vector3 } from "three";
import { batDirection, palmPoint, placeHeldBat, reachHandTo } from "./held-bat";

/*
 * 엔딩에 어깨에 메고 나가는 배트 (docs/content-design.md 3-3).
 *
 * 문턱을 넘는 뒷모습이 엔딩 영상의 첫 컷, 배트를 쥐고 문을 나서는 뒷모습과 이어져야 한다.
 * 오른손 한 손으로 손잡이를 쥐고, 배럴은 오른어깨에 걸쳐 뒤로 넘긴다. 뒤에서 봤을 때
 * 어깨 위로 비스듬히 솟은 배트가 한눈에 읽히는 자세다. 왼팔은 걸음대로 흔든다.
 *
 * 좌표는 몸(리그 루트의 부모) 공간이다: +Z가 정면, +X가 캐릭터의 왼쪽, 발바닥이 y 0.
 * AR의 타격 준비 자세(ar-motion의 BAT_READY)를 한 손 판으로 옮긴 값이다.
 */
const CARRY_POSE = {
  /** 손잡이를 쥔 오른손 자리: 가슴 오른쪽 앞. */
  gripX: -0.15,
  gripY: 0.8,
  gripZ: 0.14,
  /**
   * 배트가 뻗는 쪽: 뒤로, 바깥으로. 어깨 너머로 넘어간다. 더 뒤로(정뒤) 눕히면 등 뒤
   * 카메라에서 배트가 머리에 가려 안 읽힌다. 바깥으로 비스듬히 빼야 실루엣이 선다.
   */
  yaw: (-145 * Math.PI) / 180,
  /** 올림각. 어깨에 얹힐 만큼. */
  pitch: (44 * Math.PI) / 180,
} as const;

export interface CarryBones {
  upper: Object3D;
  fore: Object3D;
  hand: Object3D;
}

/** 리그에서 오른팔 뼈를 찾는다. 모델에 없으면 null: 그때는 배트를 들지 않는다. */
export function findCarryBones(root: Object3D): CarryBones | null {
  const upper = root.getObjectByName("upper_armR");
  const fore = root.getObjectByName("forearmR");
  const hand = root.getObjectByName("handR");
  return upper && fore && hand ? { upper, fore, hand } : null;
}

const direction = new Vector3();
const target = new Vector3();
const palm = new Vector3();

/**
 * 오른손을 손잡이 자리로 뻗고(IK), 배트를 실제로 닿은 손바닥에 끼운다.
 *
 * 걸음 애니메이션(updatePlayerRig)을 돌린 **뒤에** 부른다. `body`는 리그 루트의 부모,
 * `bat`은 그 자식이다. 배트의 자리와 회전은 `body` 공간으로 쓴다.
 */
export function carryBat(bones: CarryBones, body: Object3D, bat: Object3D): void {
  body.updateMatrixWorld(true);
  batDirection(CARRY_POSE.yaw, CARRY_POSE.pitch, direction);
  body.localToWorld(target.set(CARRY_POSE.gripX, CARRY_POSE.gripY, CARRY_POSE.gripZ));
  reachHandTo(bones.upper, bones.fore, bones.hand, target, 1);
  // 팔이 목표에 다 못 닿아도 배트는 손을 떠나지 않는다 (held-bat의 원칙)
  body.worldToLocal(palmPoint(bones.hand, palm));
  placeHeldBat(palm, direction, bat.position, bat.quaternion);
}
