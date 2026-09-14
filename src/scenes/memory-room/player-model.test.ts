// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AnimationMixer, Box3, type SkinnedMesh, Vector3 } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { createPlayerRig, disposePlayerRig, updatePlayerRig } from "./player-animation";
import {
  PLAYER_TARGET_HEIGHT,
  SIT_CONTACT_Y,
  SIT_CONTACT_Z,
  SIT_LEG_Z,
  SIT_TORSO_HALF_WIDTH,
} from "./player-rig";

const bytes = readFileSync(resolve("public/assets/models/player-blocky.glb"));
const jsonLength = bytes.readUInt32LE(12);
const asset = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());

describe("shipped player GLB", () => {
  it("ships the decimated Tripo chibi mesh with lightweight eyelids", () => {
    // 원본은 190만 삼각형. scripts/create-tripo-player.py가 부위별 예산으로 3.7만 안팎까지 줄인다.
    const triangles = asset.meshes.reduce(
      (total: number, mesh: { primitives: { indices: number }[] }) =>
        total +
        mesh.primitives.reduce(
          (sum, primitive) => sum + asset.accessors[primitive.indices].count / 3,
          0,
        ),
      0,
    );
    expect(triangles).toBeGreaterThan(30_000);
    expect(triangles).toBeLessThan(45_000);
  });
  it("embeds the skin image and required clips without external texture paths", () => {
    expect(bytes.length).toBeLessThan(5 * 1024 * 1024);
    expect(asset.extensionsRequired).toContain("EXT_meshopt_compression");
    expect(asset.animations.map((clip: { name: string }) => clip.name).sort()).toEqual([
      "Idle",
      "Sit",
      "SitDown",
      "StandUp",
      "Walk",
    ]);
    /*
     * 이미지는 이름이 아니라 **모양**으로 확인한다. 블렌더에서 다시 내보낼 때마다 이미지
     * 이름이 바뀌는데(CH1.FACE → CH1 …), 정작 지켜야 하는 건 "밖으로 나간 경로 없이
     * 파일 안에 webp로 들어 있는가"다. 외부 경로가 하나라도 남으면 그 텍스처는 배포에서
     * 404가 되고 모델이 흰 판으로 뜬다.
     */
    expect(asset.images.length).toBeGreaterThan(0);
    for (const image of asset.images as {
      name: string;
      uri?: string;
      bufferView?: number;
      mimeType?: string;
    }[]) {
      expect(image.uri, image.name).toBeUndefined();
      expect(image.bufferView, image.name).toBeTypeOf("number");
      expect(image.mimeType, image.name).toBe("image/webp");
    }
    // 색을 입은 면이 실제로 그 이미지를 가리키는가 (webp는 확장으로 붙는다)
    const baseColor = (
      asset.materials as { pbrMetallicRoughness?: { baseColorTexture?: { index: number } } }[]
    )
      .map((entry) => entry.pbrMetallicRoughness?.baseColorTexture?.index)
      .filter((index): index is number => index !== undefined);
    expect(baseColor.length).toBeGreaterThan(0);
    for (const index of baseColor) {
      const texture = asset.textures[index];
      const source = texture.extensions?.EXT_texture_webp?.source ?? texture.source;
      expect(asset.images[source], `texture ${index}`).toBeDefined();
    }
    expect(asset.nodes.some((node: { name: string }) => node.name === "head")).toBe(true);
    expect(asset.nodes.some((node: { name: string }) => node.name === "shin.L")).toBe(true);
    const targets = asset.meshes.flatMap(
      (mesh: { extras?: { targetNames?: string[] } }) => mesh.extras?.targetNames ?? [],
    );
    expect(targets).toContain("eyeBlinkLeft");
    expect(targets).toContain("eyeBlinkRight");
    for (const side of ["Left", "Right"]) {
      const highlight = asset.nodes.find(
        (node: { name: string }) => node.name === `EyeHighlight${side}`,
      );
      expect(highlight, `eye highlight ${side}`).toBeDefined();
      expect(asset.meshes[highlight.mesh].extras.targetNames).toContain(`eyeBlink${side}`);
    }
    for (const name of ["eye.L", "eye.R"]) {
      expect(
        asset.nodes.some((node: { name: string }) => node.name === name),
        name,
      ).toBe(true);
    }
  });

  /*
   * 실제 GLB(880KB)를 Meshopt로 풀고 스킨·애니메이션까지 돈다. 로컬에서 2.5초, CI 러너에서는
   * 기본 5초를 넘긴다 (CI #141이 이것 하나로 빨갔다). 느린 테스트가 맞으니 시간을 넉넉히 준다.
   */
  it("decodes the real compressed skin, stays at room scale, and animates both knees", {
    timeout: 30_000,
  }, async () => {
    // Node has no image decoder. Only skip texture loading; use the actual mesh,
    // inverse bind matrices, compressed buffers and animation data unchanged.
    const model = structuredClone(asset);
    model.images = [];
    model.textures = [];
    model.materials = [{}];
    for (const mesh of model.meshes) {
      for (const primitive of mesh.primitives) primitive.material = 0;
    }
    const rawJson = Buffer.from(JSON.stringify(model));
    const json = Buffer.alloc(Math.ceil(rawJson.length / 4) * 4, 0x20);
    rawJson.copy(json);
    const binary = bytes.subarray(20 + jsonLength);
    const header = Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(20 + json.length + binary.length, 8);
    header.writeUInt32LE(json.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    const buffer = Buffer.concat([header, json, binary]);
    await MeshoptDecoder.ready;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.parseAsync(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length),
      "",
    );
    const blinkRig = createPlayerRig(gltf.scene, gltf.animations);
    blinkRig.blink.next = 2.8;
    updatePlayerRig(blinkRig, 0, 0, 2.89);
    for (const part of ["EyelidLeft", "EyelidRight", "EyeHighlightLeft", "EyeHighlightRight"]) {
      const animated = blinkRig.root.getObjectByName(part) as SkinnedMesh;
      const cached = gltf.scene.getObjectByName(part) as SkinnedMesh;
      expect(animated.morphTargetInfluences?.[0], part).toBeGreaterThan(0.95);
      expect(animated.castShadow, `${part} must not cast a border on the face`).toBe(false);
      expect(cached.morphTargetInfluences?.[0], `${part} cached source`).toBe(0);
    }
    updatePlayerRig(blinkRig, 0, 0, 0.2);
    expect(blinkRig.blink.eyelids.every(({ influences, index }) => influences[index] === 0)).toBe(
      true,
    );
    disposePlayerRig(blinkRig);
    // The replacement carries the user's baked base-color image, verified above.
    // The previous model's vertex-color palette is no longer the source of color.
    const mixer = new AnimationMixer(gltf.scene);
    const idleClip = gltf.animations.find((clip) => clip.name === "Idle");
    const walkClip = gltf.animations.find((clip) => clip.name === "Walk");
    if (!idleClip || !walkClip) throw new Error("Missing locomotion clips");
    const idle = mixer.clipAction(idleClip);
    idle.play();
    mixer.setTime(0);
    gltf.scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(gltf.scene, true);
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(PLAYER_TARGET_HEIGHT, 2);
    expect(bounds.min.y).toBeCloseTo(0, 2);
    idle.stop();
    const walk = mixer.clipAction(walkClip);
    walk.play();
    const knees = ["shinL", "shinR"].map((name) => {
      const bone = gltf.scene.getObjectByName(name);
      if (!bone) throw new Error(`Missing knee: ${name}`);
      return bone;
    });
    // GLTFLoader sanitizes dots in node names for PropertyBinding.
    expect(knees.every(Boolean)).toBe(true);
    mixer.setTime(0);
    const start = knees.map((bone) => bone.quaternion.clone());
    mixer.setTime(walk.getClip().duration * 0.25);
    expect(knees.every((bone, index) => bone.quaternion.angleTo(start[index]) > 0.01)).toBe(true);
    for (const clip of gltf.animations) {
      mixer.stopAllAction();
      mixer.clipAction(clip).play();
      mixer.setTime(clip.duration * 0.5);
      gltf.scene.updateMatrixWorld(true);
      const poseBounds = new Box3().setFromObject(gltf.scene, true);
      expect(poseBounds.min.y, clip.name).toBeGreaterThan(-0.03);
      if (clip.name === "Sit") expect(poseBounds.max.y).toBeLessThan(1.45);
      const point = new Vector3();
      gltf.scene.traverse((object) => {
        const mesh = object as SkinnedMesh;
        if (!mesh.isSkinnedMesh) return;
        for (let index = 0; index < mesh.geometry.attributes.position.count; index++) {
          mesh.getVertexPosition(index, point);
          expect(Number.isFinite(point.lengthSq())).toBe(true);
          expect(point.length()).toBeLessThan(3);
        }
      });
    }

    /*
     * 앉는 자리(seats.ts)는 전부 이 포즈의 실측값에서 나온다. 좌면 높이도, 앞뒤 위치도.
     * 리그를 다시 내보내면서 앉은 자세가 바뀌면 방 안의 의자 여덟 개가 한꺼번에 어긋나므로,
     * 코드가 들고 있는 수치를 실제 GLB에 대고 확인한다.
     */
    mixer.stopAllAction();
    const sitClip = gltf.animations.find((clip) => clip.name === "Sit");
    if (!sitClip) throw new Error("Missing Sit clip");
    mixer.clipAction(sitClip).play();
    mixer.setTime(sitClip.duration * 0.5);
    gltf.scene.updateMatrixWorld(true);
    const sit = { contactY: Infinity, contactBack: Infinity, legBack: Infinity, torso: 0 };
    const vertex = new Vector3();
    // 좌면에 닿는 부분(엉덩이·허벅지)과 늘어지는 부분(무릎 아래)은 높이로 못 가른다.
    // 정강이가 허벅지 높이까지 올라온다. 각 정점이 가장 많이 매달린 본으로 가른다.
    const CONTACT_BONES = new Set(["hips", "thighL", "thighR"]);
    const LEG_BONES = new Set(["shinL", "shinR", "footL", "footR", "toeL", "toeR"]);
    gltf.scene.traverse((object) => {
      const mesh = object as SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const { skinIndex, skinWeight, position } = mesh.geometry.attributes;
      for (let index = 0; index < position.count; index++) {
        mesh.getVertexPosition(index, vertex);
        vertex.applyMatrix4(mesh.matrixWorld);
        let bone = 0;
        let weight = -1;
        for (let slot = 0; slot < 4; slot++) {
          if (skinWeight.getComponent(index, slot) <= weight) continue;
          weight = skinWeight.getComponent(index, slot);
          bone = skinIndex.getComponent(index, slot);
        }
        const name = mesh.skeleton.bones[bone]?.name ?? "";
        if (CONTACT_BONES.has(name)) {
          sit.contactY = Math.min(sit.contactY, vertex.y);
          sit.contactBack = Math.min(sit.contactBack, vertex.z);
        } else if (LEG_BONES.has(name)) {
          sit.legBack = Math.min(sit.legBack, vertex.z);
        }
        if (vertex.y < 0.7) sit.torso = Math.max(sit.torso, Math.abs(vertex.x));
      }
    });
    expect(sit.contactY).toBeCloseTo(SIT_CONTACT_Y, 2);
    expect(sit.contactBack).toBeCloseTo(SIT_CONTACT_Z.back, 2);
    expect(sit.legBack).toBeCloseTo(SIT_LEG_Z.back, 2);
    expect(sit.torso).toBeLessThanOrEqual(SIT_TORSO_HALF_WIDTH);
  });
});
