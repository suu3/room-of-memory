/** Original geometry, no imported meshes/textures. Rebuild: node scripts/create-original-furniture.mjs */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  Box3,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);
const css = readFileSync("src/app/globals.css", "utf8");
function material(key, name = key) {
  const color = css.match(new RegExp(`--color-scene-${key}:\\s*([^;]+);`))?.[1];
  if (!color) throw new Error(`Missing scene token ${key}`);
  const m = new MeshStandardMaterial({ color: new Color(color), roughness: 0.8 });
  m.name = name;
  return m;
}
const wood = material("wood"),
  frame = material("frame"),
  linen = material("linen"),
  trim = material("trim"),
  clay = material("clay"),
  sage = material("sage"),
  fabric = material("fabric"),
  dark = material("void");
let group;
function add(geometry, surface, at = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new Mesh(geometry, surface);
  mesh.position.set(...at);
  mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}
function box(size, at, surface, radius = 0) {
  return add(
    radius ? new RoundedBoxGeometry(...size, 2, radius) : new BoxGeometry(...size),
    surface,
    at,
  );
}
function cylinder(top, bottom, height, at, surface, rotation = [0, 0, 0]) {
  return add(new CylinderGeometry(top, bottom, height, 16), surface, at, rotation);
}
function ellipsoid(size, at, surface, rotation = [0, 0, 0]) {
  const mesh = add(new SphereGeometry(1, 16, 10), surface, at, rotation);
  mesh.scale.set(...size);
  return mesh;
}
const builders = {
  "ch1-radio": () => {
    box([0.315, 0.18, 0.095], [0, 0.096, 0], wood, 0.012);
    for (const x of [-0.11, 0.11]) box([0.036, 0.015, 0.066], [x, 0.0075, 0], frame, 0.003);
    box([0.173, 0.129, 0.009], [-0.057, 0.095, 0.049], frame, 0.006);
    for (let row = 0; row < 9; row++)
      box([0.149, 0.003, 0.003], [-0.057, 0.044 + row * 0.013, 0.055], trim);
    box([0.079, 0.027, 0.008], [0.085, 0.15, 0.052], dark, 0.003);
    for (let i = 0; i < 7; i++)
      box([0.002, i % 2 ? 0.009 : 0.016, 0.002], [0.055 + i * 0.009, 0.15, 0.057], linen);
    for (const y of [0.054, 0.103])
      cylinder(0.016, 0.016, 0.014, [0.094, y, 0.057], trim, [Math.PI / 2, 0, 0]);
    for (const x of [-0.09, 0.09]) box([0.012, 0.043, 0.016], [x, 0.2, 0], frame, 0.003);
    box([0.192, 0.012, 0.016], [0, 0.222, 0], frame, 0.004);
  },
  "room-computer-screen": () => {
    box([0.16, 0.014, 0.104], [0, 0.007, 0], frame, 0.005);
    box([0.036, 0.091, 0.025], [0, 0.05, -0.013], trim, 0.004);
    box([0.393, 0.222, 0.025], [0, 0.183, -0.012], frame, 0.008);
    box([0.363, 0.19, 0.002], [0, 0.187, 0.0015], dark, 0.004);
    box([0.007, 0.002, 0.002], [0.173, 0.08, 0.002], sage);
  },
  "room-computer-keyboard": () => {
    box([0.282, 0.014, 0.118], [0, 0.007, 0], frame, 0.006);
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 13; col++) {
        box(
          [0.016, 0.009, 0.017],
          [-0.12 + col * 0.02, 0.018, -0.043 + row * 0.022],
          (col + row) % 7 === 0 ? trim : fabric,
          0.002,
        );
      }
    box([0.116, 0.008, 0.014], [0, 0.018, 0.046], trim, 0.002);
  },
  "room-computer-mouse": () => {
    ellipsoid([0.0248, 0.012, 0.0425], [0, 0.012, 0], frame);
    box([0.001, 0.002, 0.031], [0, 0.022, -0.013], dark);
    cylinder(0.004, 0.004, 0.008, [0, 0.022, -0.012], trim, [Math.PI / 2, 0, 0]);
  },
  "room-desk-lamp": () => {
    cylinder(0.059, 0.06, 0.013, [0, 0.0065, 0], frame);
    cylinder(0.006, 0.008, 0.227, [0, 0.12, 0], trim);
    // Hollow shade: the runtime bulb sits at y=0.64/3.1 inside the opening.
    add(
      new LatheGeometry(
        [
          [0.057, 0.198],
          [0.06, 0.2],
          [0.03, 0.285],
          [0.027, 0.29],
          [0.022, 0.285],
          [0.051, 0.2],
        ].map(([r, y]) => new Vector2(r, y)),
        20,
      ),
      sage,
    );
    cylinder(0.009, 0.009, 0.006, [0.027, 0.016, 0.017], clay);
  },
  "room-books": () => {
    for (let i = 0; i < 3; i++) {
      const y = i * 0.034;
      const cover = [clay, sage, fabric][i];
      box([0.149, 0.003, 0.094], [0, y + 0.0015, 0], cover);
      box([0.143, 0.025, 0.086], [0.002, y + 0.015, 0], linen);
      box([0.149, 0.003, 0.094], [0, y + 0.0305, 0], cover);
      box([0.004, 0.03, 0.094], [-0.073, y + 0.016, 0], cover);
    }
  },
  "room-rug": () => {
    const field = material("linen", "carpet"),
      border = material("clay", "carpetDarker");
    box([1.57, 0.008, 0.92], [0, 0.004, 0], border, 0.003);
    box([1.44, 0.002, 0.79], [0, 0.009, 0], field);
    for (const z of [-0.34, 0.34]) box([1.33, 0.001, 0.009], [0, 0.0105, z], border);
    for (const x of [-0.785, 0.785])
      for (let i = 0; i < 25; i++) box([0.04, 0.003, 0.008], [x, 0.003, -0.42 + i * 0.035], field);
  },
  "room-potted-plant": () => {
    add(
      new LatheGeometry(
        [
          [0, 0],
          [0.067, 0],
          [0.096, 0.17],
          [0.099, 0.185],
          [0.086, 0.185],
          [0.079, 0.04],
          [0, 0.04],
        ].map(([r, y]) => new Vector2(r, y)),
        16,
      ),
      clay,
    );
    cylinder(0.087, 0.08, 0.009, [0, 0.168, 0], dark);
    cylinder(0.005, 0.009, 0.36, [0, 0.35, 0], wood);
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.4,
        y = 0.24 + i * 0.043;
      ellipsoid([0.032, 0.07, 0.012], [Math.cos(angle) * 0.045, y, Math.sin(angle) * 0.045], sage, [
        0,
        -angle,
        -0.75,
      ]);
    }
  },
};

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};
mkdirSync(".next/original-furniture", { recursive: true });
for (const [name, build] of Object.entries(builders)) {
  group = new Group();
  group.name = name;
  build();
  group.updateMatrixWorld(true);
  const batches = new Map();
  group.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry.index
      ? object.geometry.toNonIndexed()
      : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    geometry.deleteAttribute("uv");
    const parts = batches.get(object.material) ?? [];
    parts.push(geometry);
    batches.set(object.material, parts);
  });
  const joined = new Group();
  joined.name = name;
  joined.userData = {
    provenance: "Original procedural geometry for room-of-memory",
    source: "scripts/create-original-furniture.mjs",
  };
  for (const [surface, parts] of batches) {
    const mesh = new Mesh(mergeGeometries(parts), surface);
    mesh.name = surface.name;
    joined.add(mesh);
  }
  const bounds = new Box3().setFromObject(joined);
  const center = bounds.getCenter(new Vector3());
  for (const mesh of joined.children) mesh.geometry.translate(-center.x, -bounds.min.y, -center.z);
  const file = `.next/original-furniture/${name}.glb`;
  writeFileSync(file, Buffer.from(await new GLTFExporter().parseAsync(joined, { binary: true })));
  execFileSync(process.execPath, ["scripts/prepare-model.mjs", file, name], { stdio: "inherit" });
}
