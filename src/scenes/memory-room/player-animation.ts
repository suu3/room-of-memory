import {
  type AnimationClip,
  AnimationMixer,
  type Mesh,
  type Object3D,
  type SkinnedMesh,
} from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";

export function createPlayerRig(scene: Object3D, clips: AnimationClip[]) {
  // Object3D.clone leaves skinned meshes bound to the cached source skeleton.
  const root = clone(scene);
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.isMesh) mesh.castShadow = true;
  });
  const mixer = new AnimationMixer(root);
  function action(name: string) {
    const clip = clips.find((candidate) => candidate.name === name);
    if (!clip) throw new Error(`Player GLB is missing the ${name} animation`);
    return mixer.clipAction(clip).play();
  }
  const idle = action("Idle");
  const walk = action("Walk");
  const sit = action("Sit");
  walk.paused = true;
  sit.paused = true;
  walk.setEffectiveWeight(0);
  sit.setEffectiveWeight(0);
  mixer.update(0);
  return { root, mixer, idle, walk, sit };
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
}

/** Distance-driven walk phase; weights blend to idle or a chair-aligned sitting pose. */
export function updatePlayerRig(
  rig: PlayerRig,
  phase: number,
  walking: number,
  delta: number,
  sitting = 0,
) {
  const sitWeight = Math.max(0, Math.min(1, sitting));
  const walkWeight = Math.max(0, Math.min(1, walking)) * (1 - sitWeight);
  const cycle = phase / (Math.PI * 2);
  rig.walk.time = (((cycle % 1) + 1) % 1) * rig.walk.getClip().duration;
  rig.idle.setEffectiveWeight(1 - sitWeight - walkWeight);
  rig.walk.setEffectiveWeight(walkWeight);
  rig.sit.setEffectiveWeight(sitWeight);
  rig.mixer.update(delta);
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
