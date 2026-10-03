#!/usr/bin/env node
/**
 * 플레이어 소매의 어깨 쪽 스킨 가중치를 몸통 → 어깨뼈 → 위팔 순으로 넘긴다.
 *
 *   node scripts/assets/reweight-player-sleeves.mjs <플레이어.glb> <출력.glb>
 *
 * 소매는 위팔·아래팔 뼈만 따랐다 (create-tripo-player.py). 그러면 팔을 앞으로 들 때 소매가
 * 어깨 관절에서 통째로 꺾여 조끼 안으로 들어가고, 가만히 있는 조끼 진동 둘레가 소매를 뚫고
 * 나온다 (AR 타격 자세에서 어깨에 회색 톱니가 섰다). 어깨에 가까운 소매일수록 몸통을 따르게
 * 하면 소매 뿌리는 진동에 남고, 팔은 거기서 휘어 나와 조끼 위를 덮는다.
 *
 * 몸통과 위팔을 바로 섞으면 팔이 쪼그라든다. 그래서 사이에 어깨뼈를 둔다: 게임이 어깨뼈를
 * 위팔 회전의 절반만 돌린다 (src/scenes/memory-room/player/sleeve-root.ts). 어깨뼈가 그렇게
 * 돌면 거기 묶인 옷깃이 같이 끌려가므로, 옷깃의 어깨뼈 몫은 몸통으로 옮긴다.
 *
 * 입력은 Meshopt가 풀린 것이어야 한다 (`gltf-transform copy`). 출력도 압축이 없으니
 * `gltf-transform meshopt --level medium`을 다시 씌운다. 가중치 바이트만 제자리에서 고친다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Matrix4, Vector3 } from "three";

/** 소매 재질 → 어느 쪽 팔인가. */
const SLEEVES = { tripo_part_4_material: "L", tripo_part_5_material: "R" };
const COLLAR = "tripo_part_6_material";
/**
 * 위팔 길이 대비 자리. ROOT까지는 온전히 몸통, HALF에서 온전히 어깨뼈, ARM부터 온전히 위팔.
 * 사이는 smoothstep.
 */
const ROOT = 0;
const HALF = 0.35;
const ARM = 0.9;

const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) {
  console.error("usage: reweight-player-sleeves.mjs <player.glb> <out.glb>");
  process.exit(1);
}

const bytes = readFileSync(inFile);
if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error(`glb가 아니다: ${inFile}`);
const jsonLength = bytes.readUInt32LE(12);
const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
if (json.extensionsUsed?.includes("EXT_meshopt_compression")) {
  throw new Error("Meshopt가 걸려 있다. 먼저 `gltf-transform copy`로 푼다");
}
const bin = bytes.subarray(20 + jsonLength + 8);

const BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5126: 4 };
const COUNTS = { VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** 접근자의 i번째 원소가 시작하는 바이트 (인터리브된 뷰의 stride를 따른다). */
function elementOffset(accessor, index) {
  const view = json.bufferViews[accessor.bufferView];
  const size = BYTES[accessor.componentType] * COUNTS[accessor.type];
  const stride = view.byteStride ?? size;
  return (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + index * stride;
}

function expect(accessor, componentType, normalized, label) {
  if (accessor.componentType !== componentType || Boolean(accessor.normalized) !== normalized) {
    throw new Error(`${label}의 형식이 예상과 다르다 (모델을 다시 구웠다면 이 스크립트도 맞춘다)`);
  }
}

/** 뼈의 rest 자리 (메쉬가 묶인 공간). 역바인드 행렬을 뒤집어 얻는다. */
function restPosition(skin, name) {
  const joint = skin.joints.findIndex((node) => json.nodes[node].name === name);
  if (joint < 0) throw new Error(`스킨에 ${name} 뼈가 없다`);
  const accessor = json.accessors[skin.inverseBindMatrices];
  const offset = elementOffset(accessor, joint);
  const elements = Array.from({ length: 16 }, (_, i) => bin.readFloatLE(offset + i * 4));
  return {
    joint,
    position: new Vector3().setFromMatrixPosition(new Matrix4().fromArray(elements).invert()),
  };
}

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

/** 정점 하나의 뼈 → 가중치(0~255) 표. */
function readInfluence(jointAt, weightAt) {
  const influence = new Map();
  for (let slot = 0; slot < 4; slot += 1) {
    const weight = bin.readUInt8(weightAt + slot);
    if (weight === 0) continue;
    const joint = bin.readUInt8(jointAt + slot);
    influence.set(joint, (influence.get(joint) ?? 0) + weight);
  }
  return influence;
}

function writeInfluence(influence, jointAt, weightAt) {
  const top = [...influence]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const total = top.reduce((sum, [, weight]) => sum + weight, 0);
  const rounded = top.map(([joint, weight]) => [joint, Math.round((weight / total) * 255)]);
  // 정규화된 u8은 합이 정확히 255여야 한다: 반올림 오차는 가장 큰 몫이 진다
  rounded[0][1] += 255 - rounded.reduce((sum, [, weight]) => sum + weight, 0);
  for (let slot = 0; slot < 4; slot += 1) {
    const [joint, weight] = rounded[slot] ?? [0, 0];
    bin.writeUInt8(weight === 0 ? 0 : joint, jointAt + slot);
    bin.writeUInt8(weight, weightAt + slot);
  }
}

function move(influence, from, to, share = 1) {
  const weight = (influence.get(from) ?? 0) * share;
  if (weight === 0) return;
  influence.set(from, influence.get(from) - weight);
  influence.set(to, (influence.get(to) ?? 0) + weight);
}

const point = new Vector3();
for (const node of json.nodes) {
  if (node.mesh === undefined || node.skin === undefined) continue;
  const skin = json.skins[node.skin];
  for (const primitive of json.meshes[node.mesh].primitives) {
    const material = json.materials[primitive.material]?.name;
    const side = SLEEVES[material];
    if (!side && material !== COLLAR) continue;

    const positions = json.accessors[primitive.attributes.POSITION];
    const joints = json.accessors[primitive.attributes.JOINTS_0];
    const weights = json.accessors[primitive.attributes.WEIGHTS_0];
    expect(positions, 5122, true, "POSITION");
    expect(joints, 5121, false, "JOINTS_0");
    expect(weights, 5121, true, "WEIGHTS_0");
    const chest = restPosition(skin, "chest").joint;

    if (material === COLLAR) {
      const shoulders = ["L", "R"].map((each) => restPosition(skin, `shoulder.${each}`).joint);
      let changed = 0;
      for (let index = 0; index < positions.count; index += 1) {
        const jointAt = elementOffset(joints, index);
        const weightAt = elementOffset(weights, index);
        const influence = readInfluence(jointAt, weightAt);
        if (!shoulders.some((shoulder) => influence.has(shoulder))) continue;
        for (const shoulder of shoulders) move(influence, shoulder, chest);
        writeInfluence(influence, jointAt, weightAt);
        changed += 1;
      }
      console.log(`옷깃: ${positions.count}개 중 ${changed}개 정점의 어깨뼈 몫을 몸통으로 옮겼다`);
      continue;
    }

    const shoulder = restPosition(skin, `shoulder.${side}`).joint;
    const upper = restPosition(skin, `upper_arm.${side}`);
    const elbow = restPosition(skin, `forearm.${side}`).position;
    const along = elbow.clone().sub(upper.position);
    const length = along.length();
    along.normalize();

    let changed = 0;
    for (let index = 0; index < positions.count; index += 1) {
      const at = elementOffset(positions, index);
      point.set(bin.readInt16LE(at), bin.readInt16LE(at + 2), bin.readInt16LE(at + 4));
      point.divideScalar(32767).sub(upper.position);
      const down = point.dot(along) / length;
      if (down >= ARM) continue;

      const jointAt = elementOffset(joints, index);
      const weightAt = elementOffset(weights, index);
      const influence = readInfluence(jointAt, weightAt);
      if (!influence.has(upper.joint)) continue;
      if (down < HALF) {
        // 위팔 몫을 전부 어깨뼈로, 그중 뿌리 쪽은 다시 몸통으로
        move(influence, upper.joint, shoulder);
        move(influence, shoulder, chest, 1 - smoothstep((down - ROOT) / (HALF - ROOT)));
      } else {
        move(influence, upper.joint, shoulder, 1 - smoothstep((down - HALF) / (ARM - HALF)));
      }
      writeInfluence(influence, jointAt, weightAt);
      changed += 1;
    }
    console.log(`소매 ${side}: ${positions.count}개 중 ${changed}개 정점을 몸통·어깨뼈와 섞었다`);
  }
}

writeFileSync(outFile, bytes);
console.log(`→ ${outFile} (압축 전. gltf-transform meshopt --level medium 을 씌운다)`);
