// @vitest-environment node
import { readFileSync } from "node:fs";
import { Box3, type Mesh, Vector3 } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { ASSETS } from "@/lib/assets";
import { STUDENT_BOOKSHELF } from "./layout";

const models = [
  { url: ASSETS.models.snackBag, printed: true, max: [0.6, 0.15, 0.85] },
  { url: ASSETS.models.studyPapers, printed: true, max: [1.1, 0.15, 0.82] },
  { url: ASSETS.models.cupNoodleTrash, printed: true, max: [0.7, 0.5, 0.7] },
  { url: ASSETS.models.studentBookshelf, printed: true, max: STUDENT_BOOKSHELF.size },
] as const;

describe("shipped student props", () => {
  for (const { url, printed, max } of models) {
    it(`decodes ${url} at its placement scale with self-contained print and bounded draw calls`, async () => {
      const bytes = readFileSync(`public${url.split("?")[0]}`);
      const jsonLength = bytes.readUInt32LE(12);
      const model = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
      expect(bytes.length).toBeLessThan(200 * 1024);
      expect(model.extensionsRequired).toContain("EXT_meshopt_compression");
      const primitives = model.meshes.flatMap(
        (mesh: { primitives: { material: number; attributes: Record<string, number> }[] }) =>
          mesh.primitives,
      );
      expect(primitives.length).toBeLessThanOrEqual(8);
      if (printed) {
        expect(model.extensionsRequired).toContain("EXT_texture_webp");
        expect(model.images).toHaveLength(1);
        expect(model.images[0].uri).toBeUndefined();
        expect(model.images[0].bufferView).toBeTypeOf("number");
        const printedPrimitives = primitives.filter(
          (primitive: { material: number }) =>
            model.materials[primitive.material].pbrMetallicRoughness?.baseColorTexture,
        );
        expect(printedPrimitives.length).toBeGreaterThan(0);
        for (const primitive of printedPrimitives) {
          // optimize used to prune these UVs, turning the exam sheet into a blank rectangle.
          expect(primitive.attributes.TEXCOORD_0).toBeTypeOf("number");
        }
      }

      // Only skip image decoding in Node; keep real compressed vertices and transforms.
      model.images = [];
      model.textures = [];
      model.materials = [{}];
      for (const primitive of primitives) primitive.material = 0;
      const rawJson = Buffer.from(JSON.stringify(model));
      const json = Buffer.alloc(Math.ceil(rawJson.length / 4) * 4, 32);
      rawJson.copy(json);
      const binary = bytes.subarray(20 + jsonLength);
      const header = Buffer.from(bytes.subarray(0, 20));
      header.writeUInt32LE(20 + json.length + binary.length, 8);
      header.writeUInt32LE(json.length, 12);
      const buffer = Buffer.concat([header, json, binary]);
      await MeshoptDecoder.ready;
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const { scene } = await loader.parseAsync(
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length),
        "",
      );
      const bounds = new Box3().setFromObject(scene);
      const size = bounds.getSize(new Vector3()).toArray();
      const center = bounds.getCenter(new Vector3());
      expect(bounds.min.y).toBeCloseTo(0, 3);
      expect(center.x).toBeCloseTo(0, 3);
      expect(center.z).toBeCloseTo(0, 3);
      for (let axis = 0; axis < 3; axis++) {
        expect(size[axis]).toBeGreaterThan(0.01);
        expect(size[axis]).toBeLessThanOrEqual(max[axis] + 0.001);
      }
    });
  }

  it("keeps bookshelf spine title plates smaller than the book spines", async () => {
    const url = ASSETS.models.studentBookshelf;
    const bytes = readFileSync(`public${url.split("?")[0]}`);
    const jsonLength = bytes.readUInt32LE(12);
    const model = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
    const primitives = model.meshes.flatMap(
      (mesh: { primitives: { material: number }[] }) => mesh.primitives,
    );
    model.images = [];
    model.textures = [];
    model.materials = model.materials.map((material: { name?: string }) => ({
      name: material.name,
    }));

    const rawJson = Buffer.from(JSON.stringify(model));
    const json = Buffer.alloc(Math.ceil(rawJson.length / 4) * 4, 32);
    rawJson.copy(json);
    const binary = bytes.subarray(20 + jsonLength);
    const header = Buffer.from(bytes.subarray(0, 20));
    header.writeUInt32LE(20 + json.length + binary.length, 8);
    header.writeUInt32LE(json.length, 12);
    const buffer = Buffer.concat([header, json, binary]);

    await MeshoptDecoder.ready;
    const { scene } = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length), "");
    scene.updateMatrixWorld(true);
    const linenMesh = scene.children
      .flatMap((child) => child.children)
      .find((child) => {
        const material = (child as Mesh).material;
        return material && !Array.isArray(material) && material.name === "linen";
      }) as Mesh | undefined;
    if (!linenMesh) throw new Error("missing linen mesh");

    const position = linenMesh.geometry.getAttribute("position");
    const index = linenMesh.geometry.index;
    const titlePlateTriangles: { width: number; height: number }[] = [];
    const triangleCount = (index?.count ?? position.count) / 3;
    for (let triangle = 0; triangle < triangleCount; triangle++) {
      const vertices = [0, 1, 2].map((corner) => {
        const item = triangle * 3 + corner;
        const vertex = index ? index.getX(item) : item;
        return new Vector3(
          position.getX(vertex),
          position.getY(vertex),
          position.getZ(vertex),
        ).applyMatrix4(linenMesh.matrixWorld);
      });
      if (vertices.every(({ z }) => z > 0.29 && z < 0.292)) {
        const xs = vertices.map(({ x }) => x);
        const ys = vertices.map(({ y }) => y);
        titlePlateTriangles.push({
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        });
      }
    }

    expect(primitives.length).toBeLessThanOrEqual(8);
    expect(titlePlateTriangles).toHaveLength(36);
    for (const triangle of titlePlateTriangles) {
      expect(triangle.width).toBeLessThanOrEqual(0.05);
      expect(triangle.height).toBeLessThanOrEqual(0.04);
    }
  });
});
