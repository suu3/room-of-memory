// @vitest-environment node
import { readFileSync } from "node:fs";
import { Box3, Matrix3, type Mesh, Vector3 } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { ASSETS } from "@/lib/assets";

function modelBytes() {
  return readFileSync(`public${ASSETS.models.reportCard.split("?")[0]}`);
}

async function loadReportCard() {
  const bytes = modelBytes();
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    "",
  );
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

describe("shipped report card model", () => {
  it("registers the chapter-one report card GLB", () => {
    expect(ASSETS.models.reportCard).toBe("/assets/models/ch1-report-card.glb?v=20260926");
  });

  it("is a compact self-contained Meshopt GLB", () => {
    const bytes = modelBytes();
    const jsonLength = bytes.readUInt32LE(12);
    const header = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
    expect(bytes.length).toBeLessThan(100 * 1024);
    expect(header.extensionsRequired).toContain("EXT_meshopt_compression");
    expect(header.images ?? []).toHaveLength(0);
  });

  it("keeps the requested A4 footprint with its origin at the bottom center", async () => {
    const scene = await loadReportCard();
    const bounds = new Box3().setFromObject(scene);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    expect(size.x).toBeCloseTo(0.3, 3);
    expect(size.z).toBeCloseTo(0.42, 3);
    expect(size.y).toBeGreaterThan(0.002);
    expect(size.y).toBeLessThan(0.015);
    expect(bounds.min.y).toBeCloseTo(0, 4);
    expect(center.x).toBeCloseTo(0, 4);
    expect(center.z).toBeCloseTo(0, 4);
  });

  it("has upward-facing print, a visible fold crease, and a metal staple", async () => {
    const scene = await loadReportCard();
    for (const name of ["report-card-print", "report-card-crease", "report-card-staple"]) {
      expect(scene.getObjectByName(name), `missing ${name}`).toBeTruthy();
    }

    const print = scene.getObjectByName("report-card-print") as Mesh;
    const normals = print.geometry.getAttribute("normal");
    const normalMatrix = new Matrix3().getNormalMatrix(print.matrixWorld);
    const averageNormal = new Vector3();
    for (let index = 0; index < normals.count; index++) {
      averageNormal.add(
        new Vector3(normals.getX(index), normals.getY(index), normals.getZ(index)).applyMatrix3(
          normalMatrix,
        ),
      );
    }
    expect(averageNormal.normalize().y).toBeGreaterThan(0.95);
  });
});
