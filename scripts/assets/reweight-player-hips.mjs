#!/usr/bin/env node
/**
 * 바지 허리띠를 골반에 고정하고 허벅지 위쪽에서 원래 다리 가중치로 부드럽게 넘긴다.
 * Tripo 원본은 허리 위쪽도 허벅지에 묶어 Sit에서 허리띠가 접히고 셔츠 밑이 벌어졌다.
 *
 * gltf-transform copy <player.glb> <decoded.glb>
 * node scripts/assets/reweight-player-hips.mjs <decoded.glb> <output.glb>
 * gltf-transform meshopt <output.glb> <player.glb> --level medium
 *
 * 정점·텍스처·애니메이션은 보존하고 JOINTS_0/WEIGHTS_0 바이트만 바꾼다.
 * 같은 규칙은 원본 내보내기(create-tripo-player.py)에도 있다. 이미 보정한 파일에 재적용하지 않는다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error("usage: reweight-player-hips.mjs <decoded.glb> <output.glb>");
const bytes = readFileSync(input);
if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error("입력은 GLB여야 한다");
const jsonLength = bytes.readUInt32LE(12);
const asset = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
if (asset.extensionsUsed?.includes("EXT_meshopt_compression"))
  throw new Error("먼저 gltf-transform copy로 Meshopt를 푼다");
const binary = bytes.subarray(28 + jsonLength);

// Node에서는 이미지 로딩만 생략한다. 실제 스킨의 rest 위치를 월드 높이로 읽는다.
const model = structuredClone(asset);
model.images = [];
model.textures = [];
model.materials = [{}];
for (const mesh of model.meshes) {
  for (const primitive of mesh.primitives) primitive.material = 0;
}
const raw = Buffer.from(JSON.stringify(model));
const json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 0x20);
raw.copy(json);
const header = Buffer.from(bytes.subarray(0, 20));
header.writeUInt32LE(28 + json.length + binary.length, 8);
header.writeUInt32LE(json.length, 12);
const stripped = Buffer.concat([header, json, bytes.subarray(20 + jsonLength)]);
const gltf = await new GLTFLoader().parseAsync(
  stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.length),
  "",
);
gltf.scene.updateMatrixWorld(true);

function offset(accessor, index) {
  const view = asset.bufferViews[accessor.bufferView];
  return (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + index * (view.byteStride ?? 4);
}

let changed = 0;
const point = new Vector3();
gltf.scene.traverse((mesh) => {
  if (!mesh.isSkinnedMesh) return;
  const association = gltf.parser.associations.get(mesh);
  if (association?.meshes === undefined || association.primitives === undefined) return;
  const primitive = asset.meshes[association.meshes].primitives[association.primitives];
  if (asset.materials[primitive.material]?.name !== "tripo_part_1_material") return;
  const joints = asset.accessors[primitive.attributes.JOINTS_0];
  const weights = asset.accessors[primitive.attributes.WEIGHTS_0];
  if (
    joints.componentType !== 5121 ||
    joints.normalized ||
    weights.componentType !== 5121 ||
    !weights.normalized
  )
    throw new Error("예상과 다른 스킨 형식: u8 joints / normalized u8 weights 필요");
  const hip = mesh.skeleton.bones.findIndex((bone) => bone.name === "hips");
  if (hip < 0) throw new Error("골반 뼈가 없다");
  for (let index = 0; index < joints.count; index++) {
    mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld);
    // 방 단위: 골반 관절 y≈0.499. 허리띠(.53 이상)는 골반, .42 아래는 기존 다리.
    const t = Math.max(0, Math.min(1, (point.y - 0.42) / 0.11));
    const blend = t * t * (3 - 2 * t);
    if (blend === 0) continue;
    const jointAt = offset(joints, index);
    const weightAt = offset(weights, index);
    const influence = new Map();
    for (let slot = 0; slot < 4; slot++) {
      const joint = binary.readUInt8(jointAt + slot);
      const weight = binary.readUInt8(weightAt + slot) * (1 - blend);
      influence.set(joint, (influence.get(joint) ?? 0) + weight);
    }
    influence.set(hip, (influence.get(hip) ?? 0) + blend * 255);
    const top = [...influence]
      .filter(([, weight]) => weight > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const sum = top.reduce((total, [, weight]) => total + weight, 0);
    const rounded = top.map(([joint, weight]) => [joint, Math.round((weight / sum) * 255)]);
    rounded[0][1] += 255 - rounded.reduce((total, [, weight]) => total + weight, 0);
    for (let slot = 0; slot < 4; slot++) {
      const [joint, weight] = rounded[slot] ?? [0, 0];
      binary.writeUInt8(weight ? joint : 0, jointAt + slot);
      binary.writeUInt8(weight, weightAt + slot);
    }
    changed++;
  }
});
if (!changed) throw new Error("보정할 바지 정점이 없다");
writeFileSync(output, bytes);
console.log(`바지 ${changed}개 정점의 허리·골반 가중치 보정 → ${output}`);
