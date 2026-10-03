import {
  type AnimationClip,
  AnimationMixer,
  type Mesh,
  type Object3D,
  Quaternion,
  type SkinnedMesh,
  Vector3,
} from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { CurtainSide } from "@/types/curtain";
import { findSleeveRoots, releaseSleeveRoots, settleSleeveRoots } from "./sleeve-root";

/*
 * 손을 뻗는 몸짓 (커튼을 젖힐 때).
 *
 * 클립을 하나 더 굽는 대신 믹서가 끝난 뒤 팔뼈를 돌린다. 눈 깜빡임과 같은 방식이다.
 * 걷든 앉든 그 위에 얹히므로 자세마다 클립을 따로 만들 필요가 없다.
 *
 * 축은 **몸의 앞뒤**(리그 루트의 X)다. 월드 X를 그대로 쓰면 캐릭터가 어느 쪽을 보든
 * 팔이 항상 월드 +Z로 뻗어, 창을 등지고 서면 뒤로 젖힌다.
 */
/** 커튼 클립의 두 쪽. 프레임마다 도는 함수 안에서 배열을 새로 만들지 않게 밖에 둔다. */
const CURTAIN_SIDES = ["left", "right"] as const;
const REACH_UPPER_ARM = -1.5;
const REACH_FOREARM = -0.3;
const bodyAxis = new Vector3();
const reachTurn = new Quaternion();
const rootQuaternion = new Quaternion();
const parentQuaternion = new Quaternion();

/** 뼈 하나를 몸 기준 앞뒤 축으로 돌린다 (양수면 뒤로, 음수면 앞으로). */
export function reachBone(root: Object3D, bone: Object3D, angle: number) {
  const parent = bone.parent;
  if (!parent) return;
  root.getWorldQuaternion(rootQuaternion);
  parent.getWorldQuaternion(parentQuaternion);
  bodyAxis.set(1, 0, 0).applyQuaternion(rootQuaternion).applyQuaternion(parentQuaternion.invert());
  reachTurn.setFromAxisAngle(bodyAxis.normalize(), angle);
  bone.quaternion.premultiply(reachTurn);
}

export interface CurtainPose {
  side: CurtainSide;
  time: number;
  weight: number;
}

export function createPlayerRig(
  scene: Object3D,
  clips: AnimationClip[],
  curtainClips?: Record<CurtainSide, AnimationClip>,
) {
  // Object3D.clone leaves skinned meshes bound to the cached source skeleton.
  const root = clone(scene);
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.isMesh) {
      // Thin face overlays otherwise cast a dark rim on the skin during a blink.
      mesh.castShadow = !mesh.name.startsWith("Eyelid") && !mesh.name.startsWith("EyeHighlight");
    }
  });
  // rest 자세를 읽어야 하므로 믹서가 뼈를 움직이기 전에 찾는다
  const sleeves = findSleeveRoots(root);
  const mixer = new AnimationMixer(root);
  function action(name: string) {
    const clip = clips.find((candidate) => candidate.name === name);
    if (!clip) throw new Error(`Player GLB is missing the ${name} animation`);
    return mixer.clipAction(clip).play();
  }
  const idle = action("Idle");
  const walk = action("Walk");
  const sit = action("Sit");
  const curtain = curtainClips
    ? {
        left: mixer.clipAction(curtainClips.left.clone()).play(),
        right: mixer.clipAction(curtainClips.right.clone()).play(),
      }
    : null;
  if (curtain) {
    for (const pull of [curtain.left, curtain.right]) {
      pull.paused = true;
      pull.setEffectiveWeight(0);
    }
  }
  walk.paused = true;
  sit.paused = true;
  walk.setEffectiveWeight(0);
  sit.setEffectiveWeight(0);
  mixer.update(0);
  const eyes = [root.getObjectByName("eyeL"), root.getObjectByName("eyeR")].filter(
    (eye): eye is Object3D => eye !== undefined,
  );
  const eyelids: { influences: number[]; index: number }[] = [];
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
    for (const name of ["eyeBlinkLeft", "eyeBlinkRight"]) {
      const index = mesh.morphTargetDictionary[name];
      if (index !== undefined) eyelids.push({ influences: mesh.morphTargetInfluences, index });
    }
  });
  const blink = { elapsed: 0, next: 2.8 + Math.random() * 3.2, eyes, eyelids };
  const arms = ["upper_armL", "upper_armR", "forearmL", "forearmR"].map((name) =>
    root.getObjectByName(name),
  );
  const reach = {
    upper: arms.slice(0, 2).filter((bone): bone is Object3D => bone !== undefined),
    fore: arms.slice(2).filter((bone): bone is Object3D => bone !== undefined),
  };
  return { root, mixer, idle, walk, sit, blink, reach, curtain, sleeves };
}

