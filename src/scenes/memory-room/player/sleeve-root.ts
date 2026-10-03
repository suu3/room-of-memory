import { type Object3D, Quaternion, Vector3 } from "three";

/*
 * 소매 뿌리. 어깨뼈(shoulder)를 "위팔이 돈 만큼의 절반만 도는 보조 뼈"로 쓴다.
 *
 * 소매는 어깨에서 몸통 → 어깨뼈 → 위팔 순으로 가중치가 넘어간다
 * (scripts/assets/reweight-player-sleeves.mjs). 몸통과 위팔을 바로 섞으면 팔을 크게 들 때 두
 * 자세의 한가운데로 정점이 모여 팔이 쪼그라든다. 사이에 절반만 돈 뼈를 두면 이웃한 두 뼈의
 * 각도 차가 반으로 줄어 굵기가 남는다.
 *
 * 어깨뼈는 제 머리(목 옆)가 아니라 **위팔 관절을 축으로** 돈다. 그래서 위팔의 자리는 그대로고,
 * 위팔에는 반대 회전을 걸어 팔·손의 월드 자세도 그대로 둔다. 바뀌는 것은 소매 뿌리뿐이다.
 *
 * 믹서는 값이 안 바뀐 프레임에는 뼈를 다시 쓰지 않는다. 그래서 건 것을 다음 프레임에 직접
 * 푼다(release). 팔 뼈를 손으로 돌리는 자리(IK)는 풀고 → 돌리고 → 다시 건다.
 */

/** 위팔 회전 중 어깨뼈가 따라가는 몫. */
const FOLLOW = 0.5;

export interface SleeveRoot {
  shoulder: Object3D;
  upper: Object3D;
  /** 위팔의 rest 회전(어깨뼈 기준)의 역. */
  restInverse: Quaternion;
  applied: boolean;
  heldPosition: Vector3;
  heldQuaternion: Quaternion;
  heldUpper: Quaternion;
}

/** 리그가 rest 자세일 때(복제 직후, 믹서를 돌리기 전) 부른다. 뼈가 없으면 빈 배열. */
export function findSleeveRoots(root: Object3D): SleeveRoot[] {
  const roots: SleeveRoot[] = [];
  for (const side of ["L", "R"]) {
    const shoulder = root.getObjectByName(`shoulder${side}`);
    const upper = root.getObjectByName(`upper_arm${side}`);
    if (!shoulder || !upper || upper.parent !== shoulder) continue;
    roots.push({
      shoulder,
      upper,
      restInverse: upper.quaternion.clone().invert(),
      applied: false,
      heldPosition: new Vector3(),
      heldQuaternion: new Quaternion(),
      heldUpper: new Quaternion(),
    });
  }
  return roots;
}

/** 걸어 둔 보조 회전을 푼다. 안 걸려 있으면 아무 일도 없다. */
export function releaseSleeveRoots(roots: readonly SleeveRoot[]): void {
  for (const sleeve of roots) {
    if (!sleeve.applied) continue;
    sleeve.shoulder.position.copy(sleeve.heldPosition);
    sleeve.shoulder.quaternion.copy(sleeve.heldQuaternion);
    sleeve.upper.quaternion.copy(sleeve.heldUpper);
    sleeve.applied = false;
  }
}

const identity = new Quaternion();
const turned = new Quaternion();
const follow = new Quaternion();
const joint = new Vector3();
const swung = new Vector3();

/** 지금 위팔 자세에 맞춰 어깨뼈를 절반만 돌린다. 팔 뼈를 다 돌린 뒤, 프레임의 마지막에 부른다. */
export function settleSleeveRoots(roots: readonly SleeveRoot[]): void {
  releaseSleeveRoots(roots);
  for (const sleeve of roots) {
    const { shoulder, upper } = sleeve;
    sleeve.heldPosition.copy(shoulder.position);
    sleeve.heldQuaternion.copy(shoulder.quaternion);
    sleeve.heldUpper.copy(upper.quaternion);
    sleeve.applied = true;

    // rest에서 얼마나 돌았나(어깨뼈 좌표) → 그 절반
    turned.copy(upper.quaternion).multiply(sleeve.restInverse);
    follow.copy(identity).slerp(turned, FOLLOW);
    // 위팔 관절을 축으로 돌린다: 관절이 제자리에 남도록 어깨뼈를 민다
    joint.copy(upper.position);
    swung.copy(joint).applyQuaternion(follow);
    shoulder.position.add(joint.sub(swung).applyQuaternion(shoulder.quaternion));
    shoulder.quaternion.multiply(follow);
    upper.quaternion.premultiply(follow.invert());
  }
}
