// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AnimationMixer, Box3, type SkinnedMesh, Vector3 } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { PLAYER_TARGET_HEIGHT } from "./player-rig";

const bytes = readFileSync(resolve("public/assets/models/player-blocky.glb"));
const jsonLength = bytes.readUInt32LE(12);
const asset = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());

describe("shipped player GLB", () => {
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
    const skin = asset.images.find((image: { name: string }) => image.name === "CH1.FACE");
    expect(skin.bufferView).toBeTypeOf("number");
    expect(skin.uri).toBeUndefined();
    expect(skin.mimeType).toBe("image/webp");
    const material = asset.materials.find((entry: { name: string }) => entry.name === "Material");
    const texture = asset.textures[material.pbrMetallicRoughness.baseColorTexture.index];
    expect(asset.images[texture.extensions.EXT_texture_webp.source]).toBe(skin);
    expect(asset.nodes.some((node: { name: string }) => node.name === "head")).toBe(true);
    expect(asset.nodes.some((node: { name: string }) => node.name === "shin.L")).toBe(true);
  });

  it("decodes the real compressed skin, stays at room scale, and animates both knees", async () => {
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
  });
});
