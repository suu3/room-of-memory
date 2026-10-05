#!/usr/bin/env node
/**
 * 닫힌 의복 표면을 고른 면으로 재구성하고 원본 스킨 가중치와 색을 옮긴다.
 * repair-player-clothing 적용 후 Meshopt를 푼 GLB를 입력한다.
 * node scripts/assets/round-player-clothing.mjs <decoded.glb> <rounded.glb>
 * BLENDER_BIN으로 Blender 실행 경로를 지정할 수 있다.
 * 얼굴·본·애니메이션·소매의 원본 바이트는 보존한다.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BufferGeometry, Float32BufferAttribute, Matrix4, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error("usage: round-player-clothing.mjs <decoded.glb> <rounded.glb>");
const bytes = readFileSync(input),
  jsonLength = bytes.readUInt32LE(12);
const asset = JSON.parse(bytes.subarray(20, 20 + jsonLength));
if (asset.extensionsUsed?.includes("EXT_meshopt_compression"))
  throw new Error("먼저 gltf-transform copy로 Meshopt를 푼다");
if (asset.asset.extras?.roundedClothing)
  throw new Error("이미 곡면을 재구성한 모델에는 다시 적용하지 않는다");
const stripped = structuredClone(asset);
stripped.images = [];
stripped.textures = [];
for (const material of stripped.materials) {
  delete material.pbrMetallicRoughness;
  delete material.normalTexture;
  delete material.occlusionTexture;
  delete material.emissiveTexture;
}
function pack(json, binary) {
  const raw = Buffer.from(JSON.stringify(json)),
    padded = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32);
  raw.copy(padded);
  const head = Buffer.from(bytes.subarray(0, 20));
  head.writeUInt32LE(28 + padded.length + binary.length, 8);
  head.writeUInt32LE(padded.length, 12);
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(binary.length);
  binHead.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, padded, binHead, binary]);
}
const binary = bytes.subarray(28 + jsonLength),
  buffer = pack(stripped, binary);
const gltf = await new GLTFLoader().parseAsync(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length),
  "",
);
gltf.scene.updateMatrixWorld(true);
const meshes = [];
gltf.scene.traverse((mesh) => {
  if (mesh.isSkinnedMesh && /^tripo_part_[13]_material$/.test(mesh.material.name))
    meshes.push(mesh);
});
if (meshes.length !== 2) throw new Error("바지와 니트 두 표면이 필요하다");
const sources = meshes.map((mesh) => {
  const attrs = mesh.geometry.attributes;
  if (!attrs.color) throw new Error("먼저 repair-player-clothing으로 의복 색을 굽는다");
  return {
    name: mesh.material.name,
    positions: Array.from({ length: attrs.position.count }, (_, i) =>
      mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld).toArray(),
    ),
    indices: Array.from(mesh.geometry.index.array),
    colors: Array.from({ length: attrs.position.count }, (_, i) => [
      attrs.color.getX(i),
      attrs.color.getY(i),
      attrs.color.getZ(i),
    ]),
    joints: Array.from({ length: attrs.position.count }, (_, i) =>
      [0, 1, 2, 3].map((k) => attrs.skinIndex.getComponent(i, k)),
    ),
    weights: Array.from({ length: attrs.position.count }, (_, i) =>
      [0, 1, 2, 3].map((k) => attrs.skinWeight.getComponent(i, k)),
    ),
  };
});
const temp = mkdtempSync(join(tmpdir(), "round-player-"));
let results;
try {
  const sourcePath = join(temp, "source.json"),
    resultPath = join(temp, "result.json");
  writeFileSync(sourcePath, JSON.stringify(sources));
  execFileSync(
    process.env.BLENDER_BIN ??
      (process.platform === "darwin"
        ? "/Applications/Blender.app/Contents/MacOS/Blender"
        : "blender"),
    [
      "-b",
      "-t",
      "2",
      "--python",
      fileURLToPath(new URL("./round-player-clothing.py", import.meta.url)),
      "--",
      sourcePath,
      resultPath,
    ],
    { stdio: "inherit" },
  );
  results = JSON.parse(readFileSync(resultPath));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
const chunks = [binary];
let size = binary.length;
function append(array, type, componentType) {
  const padding = (4 - (size % 4)) % 4;
  if (padding) {
    chunks.push(Buffer.alloc(padding));
    size += padding;
  }
  const data = Buffer.from(array.buffer, array.byteOffset, array.byteLength),
    view = asset.bufferViews.length;
  asset.bufferViews.push({ buffer: 0, byteOffset: size, byteLength: data.length });
  chunks.push(data);
  size += data.length;
  const accessor = asset.accessors.length;
  asset.accessors.push({
    bufferView: view,
    componentType,
    type,
    count: array.length / { SCALAR: 1, VEC3: 3, VEC4: 4 }[type],
  });
  return accessor;
}
for (const mesh of meshes) {
  const result = results.find((item) => item.name === mesh.material.name);
  if (!result?.indices.length) throw new Error(`빈 의복 표면: ${mesh.material.name}`);
  // 새 허리띠 정점의 높이로 골반 고정을 보강해 보간된 다리 가중치를 제거한다.
  if (result.name === "tripo_part_1_material") {
    const hip = mesh.skeleton.bones.findIndex((bone) => bone.name === "hips");
    if (hip < 0) throw new Error("골반 본이 없다");
    result.positions.forEach((point, i) => {
      const t = Math.max(0, Math.min(1, (point[1] - 0.51) / 0.025));
      const blend = t * t * (3 - 2 * t);
      if (!blend) return;
      const weights = new Map([[hip, blend]]);
      result.joints[i].forEach((bone, slot) => {
        weights.set(bone, (weights.get(bone) ?? 0) + result.weights[i][slot] * (1 - blend));
      });
      const top = [...weights].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const total = top.reduce((sum, [, w]) => sum + w, 0);
      result.joints[i] = Array.from({ length: 4 }, (_, k) => top[k]?.[0] ?? 0);
      result.weights[i] = Array.from({ length: 4 }, (_, k) => (top[k]?.[1] ?? 0) / total);
    });
  }
  const association = gltf.parser.associations.get(mesh);
  const primitive = asset.meshes[association.meshes].primitives[association.primitives];
  const local = result.positions.map((point, i) => {
    const skin = new Matrix4();
    skin.elements.fill(0);
    for (let slot = 0; slot < 4; slot++) {
      const bone = result.joints[i][slot],
        weight = result.weights[i][slot];
      const matrix = new Matrix4().multiplyMatrices(
        mesh.skeleton.bones[bone].matrixWorld,
        mesh.skeleton.boneInverses[bone],
      );
      for (let k = 0; k < 16; k++) skin.elements[k] += matrix.elements[k] * weight;
    }
    const transform = mesh.matrixWorld
      .clone()
      .multiply(mesh.bindMatrixInverse)
      .multiply(skin)
      .multiply(mesh.bindMatrix);
    return new Vector3(...point).applyMatrix4(transform.invert()).toArray();
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(local.flat(), 3));
  geometry.setIndex(result.indices);
  geometry.computeVertexNormals();
  // 색상 경계에서 나눈 정점도 같은 법선을 써서 밑단에 조명 이음새가 생기지 않는다.
  const normalGroups = new Map();
  result.positions.forEach((point, i) => {
    const key = point.map((value) => Math.round(value * 100000)).join(",");
    if (!normalGroups.has(key)) normalGroups.set(key, []);
    normalGroups.get(key).push(i);
  });
  for (const group of normalGroups.values()) {
    if (group.length < 2) continue;
    const normal = new Vector3();
    for (const i of group)
      normal.add(new Vector3().fromBufferAttribute(geometry.attributes.normal, i));
    normal.normalize();
    for (const i of group) geometry.attributes.normal.setXYZ(i, normal.x, normal.y, normal.z);
  }
  const neighbors = result.positions.map(() => new Set());
  for (let i = 0; i < result.indices.length; i += 3) {
    const face = result.indices.slice(i, i + 3);
    for (let side = 0; side < 3; side++) {
      neighbors[face[side]].add(face[(side + 1) % 3]);
      neighbors[face[(side + 1) % 3]].add(face[side]);
    }
  }
  let colors = result.colors;
  // 니트의 보수 경계에 구워진 음영을 부드럽게 잇되 아래의 흰 셔츠는 보존한다.
  for (let step = 0; step < 15; step++)
    colors = colors.map((color, i) => {
      if (result.positions[i][1] < 0.6 || !result.name.includes("part_3_") || !neighbors[i].size)
        return color;
      return color.map(
        (value, k) =>
          value * 0.4 +
          ([...neighbors[i]].reduce((sum, n) => sum + colors[n][k], 0) / neighbors[i].size) * 0.6,
      );
    });
  primitive.attributes = {
    POSITION: append(new Float32Array(local.flat()), "VEC3", 5126),
    NORMAL: append(geometry.attributes.normal.array, "VEC3", 5126),
    COLOR_0: append(new Float32Array(colors.flat()), "VEC3", 5126),
    JOINTS_0: append(new Uint16Array(result.joints.flat()), "VEC4", 5123),
    WEIGHTS_0: append(new Float32Array(result.weights.flat()), "VEC4", 5126),
  };
  asset.accessors[primitive.attributes.POSITION].min = [0, 1, 2].map((k) =>
    Math.min(...local.map((p) => p[k])),
  );
  asset.accessors[primitive.attributes.POSITION].max = [0, 1, 2].map((k) =>
    Math.max(...local.map((p) => p[k])),
  );
  primitive.indices = append(new Uint32Array(result.indices), "SCALAR", 5125);
  asset.materials[primitive.material].doubleSided = false;
  geometry.dispose();
}
const triangleCount = asset.meshes.reduce(
  (sum, mesh) =>
    sum +
    mesh.primitives.reduce((n, primitive) => n + asset.accessors[primitive.indices].count / 3, 0),
  0,
);
if (triangleCount >= 60000) throw new Error(`삼각형 예산 초과: ${triangleCount}`);
asset.asset.extras = { ...asset.asset.extras, roundedClothing: true };
const combined = Buffer.concat(chunks);
asset.buffers[0].byteLength = combined.length;
writeFileSync(output, pack(asset, combined));
