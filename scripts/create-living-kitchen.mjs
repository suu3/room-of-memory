/** Original open-kitchen geometry. Rebuild: node scripts/create-living-kitchen.mjs */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  clay: material("clay", "kitchenClay"),
};
const source = new Group();
source.name = "living-open-kitchen";

/*
 * 부품은 냉장고가 왼쪽에 있는 판으로 적고, 놓을 때 x를 뒤집는다. 부엌은 뒷벽의 +x 구석에
 * 서서 냉장고가 오른쪽 끝, 반도가 왼쪽 끝(거실·현관 쪽)이다. 지오메트리를 음수 배율로 뒤집으면
 * 면의 감김이 뒤집혀 뒷면만 그려지므로, 자리와 각도를 뒤집어 세운다.
 */
const MIRROR_WIDTH = 3.94;

function add(geometry, surface, position, rotation = [0, 0, 0]) {
  const mesh = new Mesh(geometry, surfaces[surface]);
  mesh.position.set(MIRROR_WIDTH - position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], -rotation[1], -rotation[2]);
  source.add(mesh);
}
function box(size, position, surface, radius = 0) {
  add(
    radius ? new RoundedBoxGeometry(...size, 2, radius) : new BoxGeometry(...size),
    surface,
    position,
  );
}

/*
 * 적는 좌표: x 0이 뒷벽 조리대의 냉장고 쪽 끝, z 0이 뒷벽 안쪽 면이다. 뒷벽을 따라 x로 3.9
 * 달리고, 반대쪽 끝에서 거실 쪽(+z)으로 꺾어 나오는 반도형 조리대가 ㄱ자를 닫는다. 놓을 때
 * x가 뒤집힌다(add). 내보낼 때 바운딩 박스 중심으로 옮기므로 배치는 layout의 LIVING_KITCHEN이
 * 그 중심을 놓는다.
 */
const RUN = 3.9;
const RETURN = { minX: 3.1, maxX: 3.94, maxZ: 2.6 };

// 뒷벽 하부장 네 칸과 발밑 걸레받이. 앞면은 +z를 향한다.
box([RUN - 0.1, 0.12, 0.56], [RUN / 2, 0.06, 0.33], "frame");
for (let i = 0; i < 4; i += 1) {
  const x = 0.5 + i * 0.95;
  box([0.9, 0.78, 0.62], [x, 0.51, 0.35], i === 1 ? "linen" : "wood", 0.025);
  box([0.42, 0.035, 0.04], [x, 0.68, 0.68], "frame", 0.01);
}
// 상판과 타일 백스플래시.
box([RUN, 0.12, 0.76], [RUN / 2, 0.96, 0.38], "trim", 0.025);
box([RUN, 0.68, 0.06], [RUN / 2, 1.34, 0.03], "linen");
for (const x of [0.98, 1.95, 2.92]) box([0.018, 0.66, 0.012], [x, 1.34, 0.066], "trim");
box([RUN - 0.04, 0.018, 0.012], [RUN / 2, 1.34, 0.066], "trim");

// 싱크: 어두운 얕은 볼, 테두리와 굽은 수전.
const SINK_X = 1.6;
box([0.76, 0.035, 0.46], [SINK_X, 1.035, 0.4], "dark", 0.035);
box([0.62, 0.025, 0.34], [SINK_X, 1.058, 0.4], "metal", 0.04);
add(
  new TorusGeometry(0.18, 0.025, 8, 20, Math.PI),
  "metal",
  [SINK_X, 1.25, 0.23],
  [0, 0, Math.PI / 2],
);
box([0.05, 0.22, 0.05], [SINK_X, 1.15, 0.23], "metal", 0.015);
// 싱크 옆 도마 한 장: 마지막으로 쓴 사람이 세워 두지 않았다.
box([0.46, 0.025, 0.3], [0.62, 1.035, 0.42], "wood", 0.01);

// 2구 레인지와 손잡이, 그 위의 후드.
const RANGE_X = 2.78;
box([0.82, 0.035, 0.48], [RANGE_X, 1.035, 0.4], "dark", 0.02);
for (const x of [RANGE_X - 0.22, RANGE_X + 0.22]) {
  add(new CylinderGeometry(0.15, 0.15, 0.018, 20), "frame", [x, 1.06, 0.4]);
}
for (const x of [RANGE_X - 0.2, RANGE_X, RANGE_X + 0.2]) {
  add(new CylinderGeometry(0.035, 0.035, 0.035, 12), "metal", [x, 0.82, 0.68], [Math.PI / 2, 0, 0]);
}
box([0.74, 0.16, 0.42], [RANGE_X, 1.62, 0.24], "metal", 0.025);
box([0.42, 0.48, 0.28], [RANGE_X, 1.96, 0.16], "metal", 0.02);

// 상부장: 냉장고 옆 한 칸과 구석 한 칸. 싱크 위는 비워 답답하지 않게 한다.
for (const [x, width] of [
  [0.5, 0.9],
  [3.55, 0.7],
]) {
  box([width, 0.72, 0.42], [x, 1.92, 0.21], "wood", 0.02);
  box([0.035, 0.28, 0.04], [x + width * 0.34, 1.92, 0.435], "frame", 0.01);
}

// 반도형 조리대: 하부장 두 칸이 부엌 안쪽(-x)을 보고, 거실 쪽 끝은 상판만 조금 내민다.
const RETURN_X = (RETURN.minX + RETURN.maxX) / 2;
box(
  [0.56, 0.12, RETURN.maxZ - 0.9],
  [RETURN_X + 0.04, 0.06, (0.76 + RETURN.maxZ - 0.14) / 2],
  "frame",
);
for (const z of [1.22, 2.12]) {
  box([0.62, 0.78, 0.88], [RETURN_X + 0.04, 0.51, z], "wood", 0.025);
  box([0.04, 0.035, 0.42], [RETURN_X - 0.29, 0.68, z], "frame", 0.01);
}
box(
  [RETURN.maxX - RETURN.minX, 0.12, RETURN.maxZ - 0.76],
  [RETURN_X, 0.96, (0.76 + RETURN.maxZ) / 2],
  "trim",
  0.025,
);
// 반도 위의 과일 그릇: 거실에서 보이는 쪽 끝에 놓인 살림 하나.
add(new CylinderGeometry(0.2, 0.13, 0.1, 20), "linen", [RETURN_X, 1.07, 2.15]);
for (const [dx, dz] of [
  [-0.06, -0.04],
  [0.07, 0.02],
  [0, 0.08],
]) {
  add(new CylinderGeometry(0.07, 0.07, 0.1, 12), "clay", [RETURN_X + dx, 1.14, 2.15 + dz]);
}

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
const output = ".next/living-kitchen/living-kitchen.glb";
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, Buffer.from(await new GLTFExporter().parseAsync(joined, { binary: true })));
console.log(`바운딩 박스 ${bounds.min.toArray()} → ${bounds.max.toArray()} (중심이 원점으로 간다)`);
execFileSync(process.execPath, ["scripts/prepare-model.mjs", output, "living-kitchen"], {
  stdio: "inherit",
});
