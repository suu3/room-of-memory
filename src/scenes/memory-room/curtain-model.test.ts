// @vitest-environment node
import { readFileSync } from "node:fs";
import { type Mesh, Vector3 } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { ASSETS } from "@/lib/assets";
import { CURTAIN_MODEL_PARTS, CURTAIN_MODEL_POSITION, CURTAIN_OPEN_KEY } from "./curtain-model";
import { CURTAIN_X } from "./curtain-motion";

const bytes = readFileSync(`public${ASSETS.models.curtain.split("?")[0]}`);
const header = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());

async function loadCurtain() {
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    "",
  );
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

/**
 * 월드 좌표의 버텍스들. 양자화(KHR_mesh_quantization)된 파일은 노드 변환이 되돌리므로
 * 지오메트리 좌표를 그대로 읽으면 안 된다. 모델 원점은 curtain-model.ts의 자리에 놓인다.
 */
function worldPoints(mesh: Mesh, open: number): Vector3[] {
  const influences = mesh.morphTargetInfluences;
  if (!influences) throw new Error("morph influences missing");
  influences[0] = open;
  const origin = new Vector3(...CURTAIN_MODEL_POSITION);
  return Array.from({ length: mesh.geometry.getAttribute("position").count }, (_, index) =>
    mesh.getVertexPosition(index, new Vector3()).applyMatrix4(mesh.matrixWorld).add(origin),
  );
}

describe("shipped curtain model", () => {
  it("is a small meshopt glb with one cloth per side, each opened by shape key `open`", async () => {
    expect(bytes.length).toBeLessThan(200 * 1024);
    expect(header.extensionsRequired).toContain("EXT_meshopt_compression");
    const scene = await loadCurtain();
    for (const side of CURTAIN_MODEL_PARTS) {
      const mesh = scene.getObjectByName(side) as Mesh | undefined;
      if (!mesh?.isMesh) throw new Error(`missing ${side} mesh`);
      expect(mesh.morphTargetDictionary).toEqual({ [CURTAIN_OPEN_KEY]: 0 });
      expect(mesh.geometry.morphAttributes.normal).toHaveLength(1);
      expect(mesh.geometry.hasAttribute("color")).toBe(true);
    }
  });

  it("hangs from the hem at its placed height up to just under the rod", async () => {
    const scene = await loadCurtain();
    const ys = CURTAIN_MODEL_PARTS.flatMap((side) =>
      worldPoints(scene.getObjectByName(side) as Mesh, 0).map((point) => point.y),
    );
    expect(Math.min(...ys)).toBeCloseTo(CURTAIN_MODEL_POSITION[1], 2);
    expect(Math.max(...ys)).toBeGreaterThan(3.9);
    expect(Math.max(...ys)).toBeLessThan(3.98);
  });

  for (const side of CURTAIN_MODEL_PARTS) {
    it(`${side} keeps its outer edge on the rod end while 'open' gathers it clear of the window`, async () => {
      const scene = await loadCurtain();
      const mesh = scene.getObjectByName(side) as Mesh;
      const closed = worldPoints(mesh, 0).map((point) => point.x);
      const open = worldPoints(mesh, 1).map((point) => point.x);
      const outer = side === "left" ? Math.min : Math.max;
      const inner = side === "left" ? Math.max : Math.min;
      expect(outer(...closed)).toBeCloseTo(outer(...open), 2);
      // 닫힌 천의 가운데는 curtain-motion이 아는 자리(다가감 판정·당기는 거리의 기준)에 있다.
      expect((outer(...closed) + inner(...closed)) / 2).toBeCloseTo(CURTAIN_X[side].closed, 1);
      if (side === "left") {
        expect(inner(...closed)).toBeGreaterThanOrEqual(1.15);
        expect(inner(...open)).toBeLessThan(-0.27);
      } else {
        expect(inner(...closed)).toBeLessThanOrEqual(1.15);
        expect(inner(...open)).toBeGreaterThan(2.57);
      }
    });
  }
});