export type PlayerRig = ReturnType<typeof createPlayerRig>;

export function startPlayerRig(rig: PlayerRig) {
  // Strict Mode re-runs effect setup after cleanup; reacquire uncached actions.
  rig.idle = rig.mixer.clipAction(rig.idle.getClip()).play();
  rig.walk = rig.mixer.clipAction(rig.walk.getClip()).play();
  rig.sit = rig.mixer.clipAction(rig.sit.getClip()).play();
  rig.walk.paused = true;
  rig.sit.paused = true;
  rig.walk.setEffectiveWeight(0);
  rig.sit.setEffectiveWeight(0);
  if (rig.curtain) {
    for (const side of ["left", "right"] as const) {
      const action = rig.mixer.clipAction(rig.curtain[side].getClip()).play();
      action.paused = true;
      action.setEffectiveWeight(0);
      rig.curtain[side] = action;
    }
  }
}

/** Distance-driven walk phase; weights blend to idle or a chair-aligned sitting pose. */
export function updatePlayerRig(
  rig: PlayerRig,
  phase: number,
  walking: number,
  delta: number,
  sitting = 0,
  /** 손을 뻗은 정도 (0~1). 커튼을 잡고 있는 동안 1로 간다. */
  reaching = 0,
  curtainPose?: CurtainPose,
) {
  releaseSleeveRoots(rig.sleeves);
  const curtainWeight =
    rig.curtain && curtainPose ? Math.max(0, Math.min(1, curtainPose.weight)) : 0;
  if (rig.curtain) {
    for (const side of CURTAIN_SIDES) {
      const action = rig.curtain[side];
      action.setEffectiveWeight(curtainPose?.side === side ? curtainWeight : 0);
      if (curtainPose?.side === side)
        action.time = Math.min(action.getClip().duration - 0.001, Math.max(0, curtainPose.time));
    }
  }
  const sitWeight = Math.max(0, Math.min(1, sitting));
  const walkWeight = Math.max(0, Math.min(1, walking)) * (1 - sitWeight);
  const cycle = phase / (Math.PI * 2);
  rig.walk.time = (((cycle % 1) + 1) % 1) * rig.walk.getClip().duration;
  rig.idle.setEffectiveWeight((1 - sitWeight - walkWeight) * (1 - curtainWeight));
  rig.walk.setEffectiveWeight(walkWeight * (1 - curtainWeight));
  rig.sit.setEffectiveWeight(sitWeight * (1 - curtainWeight));
  rig.mixer.update(delta);
  // Apply after the mixer so locomotion cannot overwrite eye scale.
  const blink = rig.blink;
  blink.elapsed += Math.max(0, delta);
  const time = blink.elapsed - blink.next;
  let closed = 0;
  if (time >= 0 && time < 0.21) {
    const progress = time < 0.07 ? time / 0.07 : time < 0.1 ? 1 : (0.21 - time) / 0.11;
    closed = progress * progress * (3 - 2 * progress);
  } else if (time >= 0.21) {
    blink.elapsed = 0;
    blink.next = 2.8 + Math.random() * 3.2;
  }
  for (const eyelid of blink.eyelids) eyelid.influences[eyelid.index] = closed;
  if (blink.eyelids.length === 0) {
    for (const eye of blink.eyes) eye.scale.set(1 + closed * 0.12, 1 - closed * 0.94, 1);
  }
  // 팔도 믹서 이후다. 걷기·앉기 클립이 덮어쓰지 못하게.
  const reach = Math.max(0, Math.min(1, reaching)) * (1 - curtainWeight);
  if (reach > 0) {
    for (const bone of rig.reach.upper) reachBone(rig.root, bone, REACH_UPPER_ARM * reach);
    for (const bone of rig.reach.fore) reachBone(rig.root, bone, REACH_FOREARM * reach);
  }
  // 이 뒤에 팔 뼈를 더 돌리는 쪽(IK)은 풀고(release) 돌린 뒤 다시 건다 (sleeve-root)
  settleSleeveRoots(rig.sleeves);
}

export function disposePlayerRig(rig: PlayerRig) {
  rig.mixer.stopAllAction();
  rig.mixer.uncacheRoot(rig.root);
  const skeletons = new Set<SkinnedMesh["skeleton"]>();
  rig.root.traverse((object) => {
    const mesh = object as SkinnedMesh;
    if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton);
  });
  for (const skeleton of skeletons) skeleton.dispose();
  // Geometry, materials and textures belong to useGLTF's shared cache.
}
