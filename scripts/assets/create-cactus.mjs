/**
 * Original low-poly barrel cactus. Rebuild: node scripts/assets/create-cactus.mjs
 * The video is a shape reference; no third-party mesh or texture is included.
 * Colors come from DESIGN.md's scene tokens. model:prep packs the finished GLB.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  Box3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const root = path.resolve(import.meta.dirname, "../..");
process.chdir(root);
const css = readFileSync("src/app/globals.css", "utf8");
function token(key) {
  const value = css.match(new RegExp(`--color-scene-${key}:\\s*([^;]+);`))?.[1];
  if (!value) throw new Error(`Missing scene token: ${key}`);
  return new Color(value);
}
function material(name, color) {
  const result = new MeshStandardMaterial({ color, roughness: 0.86, flatShading: true });
  result.name = name;
  return result;
}
const cactus = material("cactus-sage", token("sage"));
const ceramic = material("ceramic-linen", token("linen"));
const ceramicFacet = material("ceramic-trim", token("trim"));
const soil = material("soil-wood", token("wood").multiplyScalar(0.38));
const group = new Group();
group.name = "room-potted-cactus";

function add(geometry, surface, position = [0, 0, 0]) {
  const mesh = new Mesh(geometry, surface);
  mesh.position.set(...position);
  group.add(mesh);
  return mesh;
}

// A closed, hollow ceramic pot: tapered sides, foot, thick lip and recessed soil.
const profile = [
  [0, 0],
  [0.164, 0],
  [0.174, 0.018],
  [0.177, 0.045],
  [0.205, 0.225],
  [0.218, 0.248],
  [0.229, 0.253],
  [0.229, 0.279],
  [0.22, 0.292],
  [0.201, 0.292],
  [0.195, 0.276],
  [0.166, 0.035],
  [0, 0.035],
];
add(
  new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    14,
  ),
  ceramic,
);
add(new CylinderGeometry(0.195, 0.188, 0.018, 14), soil, [0, 0.262, 0]);

// Broad, quiet facets on the pot, inset into its wall at the edges.
for (let side = 0; side < 14; side++) {
  if (side % 3 !== 1) continue;
  const patch = new LatheGeometry(
    [new Vector2(0.183, 0.08), new Vector2(0.2, 0.19)],
    1,
    (side * Math.PI * 2) / 14,
    (Math.PI * 2) / 14,
  );
  add(patch, ceramicFacet);
}

// Eight ribs keep the silhouette readable from the room camera. The small
// angular faces belong to the mesh itself, so flat shading survives GLB export.
const radius = 0.181;
const centerY = 0.517;
const stretch = 1.58;
const ribs = 8;
function surfacePoint(phi, theta) {
  const ridge = 0.88 + 0.12 * Math.cos(ribs * theta);
  return new Vector3(
    Math.sin(phi) * Math.cos(theta) * radius * ridge,
    centerY + Math.cos(phi) * radius * stretch,
    Math.sin(phi) * Math.sin(theta) * radius * ridge,
  );
}
const body = new SphereGeometry(radius, 48, 16);
const positions = body.getAttribute("position");
for (let i = 0; i < positions.count; i++) {
  const theta = Math.atan2(positions.getZ(i), positions.getX(i));
  const ridge = 0.88 + 0.12 * Math.cos(ribs * theta);
  positions.setXYZ(
    i,
    positions.getX(i) * ridge,
    positions.getY(i) * stretch + centerY,
    positions.getZ(i) * ridge,
  );
}
body.computeVertexNormals();
add(body, cactus);

// Short ivory spine clusters on the rib crests. All spikes are joined by
// material below; their count never becomes a per-spike runtime draw call.
const up = new Vector3(0, 1, 0);
for (let rib = 0; rib < ribs; rib++) {
  const theta = (rib * Math.PI * 2) / ribs;
  for (const ring of [3, 5, 7, 9, 11]) {
    const phi = (ring * Math.PI) / 16;
    const base = surfacePoint(phi, theta);
    const normal = new Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi) / stretch,
      Math.sin(phi) * Math.sin(theta),
    ).normalize();
    const tangent = new Vector3(-Math.sin(theta), 0, Math.cos(theta));
    const areole = new SphereGeometry(0.008, 6, 4);
    add(areole, ceramic, base.toArray());
    for (const fan of [-1, 0, 1]) {
      const direction = normal
        .clone()
        .addScaledVector(tangent, fan * 0.55)
        .normalize();
      const length = fan === 0 ? 0.036 : 0.026;
      const spike = new ConeGeometry(0.0045, length, 4);
      spike.applyQuaternion(new Quaternion().setFromUnitVectors(up, direction));
      spike.translate(
        ...base
          .clone()
          .addScaledVector(direction, length / 2 - 0.003)
          .toArray(),
      );
      add(spike, ceramic);
    }
  }
}

// Bake flat normals before exporting: GLTF does not encode flatShading.
// Merge the roughly 170 pieces into four material batches.
group.updateMatrixWorld(true);
const batches = new Map();
group.traverse((object) => {
  if (!object.isMesh) return;
  const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
  geometry.applyMatrix4(object.matrixWorld);
  geometry.computeVertexNormals();
  geometry.deleteAttribute("uv");
  const parts = batches.get(object.material) ?? [];
  parts.push(geometry);
  batches.set(object.material, parts);
});
const joined = new Group();
joined.name = group.name;
for (const [surface, parts] of batches) {
  const mesh = new Mesh(mergeGeometries(parts), surface);
  mesh.name = surface.name;
  joined.add(mesh);
}
const bounds = new Box3().setFromObject(joined);
const size = bounds.getSize(new Vector3());
if (Math.abs(bounds.min.y) > 0.001 || size.x * 1.08 > 0.58 || size.y > 0.9) {
  throw new Error(`Cactus does not fit the existing cabinet space: ${size.toArray()}`);
}

// GLTFExporter's geometry-only Node path needs FileReader.readAsArrayBuffer.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};
const output = ".next/cactus/room-potted-cactus.glb";
mkdirSync(path.dirname(output), { recursive: true });
const bytes = await new GLTFExporter().parseAsync(joined, { binary: true });
writeFileSync(output, Buffer.from(bytes));
execFileSync(process.execPath, ["scripts/prepare-model.mjs", output, "room-potted-cactus"], {
  stdio: "inherit",
});
