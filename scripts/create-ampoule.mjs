/**
 * 라온생명과학연구소 RX-11 앰플(바이알).
 * 재생성: node scripts/create-ampoule.mjs
 *
 * 사용자가 제공한 애니메이션 스틸은 실루엣 참고용이며, 메쉬와 재질은 프로젝트에서
 * 직접 만든다. 라벨은 게임의 기존 단서 이미지(mg-ampoule-label.webp)를 GLB 안에 넣는다.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  Color,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  TorusGeometry,
  Vector2,
} from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

const root = path.resolve(import.meta.dirname, "..");
process.chdir(root);

const css = readFileSync("src/app/globals.css", "utf8");
function token(key) {
  const value = css.match(new RegExp(`--color-scene-${key}:\\s*([^;]+);`))?.[1];
  if (!value) throw new Error(`Missing scene token: ${key}`);
  return new Color(value);
}

const glass = new MeshPhysicalMaterial({
  color: token("daylight"),
  roughness: 0.08,
  metalness: 0,
  transmission: 0.92,
  thickness: 0.006,
  ior: 1.46,
  transparent: false,
});
glass.name = "borosilicate-glass";

const liquid = new MeshPhysicalMaterial({
  color: token("daylight").lerp(token("sage"), 0.18),
  roughness: 0.18,
  metalness: 0,
  transmission: 0.25,
  transparent: true,
  opacity: 0.78,
});
liquid.name = "rx11-liquid";

const metal = new MeshStandardMaterial({
  color: token("linen").lerp(new Color("white"), 0.42),
  roughness: 0.28,
  metalness: 0.58,
});
metal.name = "crimped-aluminium";

const rubber = new MeshStandardMaterial({
  color: token("frame").multiplyScalar(0.42),
  roughness: 0.82,
  metalness: 0,
});
rubber.name = "rubber-stopper";

const label = new MeshStandardMaterial({
  color: token("linen").lerp(new Color("white"), 0.28),
  roughness: 0.92,
  metalness: 0,
  side: 2,
});
label.name = "laon-label";

const ampoule = new Group();
ampoule.name = "laon-rx11-ampoule";

function add(name, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const object = new Mesh(geometry, material);
  object.name = name;
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.castShadow = true;
  object.receiveShadow = true;
  ampoule.add(object);
  return object;
}

// 두꺼운 바닥에서 곧은 몸통, 둥근 어깨, 좁은 목으로 이어지는 약병 실루엣.
const bodyProfile = [
  [0, 0],
  [0.028, 0],
  [0.033, 0.003],
  [0.035, 0.009],
  [0.035, 0.119],
  [0.034, 0.131],
  [0.031, 0.14],
  [0.025, 0.147],
  [0.019, 0.152],
  [0, 0.152],
].map(([radius, y]) => new Vector2(radius, y));
add("vial-glass", new LatheGeometry(bodyProfile, 48), glass);

// 유리 바닥의 두께를 잡아 주는 작은 환형 발. 정면에서 병이 바닥에 눌러 앉아 보인다.
add(
  "vial-base",
  new TorusGeometry(0.0305, 0.0036, 8, 40),
  glass,
  [0, 0.0045, 0],
  [Math.PI / 2, 0, 0],
);

add("vial-liquid", new CylinderGeometry(0.0305, 0.0305, 0.099, 40), liquid, [0, 0.055, 0]);
// 아주 얕은 볼록면이 액체와 빈 공간을 분리한다.
add(
  "vial-meniscus",
  new TorusGeometry(0.025, 0.0055, 8, 40),
  liquid,
  [0, 0.1045, 0],
  [Math.PI / 2, 0, 0],
);

add("vial-neck", new CylinderGeometry(0.019, 0.019, 0.025, 32), glass, [0, 0.1585, 0]);
add("vial-stopper", new CylinderGeometry(0.0182, 0.0188, 0.011, 32), rubber, [0, 0.1695, 0]);

add("vial-cap", new CylinderGeometry(0.027, 0.026, 0.025, 32), metal, [0, 0.1835, 0]);
for (const [index, y] of [0.173, 0.1785, 0.1895].entries()) {
  add(
    `vial-cap-ridge-${index + 1}`,
    new TorusGeometry(0.0265, 0.00125, 6, 32),
    metal,
    [0, y, 0],
    [Math.PI / 2, 0, 0],
  );
}
add("vial-cap-top", new CylinderGeometry(0.0215, 0.0215, 0.003, 32), metal, [0, 0.1975, 0]);

// 기존 4:1 라벨을 정면(+Z)을 중심으로 몸통의 3/4 둘레에 감는다.
const labelGeometry = new CylinderGeometry(
  0.0357,
  0.0357,
  0.043,
  40,
  1,
  true,
  -Math.PI * 0.75,
  Math.PI * 1.5,
);
// three의 원통 UV는 위쪽이 v=1(flipY 텍스처 기준)이다. glTF는 그림의 위쪽이 v=0이고
// GLTFLoader가 flipY를 끄므로, 그대로 내보내면 라벨이 위아래로 뒤집혀 보인다.
const labelUv = labelGeometry.getAttribute("uv");
for (let index = 0; index < labelUv.count; index++) {
  labelUv.setY(index, 1 - labelUv.getY(index));
}
add("vial-label", labelGeometry, label, [0, 0.077, 0]);

// GLTFExporter의 geometry-only Node 경로에서 필요한 FileReader 동작.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};

function pack(json, binary) {
  const content = Buffer.from(JSON.stringify(json));
  const jsonChunk = Buffer.alloc(Math.ceil(content.length / 4) * 4, 32);
  content.copy(jsonChunk);
  const binChunk = Buffer.alloc(Math.ceil(binary.length / 4) * 4);
  binary.copy(binChunk);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + jsonChunk.length + binChunk.length, 8);
  header.writeUInt32LE(jsonChunk.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonChunk, binHeader, binChunk]);
}

mkdirSync(".next/ampoule", { recursive: true });
const raw = ".next/ampoule/room-laon-ampoule.glb";
const exported = await new GLTFExporter().parseAsync(ampoule, { binary: true });
writeFileSync(raw, Buffer.from(exported));

// 기존 WebP 라벨을 GLB의 BIN 청크에 붙이고 라벨 재질이 그 이미지를 참조하게 한다.
const bytes = readFileSync(raw);
const jsonLength = bytes.readUInt32LE(12);
const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const binary = bytes.subarray(28 + jsonLength);
const labelBytes = readFileSync("public/assets/images/mg-ampoule-label.webp");
const imageView = json.bufferViews.length;
json.bufferViews.push({ buffer: 0, byteOffset: binary.length, byteLength: labelBytes.length });
json.buffers[0].byteLength = binary.length + labelBytes.length;
json.images = [{ bufferView: imageView, mimeType: "image/webp", name: "laon-rx11-label" }];
json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
json.textures = [{ sampler: 0, extensions: { EXT_texture_webp: { source: 0 } } }];
json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), "EXT_texture_webp"])];
json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []), "EXT_texture_webp"])];
const labelMaterial = json.materials.find((material) => material.name === "laon-label");
if (!labelMaterial) throw new Error("GLB export lost the laon-label material");
labelMaterial.pbrMetallicRoughness.baseColorTexture = { index: 0 };
writeFileSync(raw, pack(json, Buffer.concat([binary, labelBytes])));

const target = "public/assets/models/room-laon-ampoule.glb";
execFileSync("pnpm", ["dlx", "@gltf-transform/cli", "meshopt", raw, target], {
  stdio: "inherit",
});
console.log(`room-laon-ampoule: ${(readFileSync(target).length / 1024).toFixed(1)} KiB`);
