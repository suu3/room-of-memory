#!/usr/bin/env node
/**
 * 커튼 동작 클립(curtain-pull-*.glb)을 새 플레이어 리그의 rest 포즈로 옮긴다.
 *
 *   node scripts/assets/retarget-curtain-clips.mjs <새-플레이어.glb> <옛-커튼.glb> <출력.glb>
 *
 * 커튼 클립은 본만 있는 GLB라 Blender가 아마추어로 읽지 않는다. 대신 여기서 GLB를 직접
 * 고친다. 두 리그는 본 이름·계층이 같고 rest 방향(roll·관절 위치)만 다르므로, 각 본의
 * 포즈를 "rest 기준 회전(아마추어 공간)"으로 풀어 새 rest에 다시 감는다. 게임 쪽
 * `turn()`(scripts/assets/create-tripo-player.py)과 같은 셈이다. 노드의 rest TRS도 새 리그 것으로
 * 바꿔서, 클립 GLB만 따로 읽어도 새 골격이 나온다.
 *
 * 입력 커튼 GLB는 Meshopt가 풀린 것이어야 한다 (`gltf-transform copy`). 출력도 압축이 없으니
 * `gltf-transform meshopt`를 다시 씌운다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Quaternion, Vector3 } from "three";

const [playerFile, clipFile, outFile] = process.argv.slice(2);
if (!playerFile || !clipFile || !outFile) {
  console.error("usage: retarget-curtain-clips.mjs <new-player.glb> <old-clip.glb> <out.glb>");
  process.exit(1);
}

function readGlb(file) {
  const bytes = readFileSync(file);
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error(`glb가 아니다: ${file}`);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binOffset = 20 + jsonLength;
  const binLength = bytes.readUInt32LE(binOffset);
  // 새 ArrayBuffer로 복사해 Float32Array를 얹을 수 있게 4바이트 정렬을 보장한다.
  const bin = new Uint8Array(binLength);
  bin.set(bytes.subarray(binOffset + 8, binOffset + 8 + binLength));
  return { json, bin };
}

function writeGlb(file, json, bin) {
  const rawJson = Buffer.from(JSON.stringify(json));
  const jsonChunk = Buffer.alloc(Math.ceil(rawJson.length / 4) * 4, 0x20);
  rawJson.copy(jsonChunk);
  const binChunk = Buffer.alloc(Math.ceil(bin.length / 4) * 4, 0);
  Buffer.from(bin.buffer, bin.byteOffset, bin.length).copy(binChunk);
  const header = Buffer.alloc(12 + 8);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(header.length + jsonChunk.length + 8 + binChunk.length, 8);
  header.writeUInt32LE(jsonChunk.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  writeFileSync(file, Buffer.concat([header, jsonChunk, binHeader, binChunk]));
}

function floats(glb, accessorIndex) {
  const accessor = glb.json.accessors[accessorIndex];
  const view = glb.json.bufferViews[accessor.bufferView];
  if (view.byteStride) throw new Error("stride가 있는 애니메이션 접근자는 다루지 않는다");
  const components = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type];
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return new Float32Array(glb.bin.buffer, glb.bin.byteOffset + offset, accessor.count * components);
}

/** 노드 이름 → { index, parent, rest(TRS), armatureRotation(루트부터 곱한 rest 회전) }. */
function skeleton(glb) {
  const nodes = glb.json.nodes;
  const parent = new Map();
  nodes.forEach((node, index) => {
    for (const child of node.children ?? []) parent.set(child, index);
  });
  const byName = new Map();
  const armatureRotation = new Map();
  function rotationOf(index) {
    if (armatureRotation.has(index)) return armatureRotation.get(index);
    const node = nodes[index];
    const local = new Quaternion(...(node.rotation ?? [0, 0, 0, 1]));
    const up = parent.has(index) ? rotationOf(parent.get(index)).clone() : new Quaternion();
    const result = up.multiply(local);
    armatureRotation.set(index, result);
    return result;
  }
  nodes.forEach((node, index) => {
    if (!node.name) return;
    byName.set(node.name, {
      index,
      translation: new Vector3(...(node.translation ?? [0, 0, 0])),
      rotation: new Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
      scale: node.scale ?? [1, 1, 1],
      armature: rotationOf(index),
    });
  });
  return byName;
}

const player = readGlb(playerFile);
const clip = readGlb(clipFile);
const newBones = skeleton(player);
const oldBones = skeleton(clip);

const q = new Quaternion();
const inverse = new Quaternion();
const v = new Vector3();
let retargeted = 0;
for (const animation of clip.json.animations ?? []) {
  for (const channel of animation.channels) {
    const name = clip.json.nodes[channel.target.node].name;
    const from = oldBones.get(name);
    const to = newBones.get(name);
    if (!from || !to) throw new Error(`새 리그에 없는 본: ${name}`);
    const output = floats(clip, animation.samplers[channel.sampler].output);
    const accessor = clip.json.accessors[animation.samplers[channel.sampler].output];
    if (channel.target.path === "rotation") {
      for (let key = 0; key < output.length; key += 4) {
        q.set(output[key], output[key + 1], output[key + 2], output[key + 3]);
        // basis(옛 로컬) → delta(아마추어 공간) → basis(새 로컬) → 새 로컬 회전
        const basis = inverse.copy(from.rotation).invert().multiply(q);
        const delta = from.armature
          .clone()
          .multiply(basis)
          .multiply(from.armature.clone().invert());
        const basisNew = to.armature.clone().invert().multiply(delta).multiply(to.armature);
        const result = to.rotation.clone().multiply(basisNew).normalize();
        output[key] = result.x;
        output[key + 1] = result.y;
        output[key + 2] = result.z;
        output[key + 3] = result.w;
      }
    } else if (channel.target.path === "translation") {
      for (let key = 0; key < output.length; key += 3) {
        v.set(output[key], output[key + 1], output[key + 2]).sub(from.translation);
        v.applyQuaternion(inverse.copy(from.rotation).invert());
        v.applyQuaternion(from.armature);
        v.applyQuaternion(inverse.copy(to.armature).invert());
        v.applyQuaternion(to.rotation).add(to.translation);
        output[key] = v.x;
        output[key + 1] = v.y;
        output[key + 2] = v.z;
      }
    }
    // scale은 그대로 (전부 1이다)
    const components = output.length / accessor.count;
    accessor.min = Array.from({ length: components }, (_, c) => {
      let value = Number.POSITIVE_INFINITY;
      for (let key = c; key < output.length; key += components)
        value = Math.min(value, output[key]);
      return value;
    });
    accessor.max = Array.from({ length: components }, (_, c) => {
      let value = Number.NEGATIVE_INFINITY;
      for (let key = c; key < output.length; key += components)
        value = Math.max(value, output[key]);
      return value;
    });
    retargeted++;
  }
}

// 노드의 rest도 새 리그 것으로. 클립 GLB만 읽어도 새 골격이 서야 한다.
for (const node of clip.json.nodes) {
  const to = newBones.get(node.name);
  if (!to) continue;
  node.translation = to.translation.toArray();
  node.rotation = to.rotation.toArray();
  node.scale = to.scale;
}

writeGlb(outFile, clip.json, clip.bin);
console.log(`▸ ${outFile}: ${retargeted}개 채널을 새 rest로 옮겼다`);
