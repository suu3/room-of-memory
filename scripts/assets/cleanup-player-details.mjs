#!/usr/bin/env node
/**
 * 디코딩한 출하 모델의 머리·귀 색 번짐과 작은 표면 잡음을 정리한다.
 * node scripts/assets/cleanup-player-details.mjs <decoded.glb> <clean.glb>
 * 텍스처 이미지는 보존하고 귀의 오염된 면과 머리 표면에 정점 색을 굽는다.
 * 눈·눈썹·입의 텍스처, 리그, 모프, 의복의 닫힌 표면은 유지한다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { BufferGeometry, Float32BufferAttribute, Matrix4, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error("usage: cleanup-player-details.mjs <decoded.glb> <clean.glb>");
const bytes = readFileSync(input),
  jsonLength = bytes.readUInt32LE(12);
const asset = JSON.parse(bytes.subarray(20, 20 + jsonLength));
if (asset.extensionsUsed?.includes("EXT_meshopt_compression"))
  throw new Error("먼저 Meshopt를 푼다");
if (asset.asset.extras?.detailCleanup) throw new Error("이미 세부 보수를 적용한 모델이다");
const binary = bytes.subarray(28 + jsonLength);
function pack(json, bin) {
  const raw = Buffer.from(JSON.stringify(json)),
    padded = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32);
  raw.copy(padded);
  const header = Buffer.from(bytes.subarray(0, 20)),
    binHeader = Buffer.alloc(8);
  header.writeUInt32LE(28 + padded.length + bin.length, 8);
  header.writeUInt32LE(padded.length, 12);
  binHeader.writeUInt32LE(bin.length);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, padded, binHeader, bin]);
}
const stripped = structuredClone(asset);
stripped.images = [];
stripped.textures = [];
for (const m of stripped.materials) {
  delete m.pbrMetallicRoughness;
  delete m.normalTexture;
  delete m.occlusionTexture;
  delete m.emissiveTexture;
}
const packed = pack(stripped, binary);
const gltf = await new GLTFLoader().parseAsync(
  packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.length),
  "",
);
gltf.scene.updateMatrixWorld(true);
const meshes = [];
gltf.scene.traverse((m) => {
  if (m.isSkinnedMesh) meshes.push(m);
});
const face = meshes.find((m) => m.material.name === "tripo_part_2_material");
if (!face) throw new Error("원본 얼굴 표면이 없다");
const world = (m) =>
  Array.from({ length: m.geometry.attributes.position.count }, (_, i) =>
    m.getVertexPosition(i, new Vector3()).applyMatrix4(m.matrixWorld),
  );
const facePoints = world(face);
const earRegion = (p) =>
  Math.abs(p.x) > 0.23 &&
  Math.abs(p.x) < 0.305 &&
  ((p.y - 1.105) / 0.05) ** 2 + ((p.z + 0.052) / 0.046) ** 2 < 1 &&
  p.z < 0.006;
const earPoints = facePoints.filter(earRegion);
if (earPoints.length < 20) throw new Error("귀 표면을 찾지 못했다");
const nearEar = (p) => earRegion(p) && earPoints.some((q) => p.distanceToSquared(q) < 0.014 ** 2);
const chunks = [binary];
let size = binary.length;
function append(array, type, componentType) {
  const pad = (4 - (size % 4)) % 4;
  chunks.push(Buffer.alloc(pad));
  size += pad;
  const data = Buffer.from(array.buffer, array.byteOffset, array.byteLength),
    view = asset.bufferViews.length;
  asset.bufferViews.push({ buffer: 0, byteOffset: size, byteLength: data.length });
  chunks.push(data);
  size += data.length;
  const i = asset.accessors.length;
  asset.accessors.push({
    bufferView: view,
    componentType,
    type,
    count: array.length / { SCALAR: 1, VEC3: 3 }[type],
  });
  return i;
}
async function texture(mesh) {
  const a = gltf.parser.associations.get(mesh),
    p = asset.meshes[a.meshes].primitives[a.primitives];
  const tex =
    asset.textures[asset.materials[p.material].pbrMetallicRoughness.baseColorTexture.index];
  const image = asset.images[tex.extensions?.EXT_texture_webp?.source ?? tex.source],
    v = asset.bufferViews[image.bufferView];
  const { data, info } = await sharp(
    binary.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength),
  )
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return (uv) => {
    const x = Math.max(0, Math.min(info.width - 1, Math.round(uv[0] * (info.width - 1)))),
      y = Math.max(0, Math.min(info.height - 1, Math.round(uv[1] * (info.height - 1))));
    return [0, 1, 2].map((k) => {
      const c = data[(y * info.width + x) * info.channels + k] / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  };
}
const brightness = (c) => (c[0] + c[1] + c[2]) / 3;
const median = (samples) =>
  [0, 1, 2].map(
    (k) => samples.map((c) => c[k]).sort((a, b) => a - b)[Math.floor(samples.length / 2)],
  );
const faceSample = await texture(face),
  faceUV = face.geometry.attributes.uv;
const sourceSkin = facePoints
  .map((p, i) => ({ p, c: faceSample([faceUV.getX(i), faceUV.getY(i)]) }))
  .filter(({ p, c }) => earRegion(p) && brightness(c) > 0.25 && c[0] > c[2]);
if (sourceSkin.length < 10) throw new Error("피부 원색 표본이 부족하다");
const cleanedMaterials = new Map();
function cleanMaterial(name) {
  if (cleanedMaterials.has(name)) return cleanedMaterials.get(name);
  const index = asset.materials.length;
  asset.materials.push({
    name,
    pbrMetallicRoughness: {
      baseColorFactor: [1, 1, 1, 1],
      metallicFactor: 0,
      roughnessFactor: 0.95,
    },
    doubleSided: false,
  });
  cleanedMaterials.set(name, index);
  return index;
}
for (const mesh of meshes) {
  const name = mesh.material.name;
  if (!/^tripo_part_[023456]_material$/.test(name)) continue;
  const hair = name === "tripo_part_0_material",
    facial = name === "tripo_part_2_material";
  const assoc = gltf.parser.associations.get(mesh),
    primitives = asset.meshes[assoc.meshes].primitives,
    primitive = primitives[assoc.primitives];
  const attrs = mesh.geometry.attributes,
    points = world(mesh),
    index = Array.from(mesh.geometry.index.array);
  const keys = new Map(),
    groups = [],
    ids = [];
  points.forEach((p, i) => {
    const key = p
      .toArray()
      .map((v) => Math.round(v * 100000))
      .join(",");
    if (!keys.has(key)) {
      keys.set(key, groups.length);
      groups.push([]);
    }
    const g = keys.get(key);
    groups[g].push(i);
    ids.push(g);
  });
  const positions = groups.map((g) => points[g[0]].clone()),
    adjacent = groups.map(() => new Set()),
    edges = new Map();
  for (let i = 0; i < index.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const a = ids[index[i + k]],
        b = ids[index[i + ((k + 1) % 3)]];
      if (a === b) continue;
      adjacent[a].add(b);
      adjacent[b].add(a);
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  const boundary = new Set(
    [...edges].filter(([, n]) => n === 1).flatMap(([k]) => k.split(",").map(Number)),
  );
  // Only relax scan-scale bumps; garment joins and facial features stay in place.
  if (hair || facial) {
    const original = positions.map((p) => p.clone()),
      normals = groups.map(() => new Vector3());
    for (let i = 0; i < index.length; i += 3) {
      const [a, b, c] = index.slice(i, i + 3).map((v) => ids[v]);
      const n = new Vector3()
        .subVectors(positions[b], positions[a])
        .cross(new Vector3().subVectors(positions[c], positions[a]));
      for (const g of [a, b, c]) normals[g].add(n);
    }
    for (const n of normals) n.normalize();
    for (let step = 0; step < 5; step++) {
      const next = positions.map((p, g) => {
        if (boundary.has(g) || !adjacent[g].size) return p.clone();
        if (facial && !earRegion(p) && !(p.y < 1.085 && p.z > 0.025 && Math.abs(p.x) > 0.085))
          return p.clone();
        const mean = new Vector3();
        for (const n of adjacent[g]) mean.add(positions[n]);
        mean.divideScalar(adjacent[g].size);
        const moved = p.clone().addScaledVector(normals[g], mean.sub(p).dot(normals[g]) * 0.3),
          delta = moved.sub(original[g]);
        const limit = hair ? 0.0012 : earRegion(p) ? 0.0015 : 0.0008;
        if (delta.length() > limit) delta.setLength(limit);
        return original[g].clone().add(delta);
      });
      positions.forEach((p, g) => {
        p.copy(next[g]);
      });
    }
  }
  if (hair) {
    for (const group of groups) {
      const p = points[group[0]];
      if (!nearEar(p)) continue;
      let nearest = sourceSkin[0].p;
      for (const { p: q } of sourceSkin)
        if (p.distanceToSquared(q) < p.distanceToSquared(nearest)) nearest = q;
      const tucked = nearest.clone();
      tucked.x = Math.sign(p.x) * (Math.abs(nearest.x) - 0.006);
      positions[ids[group[0]]].copy(tucked);
    }
  }
  const local = points.map((_, i) => {
    const skinMatrix = new Matrix4();
    skinMatrix.elements.fill(0);
    for (let slot = 0; slot < 4; slot++) {
      const bone = attrs.skinIndex.getComponent(i, slot),
        weight = attrs.skinWeight.getComponent(i, slot);
      const transform = new Matrix4().multiplyMatrices(
        mesh.skeleton.bones[bone].matrixWorld,
        mesh.skeleton.boneInverses[bone],
      );
      for (let k = 0; k < 16; k++) skinMatrix.elements[k] += transform.elements[k] * weight;
    }
    const transform = mesh.matrixWorld
      .clone()
      .multiply(mesh.bindMatrixInverse)
      .multiply(skinMatrix)
      .multiply(mesh.bindMatrix);
    return positions[ids[i]].clone().applyMatrix4(transform.invert()).toArray();
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(local.flat(), 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  // Weld lighting across UV seams while retaining sharp strand/fold creases.
  const normals = geometry.attributes.normal;
  for (const group of groups) {
    const old = group.map((i) => new Vector3().fromBufferAttribute(normals, i));
    for (let k = 0; k < group.length; k++) {
      const sum = new Vector3();
      old.forEach((n) => {
        if (n.dot(old[k]) > 0.65) sum.add(n);
      });
      sum.normalize();
      normals.setXYZ(group[k], sum.x, sum.y, sum.z);
    }
  }
  primitive.attributes.POSITION = append(new Float32Array(local.flat()), "VEC3", 5126);
  const positionAccessor = asset.accessors[primitive.attributes.POSITION];
  positionAccessor.min = [0, 1, 2].map((k) => Math.min(...local.map((p) => p[k])));
  positionAccessor.max = [0, 1, 2].map((k) => Math.max(...local.map((p) => p[k])));
  primitive.attributes.NORMAL = append(normals.array, "VEC3", 5126);
  if (hair || facial) {
    const sample = hair ? await texture(mesh) : faceSample,
      uv = attrs.uv;
    let colors = points.map((_, i) => sample([uv.getX(i), uv.getY(i)]));
    const ear = [],
      original = [];
    for (let i = 0; i < index.length; i += 3) {
      const tri = index.slice(i, i + 3);
      if (
        facial &&
        tri.some((v) => earRegion(points[v])) &&
        tri.every((v) => {
          const p = points[v];
          return Math.abs(p.x) > 0.225 && p.y > 1.05 && p.y < 1.17 && p.z < 0.01;
        })
      )
        ear.push(...tri);
      else original.push(...tri);
    }
    if (hair) {
      const valid = colors.filter((c) => brightness(c) < 0.1);
      if (!valid.length) throw new Error("Missing dark hair color samples");
      const base = median(valid),
        bad = colors.map((c) => brightness(c) > 0.11 || Math.max(...c) > 0.18);
      const grouped = groups.map((g) =>
        g.map((i) => colors[i]).reduce((s, c) => s.map((v, k) => v + c[k] / g.length), [0, 0, 0]),
      );
      const invalid = groups.map((g) => g.some((i) => bad[i]));
      {
        const next = grouped.map((c, g) => {
          if (!invalid[g]) return c;
          const neighbors = [...adjacent[g]].filter((n) => !invalid[n]);
          return neighbors.length
            ? [0, 1, 2].map(
                (k) => neighbors.reduce((s, n) => s + grouped[n][k], 0) / neighbors.length,
              )
            : base;
        });
        next.forEach((c, g) => {
          grouped[g] = c;
        });
      }
      colors = points.map((_, i) => (bad[i] ? grouped[ids[i]] : colors[i]));
      // Bright skin/UV-island bleed cannot remain on a dark hair surface.
      colors = colors.map((c) => (brightness(c) > 0.1 ? base : c));
      primitive.attributes.COLOR_0 = append(new Float32Array(colors.flat()), "VEC3", 5126);
      delete asset.materials[primitive.material].pbrMetallicRoughness.baseColorTexture;
      asset.materials[primitive.material].pbrMetallicRoughness.roughnessFactor = 0.9;
      console.log(
        `hair: ${bad.filter(Boolean).length} bright vertices cleaned, ear overlap recessed`,
      );
    }
    primitive.indices = append(new Uint32Array(original), "SCALAR", 5125);
    if (!original.length) throw new Error("Original feature surface disappeared");
    function patch(indices, name, color) {
      if (!indices.length) return;
      const next = {
        ...structuredClone(primitive),
        material: cleanMaterial(name),
        indices: append(new Uint32Array(indices), "SCALAR", 5125),
      };
      const layer = points.map((_, i) => color(i));
      next.attributes.COLOR_0 = append(new Float32Array(layer.flat()), "VEC3", 5126);
      primitives.push(next);
    }
    patch(ear, "tripo_part_2_material_EarClean", (i) => {
      if (brightness(colors[i]) > 0.25 && colors[i][0] > colors[i][2]) return colors[i];
      let nearest = sourceSkin[0];
      for (const candidate of sourceSkin)
        if (points[i].distanceToSquared(candidate.p) < points[i].distanceToSquared(nearest.p))
          nearest = candidate;
      return nearest.c;
    });

    if (facial)
      console.log(`skin: ${ear.length / 3} ear, ${original.length / 3} feature triangles retained`);
  }
  geometry.dispose();
}
asset.asset.extras = { ...asset.asset.extras, detailCleanup: true };
const combined = Buffer.concat(chunks);
asset.buffers[0].byteLength = combined.length;
writeFileSync(output, pack(asset, combined));
