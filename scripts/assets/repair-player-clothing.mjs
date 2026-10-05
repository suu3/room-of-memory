#!/usr/bin/env node
/**
 * 플레이어 의복 표면과 조끼 옆선을 보수한다. 원본 재생성 후에도 이 후처리를 적용한다.
 *
 * gltf-transform copy <player.glb> <decoded.glb>
 * node scripts/assets/repair-player-clothing.mjs <decoded.glb> <repaired.glb>
 * gltf-transform meshopt <repaired.glb> <player.glb> --level medium
 *
 * 입력은 reweight-player-hips 보정이 끝난, 아직 옆선을 보수하지 않은 모델이다.
 * 조끼의 떠 있는 덮개를 제거하고 실제 경계를 공유하는 면으로 닫는다.
 * UV 경계에 묻은 흰색을 제거하기 위해 조끼 색만 정점에 굽는다. 얼굴 텍스처는 보존한다.
 * 바지 위쪽·조끼·소매는 이동량을 3~12mm로 제한해 스무딩하고 각도 가중 법선을 만든다.
 * 바지 무릎 아래, 옷깃·손목·발목 경계, 본·애니메이션·눈꺼풀은 보존한다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { Matrix4, ShapeUtils, Vector2, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error("usage: repair-player-clothing.mjs <decoded.glb> <repaired.glb>");
async function loadSkin(file) {
  const b = readFileSync(file),
    jl = b.readUInt32LE(12),
    j = JSON.parse(b.subarray(20, 20 + jl));
  j.images = [];
  j.textures = [];
  for (const m of j.materials) {
    delete m.pbrMetallicRoughness;
    delete m.normalTexture;
    delete m.occlusionTexture;
    delete m.emissiveTexture;
  }
  const raw = Buffer.from(JSON.stringify(j)),
    json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32);
  raw.copy(json);
  const head = Buffer.from(b.subarray(0, 20));
  head.writeUInt32LE(20 + json.length + b.length - 20 - jl, 8);
  head.writeUInt32LE(json.length, 12);
  const buf = Buffer.concat([head, json, b.subarray(20 + jl)]);
  const gltf = await new GLTFLoader().parseAsync(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length),
    "",
  );
  gltf.scene.updateMatrixWorld(true);

  return gltf;
}
function topology(mesh) {
  const a = mesh.geometry.attributes.position,
    keys = new Map(),
    groups = [],
    ids = [],
    pos = [];
  for (let i = 0; i < a.count; i++) {
    const p = mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld);
    const key = p
      .toArray()
      .map((n) => Math.round(n * 100000))
      .join(",");
    if (!keys.has(key)) {
      keys.set(key, groups.length);
      groups.push([]);
      pos.push(p);
    }
    const id = keys.get(key);
    groups[id].push(i);
    ids.push(id);
  }
  const edges = new Map(),
    adj = groups.map(() => new Set());
  const idx = mesh.geometry.index;
  for (let i = 0; i < idx.count; i += 3) {
    const tri = [0, 1, 2].map((s) => ids[idx.getX(i + s)]);
    for (let s = 0; s < 3; s++) {
      const a = tri[s],
        b = tri[(s + 1) % 3];
      if (a === b) continue;
      adj[a].add(b);
      adj[b].add(a);
      const key = [a, b].sort((x, y) => x - y).join(",");
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  const boundary = [...edges].filter(([, n]) => n === 1).map(([k]) => k.split(",").map(Number));
  return { groups, ids, pos, adj, boundary };
}

const b = readFileSync(input),
  jl = b.readUInt32LE(12),
  j = JSON.parse(b.subarray(20, 20 + jl));
if (b.readUInt32LE(0) !== 0x46546c67) throw new Error("입력은 GLB여야 한다");
if (j.extensionsUsed?.includes("EXT_meshopt_compression"))
  throw new Error("먼저 gltf-transform copy로 Meshopt를 푼다");
const gltf = await loadSkin(input);
const chunks = [b.subarray(28 + jl)];
let size = chunks[0].length;
const vestMaterial = j.materials.find((m) => m.name === "tripo_part_3_material");
if (!vestMaterial?.pbrMetallicRoughness?.baseColorTexture)
  throw new Error("조끼 텍스처가 없다. 이미 보수한 모델에는 다시 적용하지 않는다");
const texture = j.textures[vestMaterial.pbrMetallicRoughness.baseColorTexture.index],
  source = texture.extensions?.EXT_texture_webp?.source ?? texture.source,
  view = j.bufferViews[j.images[source].bufferView];
const { data: pixels, info: pixelInfo } = await sharp(
  chunks[0].subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength),
)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
function colorAt(uv) {
  const x = Math.max(0, Math.min(pixelInfo.width - 1, Math.round(uv[0] * (pixelInfo.width - 1)))),
    y = Math.max(0, Math.min(pixelInfo.height - 1, Math.round(uv[1] * (pixelInfo.height - 1))));
  return [0, 1, 2].map((c) => {
    const v = pixels[(y * pixelInfo.width + x) * pixelInfo.channels + c] / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
}
function append(array, type, componentType) {
  const buf = Buffer.from(array.buffer, array.byteOffset, array.byteLength),
    padding = (4 - (size % 4)) % 4;
  if (padding) {
    chunks.push(Buffer.alloc(padding));
    size += padding;
  }
  const view = j.bufferViews.length;
  j.bufferViews.push({ buffer: 0, byteOffset: size, byteLength: buf.length });
  chunks.push(buf);
  size += buf.length;
  const accessor = j.accessors.length;
  j.accessors.push({
    bufferView: view,
    componentType,
    count: array.length / { VEC2: 2, VEC3: 3, VEC4: 4, SCALAR: 1 }[type],
    type,
  });
  return accessor;
}
gltf.scene.traverse((mesh) => {
  if (!mesh.isSkinnedMesh || !/[1345]_material$/.test(mesh.material.name)) return;
  const a = gltf.parser.associations.get(mesh),
    prim = j.meshes[a.meshes].primitives[a.primitives],
    t = topology(mesh),
    geo = mesh.geometry,
    uv = geo.attributes.uv;
  let indices = Array.from(geo.index.array);
  const clones = [],
    patchUV = {},
    seamIds = new Set();
  if (mesh.material.name.includes("part_3_")) {
    const main = [];
    let removed = 0;
    for (let n = 0; n < indices.length; n += 3) {
      const tri = indices.slice(n, n + 3),
        p = tri.map((i) => t.pos[t.ids[i]]);
      const constant = tri.every(
        (i) =>
          Math.abs(uv.getX(i) - uv.getX(tri[0])) < 1e-7 &&
          Math.abs(uv.getY(i) - uv.getY(tri[0])) < 1e-7,
      );
      if (constant && p.every((v) => Math.abs(v.x) > 0.1 && v.y > 0.56 && v.y < 0.88)) {
        patchUV[Math.sign(p[0].x)] = [uv.getX(tri[0]), uv.getY(tri[0])];
        removed++;
        continue;
      }
      main.push(...tri);
    }
    if (removed === 0 || !patchUV[1] || !patchUV[-1])
      throw new Error("원본의 조끼 양쪽 덮개를 찾지 못했다");
    console.log(`조끼의 분리된 덮개 ${removed}개 삼각형 제거`);
    indices = main;
    const edgeMap = new Map();
    for (let n = 0; n < indices.length; n += 3) {
      const tri = indices.slice(n, n + 3);
      for (let s = 0; s < 3; s++) {
        const i = tri[s],
          k = tri[(s + 1) % 3],
          u = t.ids[i],
          v = t.ids[k];
        if (u === v) continue;
        const key = [u, v].sort((a, b) => a - b).join(",");
        const e = edgeMap.get(key);
        if (e) e.count++;
        else edgeMap.set(key, { u, v, i, k, count: 1 });
      }
    }
    const edges = [...edgeMap.values()].filter((e) => e.count === 1),
      remain = new Set(edges),
      loops = [];
    while (remain.size) {
      const first = remain.values().next().value;
      remain.delete(first);
      const group = [first],
        q = [first];
      while (q.length) {
        const e = q.pop();
        for (const other of remain)
          if ([e.u, e.v].some((v) => v === other.u || v === other.v)) {
            remain.delete(other);
            group.push(other);
            q.push(other);
          }
      }
      loops.push(group);
    }
    for (const es of loops) {
      const ids = [...new Set(es.flatMap((e) => [e.u, e.v]))],
        points = ids.map((id) => t.pos[id]);
      if (
        Math.min(...points.map((p) => Math.abs(p.x))) < 0.1 ||
        Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)) < 0.25
      )
        continue;
      const neighbors = new Map();
      for (const e of es) {
        for (const [u, v] of [
          [e.u, e.v],
          [e.v, e.u],
        ]) {
          if (!neighbors.has(u)) neighbors.set(u, []);
          neighbors.get(u).push(v);
        }
      }
      if ([...neighbors.values()].some((v) => v.length !== 2)) throw Error("branched vest seam");
      const order = [ids[0]];
      let prev = -1,
        cur = ids[0];
      do {
        const next = neighbors.get(cur).find((v) => v !== prev);
        prev = cur;
        cur = next;
        if (cur === order[0]) break;
        order.push(cur);
      } while (order.length <= ids.length);
      const shape = order.map((id) => new Vector2(t.pos[id].z, t.pos[id].y));
      const faces = ShapeUtils.triangulateShape(shape, []),
        sign = Math.sign(points[0].x);
      const capIds = new Map();
      for (const id of order) {
        seamIds.add(id);
        capIds.set(id, t.ids.length);
        clones.push({ source: t.groups[id][0], uv: patchUV[sign] });
        t.ids.push(id);
      }
      for (const f of faces) {
        const v = f.map((n) => order[n]);
        const cross = new Vector3()
          .subVectors(t.pos[v[1]], t.pos[v[0]])
          .cross(new Vector3().subVectors(t.pos[v[2]], t.pos[v[0]]));
        if (cross.x * sign < 0) v.reverse();
        indices.push(...v.map((id) => capIds.get(id)));
      }
      console.log(`옆선 ${ids.length}개 경계를 ${faces.length}개 삼각형으로 연결`);
    }
  }
  // Smooth only clothing interiors, leaving all existing joins and the seat outline bounded.
  const boundary = new Set(t.boundary.flat());
  const positions = t.pos.map((p) => p.clone()),
    original = t.pos;
  for (const id of seamIds) boundary.delete(id);
  for (let n = 0; n < indices.length; n += 3) {
    const tri = indices.slice(n, n + 3).map((i) => t.ids[i]);
    for (let s = 0; s < 3; s++) {
      t.adj[tri[s]].add(tri[(s + 1) % 3]);
      t.adj[tri[(s + 1) % 3]].add(tri[s]);
    }
  }
  const pants = mesh.material.name.includes("part_1_"),
    limit = pants ? 0.012 : 0.003;
  for (let n = 0; n < (pants ? 24 : 8); n++) {
    const next = positions.map((p, id) => {
      if (boundary.has(id) || !t.adj[id].size || (pants && original[id].y < 0.42)) return p.clone();
      const avg = new Vector3();
      for (const other of t.adj[id]) avg.add(positions[other]);
      avg.divideScalar(t.adj[id].size);
      const delta = p.clone().lerp(avg, 0.45).sub(original[id]);
      const cap = seamIds.has(id) ? 0.006 : limit;
      if (delta.length() > cap) delta.setLength(cap);
      return original[id].clone().add(delta);
    });
    positions.splice(0, positions.length, ...next);
  }
  const local = positions.map((p, id) => {
    const index = t.groups[id][0],
      skin = new Matrix4();
    skin.elements.fill(0);
    for (let s = 0; s < 4; s++) {
      const bone = geo.attributes.skinIndex.getComponent(index, s),
        weight = geo.attributes.skinWeight.getComponent(index, s);
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
    return p.clone().applyMatrix4(transform.invert());
  });
  const normals = positions.map(() => new Vector3());
  for (let n = 0; n < indices.length; n += 3) {
    const tri = indices.slice(n, n + 3).map((i) => t.ids[i]);
    const normal = new Vector3()
      .subVectors(local[tri[1]], local[tri[0]])
      .cross(new Vector3().subVectors(local[tri[2]], local[tri[0]]))
      .normalize();
    for (let s = 0; s < 3; s++) {
      const u = new Vector3().subVectors(local[tri[(s + 1) % 3]], local[tri[s]]),
        v = new Vector3().subVectors(local[tri[(s + 2) % 3]], local[tri[s]]);
      if (u.lengthSq() && v.lengthSq()) normals[tri[s]].addScaledVector(normal, u.angleTo(v));
    }
  }
  for (const normal of normals) normal.normalize();
  const p = new Float32Array(t.ids.length * 3),
    norm = new Float32Array(p.length);
  for (let i = 0; i < t.ids.length; i++) {
    local[t.ids[i]].toArray(p, i * 3);
    normals[t.ids[i]].toArray(norm, i * 3);
  }
  if (clones.length)
    for (const [semantic, name] of Object.entries({
      JOINTS_0: "skinIndex",
      WEIGHTS_0: "skinWeight",
      TEXCOORD_0: "uv",
      COLOR_0: "color",
    })) {
      const attr = geo.attributes[name];
      if (!attr) continue;
      const data =
        semantic === "JOINTS_0"
          ? new Uint16Array(t.ids.length * attr.itemSize)
          : new Float32Array(t.ids.length * attr.itemSize);
      for (let i = 0; i < t.ids.length; i++) {
        const clone = clones[i - attr.count];
        for (let c = 0; c < attr.itemSize; c++)
          data[i * attr.itemSize + c] =
            clone && name === "uv" ? clone.uv[c] : attr.getComponent(clone?.source ?? i, c);
      }
      prim.attributes[semantic] = append(
        data,
        `VEC${attr.itemSize}`,
        semantic === "JOINTS_0" ? 5123 : 5126,
      );
    }
  if (seamIds.size) {
    const colors = new Float32Array(t.ids.length * 3);
    for (let i = 0; i < t.ids.length; i++) {
      const clone = clones[i - geo.attributes.position.count],
        p = original[t.ids[i]];
      let c = colorAt(clone?.uv ?? [uv.getX(i), uv.getY(i)]);
      let distance = Infinity;
      for (const id of seamIds) distance = Math.min(distance, p.distanceTo(original[id]));
      const blend = 1 - Math.max(0, Math.min(1, distance / 0.018));
      const target = colorAt(patchUV[Math.sign(p.x)] ?? patchUV[1]);
      if (blend > 0) c = c.map((v, k) => v * (1 - blend) + target[k] * blend);
      colors.set(c, i * 3);
    }
    prim.attributes.COLOR_0 = append(colors, "VEC3", 5126);
    delete j.materials[prim.material].pbrMetallicRoughness.baseColorTexture;
  }
  prim.attributes.POSITION = append(p, "VEC3", 5126);
  j.accessors[prim.attributes.POSITION].min = [0, 1, 2].map((d) =>
    Math.min(...local.map((p) => p.getComponent(d))),
  );
  j.accessors[prim.attributes.POSITION].max = [0, 1, 2].map((d) =>
    Math.max(...local.map((p) => p.getComponent(d))),
  );
  prim.attributes.NORMAL = append(norm, "VEC3", 5126);
  prim.indices = append(new Uint32Array(indices), "SCALAR", 5125);
  console.log(mesh.material.name, indices.length / 3);
});
const bin = Buffer.concat(chunks);
j.buffers[0].byteLength = bin.length;
const raw = Buffer.from(JSON.stringify(j)),
  json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32);
raw.copy(json);
const head = Buffer.from(b.subarray(0, 20));
head.writeUInt32LE(28 + json.length + bin.length, 8);
head.writeUInt32LE(json.length, 12);
const bh = Buffer.alloc(8);
bh.writeUInt32LE(bin.length);
bh.writeUInt32LE(0x004e4942, 4);
writeFileSync(output, Buffer.concat([head, json, bh, bin]));
