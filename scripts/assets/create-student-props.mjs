/** Original room props. Rebuild: node scripts/assets/create-student-props.mjs
 * Uses the same Meshopt tooling as model:prep, with the WebP atlas embedded first.
 * Geometry stays editable here; all delivered assets are self-contained GLBs.
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const root = path.resolve(import.meta.dirname, "../..");
process.chdir(root);
const require = createRequire(import.meta.url);
const sharp = require(require.resolve("sharp", { paths: [require.resolve("next")] }));
const css = readFileSync("src/app/globals.css", "utf8");
const colors = Object.fromEntries(
  ["wood", "frame", "linen", "trim", "fabric", "clay", "sage", "amber"].map((key) => {
    const value = css.match(new RegExp(`--color-scene-${key}:\\s*([^;]+);`))?.[1];
    if (!value) throw new Error(`Missing scene token: ${key}`);
    return [key, value];
  }),
);
const materials = Object.fromEntries(
  Object.entries(colors).map(([name, color]) => {
    const material = new MeshStandardMaterial({ color, roughness: 0.88 });
    material.name = name;
    return [name, material];
  }),
);
const print = new MeshStandardMaterial({ roughness: 0.95 });
print.name = "student-print";

// GLTFExporter only needs these two browser FileReader operations for geometry.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString("base64")}`;
      this.onloadend?.();
    });
  }
};

function mesh(parent, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const object = new Mesh(geometry, typeof material === "string" ? materials[material] : material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  parent.add(object);
  return object;
}
function box(parent, size, position, material) {
  return mesh(parent, new BoxGeometry(...size), material, position);
}
function cord(parent, points, radius, material) {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  return mesh(parent, new TubeGeometry(curve, points.length * 3, radius, 5, false), material);
}
function plane(parent, width, height, position, tile, rotation = [-Math.PI / 2, 0, 0]) {
  const geometry = new PlaneGeometry(width, height);
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    // Leave a four-pixel gutter to prevent neighbouring atlas tiles bleeding in mipmaps.
    uv.setXY(
      i,
      ((tile % 2) * 512 + 4 + uv.getX(i) * 504) / 1024,
      (Math.floor(tile / 2) * 512 + 508 - uv.getY(i) * 504) / 1024,
    );
  }
  return mesh(parent, geometry, print, position, rotation);
}
function book(parent, x, y, z, width, depth, thickness, color, tile, angle = 0) {
  const group = new Group();
  group.position.set(x, y, z);
  group.rotation.y = angle;
  parent.add(group);
  box(group, [width, 0.008, depth], [0, 0.004, 0], color);
  box(group, [width - 0.018, thickness - 0.014, depth - 0.018], [0.004, thickness / 2, 0], "linen");
  box(group, [width, 0.008, depth], [0, thickness - 0.004, 0], color);
  box(group, [0.015, thickness, depth], [-width / 2 + 0.005, thickness / 2, 0], color);
  plane(group, width - 0.012, depth - 0.012, [0, thickness + 0.001, 0], tile);
  // Fine page edges, bookmark and folded corner distinguish workbooks from blocks.
  for (let i = 1; i < 4; i++)
    box(
      group,
      [width - 0.025, 0.0015, 0.002],
      [0.004, (thickness * i) / 4, depth / 2 - 0.008],
      "trim",
    );
  box(group, [0.045, 0.002, 0.06], [width * 0.26, thickness * 0.55, depth / 2 + 0.014], "clay");
  return group;
}

function study() {
  const group = new Group();
  group.name = "grade-12-study-pile";
  book(group, -0.22, 0, 0.03, 0.48, 0.65, 0.052, "sage", 2, -0.08);
  book(group, -0.19, 0.054, 0.01, 0.46, 0.63, 0.065, "fabric", 1, 0.06);
  const paper = new Group();
  paper.position.set(0.235, 0.004, 0.035);
  paper.rotation.y = -0.13;
  group.add(paper);
  for (let i = 0; i < 3; i++) {
    box(paper, [0.47, 0.002, 0.65], [i * 0.007, i * 0.003, i * -0.009], "linen");
  }
  plane(paper, 0.47, 0.65, [0.014, 0.009, -0.018], 0);
  // Dog-ear raised above the printed top sheet.
  const fold = new BufferGeometry();
  fold.setAttribute(
    "position",
    new Float32BufferAttribute([0.249, 0.01, 0.307, 0.249, 0.04, 0.225, 0.17, 0.011, 0.307], 3),
  );
  fold.computeVertexNormals();
  mesh(paper, fold, "linen");
  cord(
    group,
    [
      [0.11, 0.023, 0.24],
      [0.24, 0.025, 0.15],
      [0.4, 0.024, 0.035],
    ],
    0.012,
    "frame",
  );
  cord(
    group,
    [
      [0.4, 0.024, 0.035],
      [0.425, 0.024, 0.018],
    ],
    0.006,
    "trim",
  );
  return group;
}

function ramen() {
  const floor = new Group();
  floor.name = "discarded-noodle-cup";
  const group = new Group();
  floor.add(group);
  group.name = "finished-cup-noodles";
  mesh(group, new CylinderGeometry(0.17, 0.12, 0.24, 24, 1, true), "linen", [0, 0.12, 0]);
  const inside = new CylinderGeometry(0.16, 0.11, 0.225, 24, 1, true);
  const index = inside.index;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    index.setX(i, index.getX(i + 2));
    index.setX(i + 2, a);
  }
  inside.computeVertexNormals();
  mesh(group, inside, "linen", [0, 0.125, 0]);
  mesh(group, new CylinderGeometry(0.115, 0.115, 0.01, 24), "clay", [0, 0.019, 0]);
  mesh(group, new TorusGeometry(0.165, 0.009, 6, 24), "trim", [0, 0.24, 0], [Math.PI / 2, 0, 0]);
  const label = new CylinderGeometry(0.167, 0.132, 0.17, 24, 1, true);
  const uv = label.getAttribute("uv");
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, (516 + uv.getX(i) * 504) / 1024, (1020 - uv.getY(i) * 504) / 1024);
  mesh(group, label, print, [0, 0.13, 0]);
  // Half-peeled foil lid, folded up at the back; the cup remains visibly empty.
  const lid = mesh(
    group,
    new CylinderGeometry(0.155, 0.155, 0.004, 20, 1, false, 0, Math.PI),
    "trim",
    [0, 0.305, -0.15],
    [-0.95, 0, 0],
  );
  lid.name = "peeled-foil-lid";
  // A few scraps at the bottom, plus a crumpled napkin and torn seasoning packet.
  cord(
    group,
    [
      [-0.045, 0.027, 0.03],
      [-0.015, 0.03, 0.04],
      [0.017, 0.025, 0.005],
    ],
    0.004,
    "amber",
  );
  // The cup stands upright, finished and set down; the chopsticks rest inside it, leaning on the rim.
  group.rotation.y = 0.28;
  for (let i = 0; i < 2; i++) {
    cord(
      group,
      [
        [-0.04 + i * 0.03, 0.03, 0.02 - i * 0.035],
        [0.05 + i * 0.02, 0.245, 0.095 + i * 0.01],
        [0.12 + i * 0.025, 0.44, 0.15 + i * 0.02],
      ],
      0.007,
      "wood",
    );
  }
  return floor;
}

function snackBag() {
  const group = new Group();
  group.name = "crumpled-open-snack-bag";
  const columns = 8;
  const rows = 10;
  const positions = [];
  const uvs = [];
  const indices = [];
  // Creased foil pillow, pinched at the sealed end and torn open at the other.
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      const width = 0.42 + 0.07 * Math.sin(v * Math.PI);
      const wrinkle = 0.012 * Math.sin(column * 2.7 + row * 1.8);
      const x = (u - 0.5) * width + 0.024 * Math.sin(v * 5);
      const y = 0.016 + Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.075 + wrinkle;
      const z = (v - 0.5) * 0.65 + (row === 0 ? (column % 2) * 0.022 : 0);
      positions.push(x, y, z);
      uvs.push((516 + u * 504) / 1024, (516 + v * 504) / 1024);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column;
        const b = a + 1;
        const c = a + columns + 1;
        indices.push(a, c, b, b, c, c + 1);
      }
    }
  }
  const front = new BufferGeometry();
  front.setAttribute("position", new Float32BufferAttribute(positions, 3));
  front.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  front.setIndex(indices);
  front.computeVertexNormals();
  mesh(group, front, print);
  // Bottom foil and a silver inner lip protruding through the torn opening.
  const back = front.clone();
  const backPosition = back.getAttribute("position");
  for (let i = 0; i < backPosition.count; i++) backPosition.setY(i, 0.002);
  back.computeVertexNormals();
  mesh(group, back, "trim");
  const opening = mesh(
    group,
    new PlaneGeometry(0.33, 0.075, 8, 1),
    "trim",
    [0, 0.019, -0.34],
    [-Math.PI / 2, 0, 0],
  );
  const lip = opening.geometry.getAttribute("position");
  for (let i = 0; i < lip.count; i++) lip.setZ(i, (i % 2) * 0.012);
  opening.geometry.computeVertexNormals();
  for (const z of [0.291, 0.303, 0.315]) {
    cord(
      group,
      [
        [-0.2, 0.022, z],
        [0, 0.027, z + 0.008],
        [0.2, 0.016, z],
      ],
      0.004,
      "sage",
    );
  }
  return group;
}

function bookshelf() {
  const group = new Group();
  group.name = "student-bookshelf";
  box(group, [1.6, 2.32, 0.055], [0, 1.16, -0.3325], "wood");
  for (const x of [-0.755, 0.755]) box(group, [0.09, 2.35, 0.72], [x, 1.175, 0], "wood");
  for (const y of [0.08, 0.8, 1.52, 2.3]) box(group, [1.51, 0.1, 0.72], [0, y, 0], "wood");
  // Mixed heights, tilted books and lower subject bands read at the room camera distance.
  for (let row = 0; row < 3; row++) {
    const base = [0.13, 0.85, 1.57][row];
    for (let i = 0; i < 6; i++) {
      const height = 0.46 + ((i * 3 + row) % 4) * 0.045;
      const x = -0.61 + i * 0.137;
      const color = ["fabric", "linen", "sage", "clay"][(i + row) % 4];
      box(group, [0.105, height, 0.43], [x, base + height / 2, 0.07], color);
      box(group, [0.08, 0.014, 0.004], [x, base + 0.075, 0.293], "trim");
    }
    book(group, 0.46, base, 0.015, 0.33, 0.48, 0.065, "fabric", 1, -0.03);
    book(group, 0.46, base + 0.067, 0.025, 0.35, 0.47, 0.05, "sage", 2, 0.06);
    if (row === 1) {
      const leaning = box(group, [0.09, 0.46, 0.4], [0.29, base + 0.32, 0.055], "clay");
      leaning.rotation.z = -0.22;
    }
  }
  return group;
}

const text = (x, y, size, value, fill = colors.frame, weight = 500) =>
  `<text x="${x}" y="${y}" font-family="Pretendard, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${value}</text>`;
function atlasSvg() {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${colors.linen}"/>`;
  svg += text(30, 46, 15, "고3 · 6월 전국연합학력평가");
  svg += text(30, 87, 31, "수학 영역", colors.frame, 700);
  svg += text(344, 84, 17, "제 2 교시");
  svg += `<path d="M28 103H483 M256 120V475" fill="none" stroke="${colors.frame}" stroke-width="2"/>`;
  for (let col = 0; col < 2; col++)
    for (let q = 0; q < 4; q++) {
      const x = 29 + col * 241;
      const y = 137 + q * 89;
      svg += text(x, y, 13, `${col * 4 + q + 1}. 다음 물음에 답하시오.`);
      svg += text(x + 5, y + 23, 13, q % 2 ? "f(x) = x² − 2x + 1" : "수열의 일반항을 구하면?");
      svg += text(x + 4, y + 48, 11, "① 2   ② 4   ③ 6   ④ 8   ⑤ 10");
      svg += `<path d="M${x + 7} ${y - 12}l9 10 21 -27" fill="none" stroke="${colors.clay}" stroke-width="3"/>`;
    }
  svg += `<circle cx="88" cy="184" r="10" stroke="${colors.clay}" stroke-width="3" fill="none"/>`;
  svg += text(382, 490, 16, "다시 풀기", colors.clay);
  for (const [x, y, color, title, subtitle, number] of [
    [512, 0, colors.fabric, "수학Ⅰ", "수능 기출 문제집", "2026"],
    [0, 512, colors.sage, "국어", "독서 · 문학 · 실전", "고3"],
  ]) {
    svg += `<rect x="${x + 4}" y="${y + 4}" width="504" height="504" fill="${color}"/>`;
    svg += text(x + 36, y + 65, 20, number, colors.linen);
    svg += text(x + 36, y + 129, 21, subtitle, colors.linen);
    svg += text(x + 34, y + 216, 66, title, colors.linen, 700);
    svg += `<path d="M${x + 40} ${y + 290}H${x + 469}" stroke="${colors.linen}" stroke-width="3"/>`;
    svg += text(x + 38, y + 339, 19, "개념 정리 + 유형별 연습", colors.linen);
    svg += text(x + 38, y + 460, 15, "오답까지, 한 번 더", colors.linen);
  }
  svg += `<rect x="516" y="516" width="504" height="504" fill="${colors.clay}"/>`;
  for (const x of [538, 776]) {
    svg += text(x, 610, 19, "얼큰한 한 끼", colors.linen);
    svg += text(x, 732, 50, "컵라면", colors.linen, 700);
    svg += text(x, 830, 16, "뜨거운 물 · 3분", colors.linen);
    svg += `<path d="M${x} 870h183 M${x} 885h183" stroke="${colors.linen}" stroke-width="3"/>`;
  }
  return `${svg}</svg>`;
}

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

mkdirSync(".next/student-props", { recursive: true });
// Register the already-shipped OFL font in Pango before rendering SVG text.
await sharp({
  text: {
    text: "고3",
    font: "Pretendard 12",
    fontfile: "public/assets/fonts/PretendardVariable.woff2",
  },
})
  .png()
  .toBuffer();
const atlas = await sharp(Buffer.from(atlasSvg())).webp({ lossless: true }).toBuffer();
const snackSvg = atlasSvg().replace(
  "</svg>",
  `<rect x="512" y="512" width="512" height="512" fill="${colors.sage}"/>
  <path d="M512 555H1024 M512 975H1024" stroke="${colors.linen}" stroke-width="14"/>
  ${text(550, 638, 27, "바삭바삭", colors.linen)}
  ${text(546, 719, 64, "감자칩", colors.linen, 700)}
  <ellipse cx="733" cy="840" rx="80" ry="49" fill="${colors.amber}" transform="rotate(-18 733 840)"/>
  <ellipse cx="823" cy="865" rx="77" ry="44" fill="${colors.linen}" transform="rotate(17 823 865)"/>
  ${text(550, 939, 21, "오리지널 · 60 g", colors.linen)}
  </svg>`,
);
const snackAtlas = await sharp(Buffer.from(snackSvg)).webp({ lossless: true }).toBuffer();
for (const [name, create] of Object.entries({
  "room-study-papers": study,
  "room-cup-noodle-trash": ramen,
  "room-snack-bag": snackBag,
  "room-student-bookshelf": bookshelf,
})) {
  const object = create();
  const bounds = new Box3().setFromObject(object, true);
  const center = bounds.getCenter(new Vector3());
  object.position.set(-center.x, -bounds.min.y, -center.z);
  // Bake transforms before joining by material: a whole bookshelf takes seven draw calls.
  object.updateMatrixWorld(true);
  const byMaterial = new Map();
  object.traverse((node) => {
    if (!node.isMesh) return;
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld);
    if (!geometry.getAttribute("uv")) {
      geometry.setAttribute(
        "uv",
        new Float32BufferAttribute(
          new Float32Array(geometry.getAttribute("position").count * 2),
          2,
        ),
      );
    }
    const geometries = byMaterial.get(node.material) ?? [];
    geometries.push(geometry);
    byMaterial.set(node.material, geometries);
  });
  const joined = new Group();
  joined.name = name;
  for (const [material, geometries] of byMaterial) {
    mesh(joined, mergeGeometries(geometries), material);
  }
  const bytes = await new GLTFExporter().parseAsync(joined, { binary: true });
  const raw = `.next/student-props/${name}.glb`;
  writeFileSync(raw, Buffer.from(bytes));
  const target = `public/assets/models/${name}.glb`;
  const compressed = readFileSync(raw);
  const jsonLength = compressed.readUInt32LE(12);
  const json = JSON.parse(compressed.subarray(20, 20 + jsonLength).toString());
  const printed = json.materials.filter((m) => m.name === "student-print");
  if (printed.length) {
    const imageBytes = name === "room-snack-bag" ? snackAtlas : atlas;
    const binary = compressed.subarray(28 + jsonLength);
    const imageView = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset: binary.length, byteLength: imageBytes.length });
    json.buffers[0].byteLength = binary.length + imageBytes.length;
    json.images = [{ bufferView: imageView, mimeType: "image/webp", name: "student-print-atlas" }];
    json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
    json.textures = [{ sampler: 0, extensions: { EXT_texture_webp: { source: 0 } } }];
    json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), "EXT_texture_webp"])];
    json.extensionsRequired = [
      ...new Set([...(json.extensionsRequired ?? []), "EXT_texture_webp"]),
    ];
    for (const material of printed) material.pbrMetallicRoughness.baseColorTexture = { index: 0 };
    writeFileSync(raw, pack(json, Buffer.concat([binary, imageBytes])));
  }
  // Full optimize's Node image validation cannot decode WebP; meshopt preserves the atlas UVs.
  // Both paths below are fixed kebab-case names owned by this script.
  execSync(`pnpm dlx @gltf-transform/cli meshopt ${raw} ${target}`, { stdio: "inherit" });
  console.log(`${name}: ${(readFileSync(target).length / 1024).toFixed(1)} KiB`);
}
