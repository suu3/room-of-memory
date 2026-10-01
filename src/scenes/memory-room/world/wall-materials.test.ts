import { Group, Mesh, MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import { applyWallOpacity, prepareWallMaterials } from "./wall-materials";

function wallMesh(): Mesh {
  return new Mesh(undefined, new MeshStandardMaterial());
}

function materialsOf(root: Group): MeshStandardMaterial[] {
  const found: MeshStandardMaterial[] = [];
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) found.push(material as MeshStandardMaterial);
  });
  return found;
}

describe("wall materials", () => {
  it("fades the wall and everything nested under it", () => {
    const wall = new Group();
    const poster = new Group();
    poster.add(wallMesh());
    wall.add(wallMesh(), poster);

    applyWallOpacity(wall, 0.4);

    for (const material of materialsOf(wall)) {
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBeCloseTo(0.4, 5);
    }
  });

  it("fades a mesh that arrives after the wall was already faded", () => {
    // Suspense로 들어오는 glb가 이 경우다. 마운트 시점 재질만 들고 있으면
    // 벽이 걷힌 자리에 소품만 그대로 떠 있는다.
    const wall = new Group();
    wall.add(wallMesh());
    prepareWallMaterials(wall);
    applyWallOpacity(wall, 0.3);

    const late = wallMesh();
    wall.add(late);
    applyWallOpacity(wall, 0.2);

    const lateMaterial = late.material as MeshStandardMaterial;
    expect(lateMaterial.transparent).toBe(true);
    expect(lateMaterial.opacity).toBeCloseTo(0.2, 5);
  });

  it("handles meshes with more than one material", () => {
    const wall = new Group();
    const mesh = new Mesh(undefined, [new MeshStandardMaterial(), new MeshStandardMaterial()]);
    wall.add(mesh);

    applyWallOpacity(wall, 0.5);

    for (const material of mesh.material as MeshStandardMaterial[]) {
      expect(material.opacity).toBeCloseTo(0.5, 5);
    }
  });

  it("turns transparency on without touching opacity", () => {
    // 마운트 직후에 불투명도까지 건드리면 서 있어야 할 벽이 한 프레임 비친다
    const wall = new Group();
    wall.add(wallMesh());

    prepareWallMaterials(wall);

    for (const material of materialsOf(wall)) {
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(1);
    }
  });

  it("only recompiles a material the first time it turns transparent", () => {
    // 매 프레임 needsUpdate를 켜면 벽이 스러지는 내내 셰이더를 다시 컴파일한다.
    // three는 needsUpdate에 setter만 있어서, 실제로 올라간 건 version으로 본다.
    const wall = new Group();
    const mesh = wallMesh();
    wall.add(mesh);
    const material = mesh.material as MeshStandardMaterial;

    prepareWallMaterials(wall);
    const compiledVersion = material.version;
    applyWallOpacity(wall, 0.6);
    applyWallOpacity(wall, 0.5);

    expect(compiledVersion).toBeGreaterThan(0);
    expect(material.version).toBe(compiledVersion);
  });
});
