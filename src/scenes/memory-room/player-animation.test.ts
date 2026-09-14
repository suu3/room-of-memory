import {
  AnimationClip,
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  MeshStandardMaterial,
  NumberKeyframeTrack,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
} from "three";
import { describe, expect, it, vi } from "vitest";
import {
  createPlayerRig,
  disposePlayerRig,
  startPlayerRig,
  updatePlayerRig,
} from "./player-animation";

function fixture() {
  const scene = new Group();
  const bone = new Bone();
  bone.name = "hips";
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0], 3));
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute([0, 0, 0, 0], 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute([1, 0, 0, 0], 4));
  const material = new MeshStandardMaterial();
  const mesh = new SkinnedMesh(geometry, material);
  mesh.name = "character";
  scene.add(bone, mesh);
  for (const name of ["eyeL", "eyeR"]) {
    const eye = new Bone();
    eye.name = name;
    bone.add(eye);
  }
  mesh.bind(new Skeleton([bone]));
  const clips = [
    new AnimationClip("Idle", 1, [new NumberKeyframeTrack("hips.position[y]", [0, 1], [1, 1])]),
    new AnimationClip("Walk", 1, [
      new NumberKeyframeTrack("hips.position[y]", [0, 0.5, 1], [1, 2, 1]),
    ]),
    new AnimationClip("Sit", 1, [new NumberKeyframeTrack("hips.position[y]", [0, 1], [0.5, 0.5])]),
  ];
  return { scene, bone, mesh, material, geometry, clips };
}

describe("skinned player animation", () => {
  it("blinks textured-face morphs independently per clone without squashing brow bones", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const source = fixture();
      source.geometry.morphAttributes.position = [
        new Float32BufferAttribute([0, 0.1, 0], 3),
        new Float32BufferAttribute([0, -0.1, 0], 3),
      ];
      source.mesh.updateMorphTargets();
      source.mesh.morphTargetDictionary = { eyeBlinkLeft: 0, eyeBlinkRight: 1 };
      const rig = createPlayerRig(source.scene, source.clips);
      const other = createPlayerRig(source.scene, source.clips);
      const face = rig.root.getObjectByName("character") as SkinnedMesh;
      updatePlayerRig(rig, 0, 0, 2.89);
      expect(face.morphTargetInfluences?.[0]).toBeGreaterThan(0.95);
      expect(face.morphTargetInfluences?.[1]).toBeGreaterThan(0.95);
      expect(rig.root.getObjectByName("eyeL")?.scale.y).toBe(1);
      expect(source.mesh.morphTargetInfluences).toEqual([0, 0]);
      expect((other.root.getObjectByName("character") as SkinnedMesh).morphTargetInfluences).toEqual([0, 0]);
      updatePlayerRig(rig, 0, 0, 0.2, 1);
      expect(face.morphTargetInfluences).toEqual([0, 0]);
      disposePlayerRig(rig);
      disposePlayerRig(other);
    } finally {
      random.mockRestore();
    }
  });
  it("blends the authored curtain action with locomotion and restarts after cleanup", () => {
    const source = fixture();
    const curtain = new AnimationClip("CurtainPull", 3, [
      new NumberKeyframeTrack("hips.position[y]", [0, 3], [2, 2]),
    ]);
    const rig = createPlayerRig(source.scene, source.clips, { right: curtain, left: curtain });
    updatePlayerRig(rig, 0, 0, 0, 0, 0, { side: "right", time: 1, weight: 0.5 });
    expect(rig.root.getObjectByName("hips")?.position.y).toBeCloseTo(1.5);
    updatePlayerRig(rig, 0, 0, 0);
    expect(rig.root.getObjectByName("hips")?.position.y).toBeCloseTo(1);
    disposePlayerRig(rig);
    startPlayerRig(rig);
    updatePlayerRig(rig, 0, 0, 0, 0, 0, { side: "left", time: 1, weight: 1 });
    expect(rig.root.getObjectByName("hips")?.position.y).toBeCloseTo(2);
  });
  it("clones and animates its own bones while preserving the supplied materials", () => {
    const source = fixture();
    const rig = createPlayerRig(source.scene, source.clips);
    const mesh = rig.root.getObjectByName("character") as SkinnedMesh;
    expect(mesh.skeleton).not.toBe(source.mesh.skeleton);
    expect(mesh.skeleton.bones[0]).toBe(rig.root.getObjectByName("hips"));
    expect(mesh.material).toBe(source.material);
    updatePlayerRig(rig, Math.PI, 1, 0.1);
    expect(mesh.skeleton.bones[0].position.y).toBeCloseTo(2);
    expect(source.bone.position.y).toBe(0);
  });

  it("blends a stopped walk back to idle and supports a seated pose", () => {
    const source = fixture();
    const rig = createPlayerRig(source.scene, source.clips);
    const hips = rig.root.getObjectByName("hips");
    updatePlayerRig(rig, Math.PI, 0.25, 0);
    expect(hips?.position.y).toBeCloseTo(1.25);
    updatePlayerRig(rig, Math.PI, 0, 0);
    expect(hips?.position.y).toBeCloseTo(1);
    updatePlayerRig(rig, Math.PI, 1, 0, 1);
    expect(hips?.position.y).toBeCloseTo(0.5);
    expect(rig.walk.getEffectiveWeight()).toBe(0);
  });

  it("resumes after React Strict Mode cleanup without disposing cached materials", () => {
    const source = fixture();
    const materialDispose = vi.spyOn(source.material, "dispose");
    const geometryDispose = vi.spyOn(source.geometry, "dispose");
    const rig = createPlayerRig(source.scene, source.clips);
    disposePlayerRig(rig);
    startPlayerRig(rig);
    updatePlayerRig(rig, Math.PI, 1, 0.1);
    expect(rig.root.getObjectByName("hips")?.position.y).toBeCloseTo(2);
    expect(materialDispose).not.toHaveBeenCalled();
    expect(geometryDispose).not.toHaveBeenCalled();
  });

  it("rejects a replacement that lacks a required animation", () => {
    const source = fixture();
    expect(() => createPlayerRig(source.scene, source.clips.slice(0, 1))).toThrow("Walk");
  });

  it("briefly closes both eyes, reopens them, and keeps blinking while walking or seated", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const source = fixture();
      const rig = createPlayerRig(source.scene, source.clips);
      const left = rig.root.getObjectByName("eyeL");
      const right = rig.root.getObjectByName("eyeR");
      for (let frame = 0; frame < 280; frame++) updatePlayerRig(rig, 0, 0, 0.01);
      expect(left?.scale.y).toBeCloseTo(1);
      for (let frame = 0; frame < 9; frame++) updatePlayerRig(rig, 1, 1, 0.01);
      expect(left?.scale.y).toBeLessThan(0.15);
      expect(right?.scale.y).toBeCloseTo(left?.scale.y ?? 0);
      expect(source.scene.getObjectByName("eyeL")?.scale.y).toBe(1);
      for (let frame = 0; frame < 20; frame++) updatePlayerRig(rig, 0, 0, 0.01, 1);
      expect(left?.scale.y).toBeCloseTo(1);
      let lowest = 1;
      for (let frame = 0; frame < 310; frame++) {
        updatePlayerRig(rig, 0, 0, 0.01, 1);
        lowest = Math.min(lowest, left?.scale.y ?? 1);
      }
      expect(lowest).toBeLessThan(0.15);
    } finally {
      random.mockRestore();
    }
  });
});
