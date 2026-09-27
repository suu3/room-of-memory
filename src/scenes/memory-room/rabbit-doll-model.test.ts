// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASSETS } from "@/lib/assets";

type GlbPrimitive = { material?: number };
type GlbModel = {
  materials: { pbrMetallicRoughness?: { baseColorFactor?: number[] } }[];
  meshes: { primitives: GlbPrimitive[] }[];
  nodes: { mesh?: number; name?: string }[];
};

function modelHeader() {
  const path = `public${ASSETS.models.rabbitDoll.split("?")[0]}`;
  const bytes = readFileSync(path);
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString()) as GlbModel;
}

function colorForNode(model: GlbModel, nodeName: string) {
  const node = model.nodes.find(({ name }) => name === nodeName);
  const materialIndex =
    node?.mesh === undefined ? undefined : model.meshes[node.mesh]?.primitives[0]?.material;
  return materialIndex === undefined
    ? undefined
    : model.materials[materialIndex]?.pbrMetallicRoughness?.baseColorFactor;
}

function expectColor(actual: number[] | undefined, expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  for (let channel = 0; channel < expected.length; channel++) {
    expect(actual?.[channel]).toBeCloseTo(expected[channel], 5);
  }
}

describe("shipped rabbit doll model", () => {
  it("uses the room clay and linen palette instead of saturated pink and white", () => {
    const model = modelHeader();
    const clay = [0.376262, 0.177888, 0.130136, 1];
    const linen = [0.491021, 0.456411, 0.386429, 1];

    for (const node of ["Cube", "Cube.001", "Roundcube"]) {
      expectColor(colorForNode(model, node), clay);
    }
    for (const node of ["Cube.004", "Sphere"]) {
      expectColor(colorForNode(model, node), linen);
    }
  });
});
