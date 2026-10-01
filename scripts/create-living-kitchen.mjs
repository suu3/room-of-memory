/** Original open-kitchen geometry. Rebuild: node scripts/create-living-kitchen.mjs */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  Box3,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
  Vector3,
} from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);
const css = readFileSync("src/app/globals.css", "utf8");

function material(token, name) {
  const color = css.match(new RegExp(`--color-scene-${token}:\\s*([^;]+);`))?.[1];
  if (!color) throw new Error(`Missing scene token ${token}`);
  const result = new MeshStandardMaterial({
    color,
    roughness: name === "kitchenMetal" ? 0.45 : 0.82,
  });
  result.name = name;
  return result;
}

const surfaces = {
  wood: material("wood", "kitchenWood"),
  frame: material("frame", "kitchenFrame"),
  linen: material("linen", "kitchenLinen"),
  trim: material("trim", "kitchenTrim"),
  metal: material("sage", "kitchenMetal"),
  dark: material("void", "kitchenDark"),
};
const source = new Group();
source.name = "living-open-kitchen";

function add(geometry, surface, position, rotation = [0, 0, 0]) {
  const mesh = new Mesh(geometry, surfaces[surface]);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  source.add(mesh);
}
function box(size, position, surface, radius = 0) {
  add(
    radius ? new RoundedBoxGeometry(...size, 2, radius) : new BoxGeometry(...size),
    surface,
    position,
  );
}

// 하부장 네 칸과 발밑 걸레받이. 앞면은 +z를 향한다.
box([3.72, 0.12, 0.56], [0, 0.06, 0.02], "frame");
for (let i = 0; i < 4; i += 1) {
  const x = -1.395 + i * 0.93;
  box([0.88, 0.78, 0.62], [x, 0.51, 0], i === 1 ? "linen" : "wood", 0.025);
  box([0.42, 0.035, 0.04], [x, 0.68, 0.33], "frame", 0.01);
}
// 상판과 타일 백스플래시.
box([3.82, 0.12, 0.76], [0, 0.96, 0.06], "trim", 0.025);
box([3.72, 0.68, 0.06], [0, 1.34, -0.32], "linen");
for (const x of [-0.93, 0, 0.93]) box([0.018, 0.66, 0.012], [x, 1.34, -0.285], "trim");
box([3.68, 0.018, 0.012], [0, 1.34, -0.284], "trim");

// 왼쪽 싱크: 어두운 얕은 볼, 테두리와 굽은 수전.
box([0.76, 0.035, 0.46], [-0.94, 1.035, 0.06], "dark", 0.035);
box([0.62, 0.025, 0.34], [-0.94, 1.058, 0.06], "metal", 0.04);
add(
  new TorusGeometry(0.18, 0.025, 8, 20, Math.PI),
  "metal",
  [-0.94, 1.25, -0.11],
  [0, 0, Math.PI / 2],
);
box([0.05, 0.22, 0.05], [-0.94, 1.15, -0.11], "metal", 0.015);

// 오른쪽 2구 레인지와 손잡이.
box([0.82, 0.035, 0.48], [0.94, 1.035, 0.06], "dark", 0.02);
for (const x of [0.72, 1.16]) {
  add(new CylinderGeometry(0.15, 0.15, 0.018, 20), "frame", [x, 1.06, 0.06]);
}
for (const x of [0.75, 0.95, 1.15]) {
  add(new CylinderGeometry(0.035, 0.035, 0.035, 12), "metal", [x, 0.82, 0.34], [Math.PI / 2, 0, 0]);
}

// 상부장 세 칸. 싱크 위는 한 칸 비워 답답하지 않게 한다.
for (const [x, width] of [
  [-1.48, 0.7],
  [0.08, 0.92],
  [1.1, 0.92],
]) {
  box([width, 0.72, 0.42], [x, 1.92, -0.14], "wood", 0.02);
  box([0.035, 0.28, 0.04], [x + width * 0.34, 1.92, 0.085], "frame", 0.01);
}
// 후드와 작은 주전자 실루엣.
box([0.74, 0.16, 0.42], [0.95, 1.62, -0.1], "metal", 0.025);
box([0.42, 0.48, 0.28], [0.95, 1.96, -0.18], "metal", 0.02);

source.updateMatrixWorld(true);
const batches = new Map();
source.traverse((object) => {
  if (!object.isMesh) return;
  const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
  geometry.applyMatrix4(object.matrixWorld);
  geometry.deleteAttribute("uv");
  const parts = batches.get(object.material) ?? [];
  parts.push(geometry);
  batches.set(object.material, parts);
});
const joined = new Group();
joined.name = source.name;
joined.userData = {
  provenance: "Original procedural geometry for room-of-memory",
  source: "scripts/create-living-kitchen.mjs",
};
for (const [surface, parts] of batches) {
  const mesh = new Mesh(mergeVertices(mergeGeometries(parts)), surface);
  mesh.name = surface.name;
  joined.add(mesh);
}
const bounds = new Box3().setFromObject(joined);
const center = bounds.getCenter(new Vector3());
for (const mesh of joined.children) mesh.geometry.translate(-center.x, -bounds.min.y, -center.z);

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};
mkdirSync(".next/generated-models", { recursive: true });
const output = ".next/generated-models/living-kitchen.glb";
writeFileSync(output, Buffer.from(await new GLTFExporter().parseAsync(joined, { binary: true })));
// PR 전송 계층이 바이너리 diff를 받지 않으므로 산출물은 커밋하지 않고 dev/build 직전에 만든다.
// 재질별 병합과 인덱싱을 마친 136KB GLB라 런타임 전송량도 에셋 한도보다 충분히 작다.
mkdirSync("public/assets/models", { recursive: true });
copyFileSync(output, "public/assets/models/living-kitchen.glb");
console.log("✓ public/assets/models/living-kitchen.glb 생성");
