/**
 * Original A4 report card prop. Rebuild: node scripts/assets/create-report-card.mjs
 *
 * The finished sheet lies on the XZ plane: 0.30m wide, 0.42m long, printed face +Y,
 * and bottom-centred at the origin. Geometry and colours are original to this project.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  Box3,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const root = path.resolve(import.meta.dirname, "../..");
process.chdir(root);

const WIDTH = 0.3;
const DEPTH = 0.42;
const THICKNESS = 0.0012;
const HALF_WIDTH = WIDTH / 2;
const HALF_DEPTH = DEPTH / 2;

const css = readFileSync("src/app/globals.css", "utf8");
function sceneColor(token) {
  const value = css.match(new RegExp(`--color-scene-${token}:\\s*([^;]+);`))?.[1];
  if (!value) throw new Error(`Missing scene token: ${token}`);
  return new Color(value);
}

function surface(name, token, options = {}) {
  const material = new MeshStandardMaterial({
    color: sceneColor(token),
    roughness: 0.9,
    ...options,
  });
  material.name = name;
  return material;
}

const paperMaterial = surface("report-card-paper", "linen", { roughness: 0.96 });
const inkMaterial = surface("report-card-print", "frame", { roughness: 0.92 });
const accentMaterial = surface("report-card-score-stamp", "clay", { roughness: 0.9 });
const creaseMaterial = surface("report-card-crease", "trim", { roughness: 0.98 });
const stapleMaterial = surface("report-card-staple", "trim", {
  metalness: 0.72,
  roughness: 0.34,
});

function paperRise(x, z) {
  const crease =
    0.00125 *
    Math.exp(-(((z - 0.018) / 0.017) ** 2)) *
    (0.35 + 0.65 * Math.cos((x / HALF_WIDTH) * Math.PI * 0.5));
  const cornerX = Math.max(0, (x - 0.075) / (HALF_WIDTH - 0.075));
  const cornerZ = Math.max(0, (z - 0.105) / (HALF_DEPTH - 0.105));
  const curledCorner = 0.0052 * cornerX ** 2 * cornerZ ** 2;
  const softWarp = 0.00035 * (1 - Math.cos(((z + HALF_DEPTH) / DEPTH) * Math.PI * 2));
  return Math.max(0, crease + curledCorner + softWarp);
}

function makePaperGeometry() {
  const columns = 14;
  const rows = 20;
  const layerSize = (columns + 1) * (rows + 1);
  const positions = [];
  const indices = [];

  for (const top of [false, true]) {
    for (let row = 0; row <= rows; row++) {
      const z = -HALF_DEPTH + (DEPTH * row) / rows;
      for (let column = 0; column <= columns; column++) {
        const x = -HALF_WIDTH + (WIDTH * column) / columns;
        positions.push(x, paperRise(x, z) + (top ? THICKNESS : 0), z);
      }
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column;
      const b = a + 1;
      const d = a + columns + 1;
      const c = d + 1;
      indices.push(a, d, b, b, d, c);
      indices.push(layerSize + a, layerSize + b, layerSize + d);
      indices.push(layerSize + b, layerSize + c, layerSize + d);
    }
  }

  const edgeLoops = [
    Array.from({ length: columns + 1 }, (_, index) => index),
    Array.from({ length: rows + 1 }, (_, index) => index * (columns + 1) + columns),
    Array.from({ length: columns + 1 }, (_, index) => rows * (columns + 1) + columns - index),
    Array.from({ length: rows + 1 }, (_, index) => (rows - index) * (columns + 1)),
  ];
  for (const edge of edgeLoops) {
    for (let index = 0; index < edge.length - 1; index++) {
      const a = edge[index];
      const b = edge[index + 1];
      indices.push(a, b, layerSize + a, b, layerSize + b, layerSize + a);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function horizontalPlane(width, depth, x, z, material, yOffset = 0.00022) {
  const geometry = new PlaneGeometry(width, depth);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(x, paperRise(x, z) + THICKNESS + yOffset, z);
  return { geometry, material };
}

function mergeParts(parts, name) {
  const mesh = new Mesh(
    mergeGeometries(
      parts.map((part) => part.geometry),
      false,
    ),
    parts[0].material,
  );
  mesh.name = name;
  return mesh;
}

const reportCard = new Group();
reportCard.name = "ch1-report-card";
reportCard.userData = {
  provenance: "Original procedural geometry for room-of-memory",
  source: "scripts/assets/create-report-card.mjs",
  dimensions: "0.30m x 0.42m A4 proportion",
  front: "+Y",
};

const paper = new Mesh(makePaperGeometry(), paperMaterial);
paper.name = "report-card-paper";
reportCard.add(paper);

const printParts = [];
const addInk = (width, depth, x, z) =>
  printParts.push(horizontalPlane(width, depth, x, z, inkMaterial));

// School heading and compact title bars.
addInk(0.078, 0.005, 0, 0.172);
addInk(0.052, 0.003, 0, 0.161);
addInk(0.248, 0.0016, 0, 0.145);

// Student information fields.
for (const z of [0.126, 0.111]) {
  addInk(0.025, 0.0022, -0.103, z);
  addInk(0.075, 0.0012, -0.047, z);
  addInk(0.021, 0.0022, 0.03, z);
  addInk(0.078, 0.0012, 0.088, z);
}

// Grade table: border, column separators, and eight readable rows.
const tableTop = 0.088;
const tableBottom = -0.112;
const tableLeft = -0.124;
const tableRight = 0.124;
addInk(tableRight - tableLeft, 0.0018, 0, tableTop);
addInk(tableRight - tableLeft, 0.0018, 0, tableBottom);
addInk(0.0018, tableTop - tableBottom, tableLeft, (tableTop + tableBottom) / 2);
addInk(0.0018, tableTop - tableBottom, tableRight, (tableTop + tableBottom) / 2);
for (const x of [-0.055, 0.035, 0.087]) {
  addInk(0.00125, tableTop - tableBottom, x, (tableTop + tableBottom) / 2);
}
for (let row = 1; row < 9; row++) {
  const z = tableTop - (row * (tableTop - tableBottom)) / 9;
  addInk(tableRight - tableLeft, 0.00105, 0, z);
}
for (let row = 0; row < 8; row++) {
  const z = 0.058 - row * 0.0222;
  addInk(0.034 + (row % 3) * 0.008, 0.0021, -0.09, z);
  addInk(0.02, 0.0021, -0.011, z);
  addInk(0.012, 0.0021, 0.061, z);
  addInk(0.012, 0.0021, 0.105, z);
}

// Footer signature lines.
addInk(0.06, 0.0012, -0.082, -0.146);
addInk(0.06, 0.0012, 0.067, -0.146);
addInk(0.032, 0.0021, -0.096, -0.157);
addInk(0.032, 0.0021, 0.053, -0.157);
reportCard.add(mergeParts(printParts, "report-card-print"));

// A muted circular score stamp, offset like a quick teacher mark.
const stamp = new RingGeometry(0.013, 0.015, 20);
stamp.rotateX(-Math.PI / 2);
stamp.rotateY(-0.18);
stamp.translate(0.096, paperRise(0.096, -0.139) + THICKNESS + 0.0003, -0.139);
const stampMesh = new Mesh(stamp, accentMaterial);
stampMesh.name = "report-card-score-stamp";
reportCard.add(stampMesh);

// The geometry already rises at this fold; the thin strip catches light so it stays legible.
const crease = horizontalPlane(0.268, 0.00055, 0, 0.018, creaseMaterial, 0.00012);
const creaseMesh = new Mesh(crease.geometry, crease.material);
creaseMesh.name = "report-card-crease";
reportCard.add(creaseMesh);

// A small U-shaped staple at the upper-left, with ends dipping into the sheet.
const stapleX = -0.119;
const stapleZ = 0.171;
const stapleBase = paperRise(stapleX, stapleZ) + THICKNESS;
const staplePath = new CatmullRomCurve3([
  new Vector3(stapleX, stapleBase + 0.0001, stapleZ - 0.013),
  new Vector3(stapleX, stapleBase + 0.0022, stapleZ - 0.0105),
  new Vector3(stapleX, stapleBase + 0.0024, stapleZ + 0.0105),
  new Vector3(stapleX, stapleBase + 0.0001, stapleZ + 0.013),
]);
const staple = new Mesh(new TubeGeometry(staplePath, 12, 0.00115, 6, false), stapleMaterial);
staple.name = "report-card-staple";
reportCard.add(staple);

const bounds = new Box3().setFromObject(reportCard);
const size = bounds.getSize(new Vector3());
if (
  Math.abs(size.x - WIDTH) > 0.0001 ||
  Math.abs(size.z - DEPTH) > 0.0001 ||
  Math.abs(bounds.min.y) > 0.0001
) {
  throw new Error(
    `Report-card contract broken: size=${size.toArray().join(",")} minY=${bounds.min.y}`,
  );
}

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};

const raw = ".next/report-card/ch1-report-card.glb";
mkdirSync(path.dirname(raw), { recursive: true });
const bytes = await new GLTFExporter().parseAsync(reportCard, { binary: true });
writeFileSync(raw, Buffer.from(bytes));
execFileSync(process.execPath, ["scripts/prepare-model.mjs", raw, "ch1-report-card"], {
  stdio: "inherit",
});
