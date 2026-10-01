/** Recolor the user-made rabbit doll with the room palette while preserving compressed geometry. */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Color } from "three";

const root = path.resolve(import.meta.dirname, "../..");
process.chdir(root);

const modelPath = "public/assets/models/rabbit-doll.glb";
const css = readFileSync("src/app/globals.css", "utf8");

function sceneColor(key) {
  const value = css.match(new RegExp(`--color-scene-${key}:\\s*([^;]+);`))?.[1];
  if (!value) throw new Error(`Missing scene token: ${key}`);
  return [...new Color(value).toArray(), 1];
}

function unpackGlb(bytes) {
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binaryHeaderOffset = 20 + jsonLength;
  const binaryLength = bytes.readUInt32LE(binaryHeaderOffset);
  const binary = bytes.subarray(binaryHeaderOffset + 8, binaryHeaderOffset + 8 + binaryLength);
  return { json, binary };
}

function packGlb(json, binary) {
  const content = Buffer.from(JSON.stringify(json));
  const jsonChunk = Buffer.alloc(Math.ceil(content.length / 4) * 4, 32);
  content.copy(jsonChunk);
  const binaryChunk = Buffer.alloc(Math.ceil(binary.length / 4) * 4);
  binary.copy(binaryChunk);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + jsonChunk.length + binaryChunk.length, 8);
  header.writeUInt32LE(jsonChunk.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binaryChunk.length, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonChunk, binaryHeader, binaryChunk]);
}

const { json, binary } = unpackGlb(readFileSync(modelPath));
const clay = sceneColor("clay");
const linen = sceneColor("linen");
const lightClay = [
  ...new Color().fromArray(clay).lerp(new Color().fromArray(linen), 0.3).toArray(),
  1,
];

for (const materialIndex of [0, 1]) {
  json.materials[materialIndex].pbrMetallicRoughness.baseColorFactor = lightClay;
}
json.materials[2].pbrMetallicRoughness.baseColorFactor = linen;

const tail = json.nodes.find((node) => node.name === "Sphere");
if (tail?.mesh === undefined) throw new Error("Rabbit tail mesh is missing");
json.meshes[tail.mesh].primitives[0].material = 2;

writeFileSync(modelPath, packGlb(json, binary));
