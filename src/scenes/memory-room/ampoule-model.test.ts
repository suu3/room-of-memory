// @vitest-environment node
import { readFileSync } from "node:fs";
import { Box3, type Mesh, Vector3 } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { ASSETS } from "@/lib/assets";

const expectedUrl = "/assets/models/room-laon-ampoule.glb?v=2";

function modelBytes() {
  return readFileSync(`public${expectedUrl.split("?")[0]}`);
}

function modelHeader(bytes: Buffer) {
  const jsonLength = bytes.readUInt32LE(12);
  return {
    jsonLength,
    json: JSON.parse(bytes.subarray(20, 20 + jsonLength).toString()),
  };
}

async function loadWithoutImages() {
  const bytes = modelBytes();
  const { jsonLength, json: header } = modelHeader(bytes);
  const model = structuredClone(header);
  const primitives = model.meshes.flatMap(
    (mesh: { primitives: { material: number }[] }) => mesh.primitives,
  );
  model.images = [];
  model.textures = [];
  model.materials = [{}];
  for (const primitive of primitives) primitive.material = 0;

  const rawJson = Buffer.from(JSON.stringify(model));
  const json = Buffer.alloc(Math.ceil(rawJson.length / 4) * 4, 32);
  rawJson.copy(json);
  const binary = bytes.subarray(20 + jsonLength);
  const glbHeader = Buffer.from(bytes.subarray(0, 20));
  glbHeader.writeUInt32LE(20 + json.length + binary.length, 8);
  glbHeader.writeUInt32LE(json.length, 12);
  const buffer = Buffer.concat([glbHeader, json, binary]);

  await MeshoptDecoder.ready;
  return new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length), "");
}

describe("shipped Laon ampoule model", () => {
  it("registers one cache-versioned GLB for every ampoule view", () => {
    expect(ASSETS.models.ampoule).toBe(expectedUrl);
  });

  it("is a compact self-contained GLB with an embedded Laon label", () => {
    const bytes = modelBytes();
    const { json: header } = modelHeader(bytes);
    expect(bytes.length).toBeLessThan(200 * 1024);
    expect(header.extensionsRequired).toContain("EXT_meshopt_compression");
    expect(header.extensionsRequired).toContain("EXT_texture_webp");
    expect(header.images).toHaveLength(1);
    expect(header.images[0].uri).toBeUndefined();
    expect(header.images[0].bufferView).toBeTypeOf("number");

    const labelMaterial = header.materials.find(
      (material: { name?: string }) => material.name === "laon-label",
    );
    expect(labelMaterial?.pbrMetallicRoughness?.baseColorTexture?.index).toBeTypeOf("number");
  });

  it("has a vial silhouette, separate contents, and a bottom-aligned origin", async () => {
    const { scene } = await loadWithoutImages();
    scene.updateMatrixWorld(true);
    for (const name of ["vial-glass", "vial-liquid", "vial-neck", "vial-cap", "vial-label"]) {
      const part = scene.getObjectByName(name) as Mesh | undefined;
      expect(part?.isMesh, `missing ${name}`).toBe(true);
    }

    const bounds = new Box3().setFromObject(scene);
    const size = bounds.getSize(new Vector3());
    expect(bounds.min.y).toBeCloseTo(0, 3);
    expect(size.y).toBeGreaterThanOrEqual(0.18);
    expect(size.y).toBeLessThanOrEqual(0.21);
    expect(size.x).toBeGreaterThanOrEqual(0.065);
    expect(size.x).toBeLessThanOrEqual(0.08);
    expect(size.y / size.x).toBeGreaterThan(2.4);
    expect(size.y / size.x).toBeLessThan(3.1);
  });

  it("maps the front label from screen-left to screen-right without mirroring the logo", async () => {
    const { scene } = await loadWithoutImages();
    const label = scene.getObjectByName("vial-label") as Mesh;
    const position = label.geometry.getAttribute("position");
    const uv = label.geometry.getAttribute("uv");
    const front = Array.from({ length: position.count }, (_, index) => ({
      x: position.getX(index),
      z: position.getZ(index),
      u: uv.getX(index),
    })).filter((vertex) => vertex.z > 0.02);
    const left = front.reduce((found, vertex) => (vertex.x < found.x ? vertex : found));
    const right = front.reduce((found, vertex) => (vertex.x > found.x ? vertex : found));
    expect(right.u).toBeGreaterThan(left.u);
  });

  it("maps the label image upright (glTF v=0 is the image top)", async () => {
    const { scene } = await loadWithoutImages();
    const label = scene.getObjectByName("vial-label") as Mesh;
    const position = label.geometry.getAttribute("position");
    const uv = label.geometry.getAttribute("uv");
    const vertices = Array.from({ length: position.count }, (_, index) => ({
      y: position.getY(index),
      v: uv.getY(index),
    }));
    const top = vertices.reduce((found, vertex) => (vertex.y > found.y ? vertex : found));
    const bottom = vertices.reduce((found, vertex) => (vertex.y < found.y ? vertex : found));
    expect(top.v).toBeLessThan(bottom.v);
  });
});
