import type { Material, Mesh, Object3D } from "three";

/**
 * CulledWall이 벽 한 면의 재질을 다루는 법.
 *
 * 컴포넌트에서 떼어낸 이유는 하나다 — 늦게 씬 그래프에 붙는 메쉬(Suspense로 들어오는
 * glb)까지 잡히는지를 렌더러 없이 확인할 수 있어야 해서다.
 */

/** 이 아래로 내려가면 그룹을 통째로 끈다. 안 보이는 동안에는 재질을 만지지 않는다. */
export const WALL_HIDDEN_OPACITY = 0.02;

/**
 * 이만큼도 안 움직인 프레임에는 다시 칠하지 않는다.
 * 멈춰 선 벽에서 트래버스를 걷어내는 기준이자, damp가 목표에 영영 못 닿는 걸
 * 끊어 주는 기준이기도 하다.
 */
export const WALL_OPACITY_EPSILON = 0.001;

function forEachMaterial(root: Object3D, visit: (material: Material) => void): void {
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) visit(material);
  });
}

function markTransparent(material: Material): void {
  if (material.transparent) return;
  material.transparent = true;
  material.needsUpdate = true;
}

/**
 * transparent만 미리 켜 둔다. 이 플래그를 바꾸면 셰이더가 다시 컴파일되므로,
 * 벽이 스러지기 시작하는 첫 프레임에 한꺼번에 몰리면 눈에 띄게 끊긴다.
 */
export function prepareWallMaterials(root: Object3D): void {
  forEachMaterial(root, markTransparent);
}

/**
 * 벽 한 면과 거기 붙은 것들의 불투명도.
 *
 * 재질 목록을 캐시해 두지 않고 매번 트래버스한다. 마운트 시점 목록만 들고 있으면
 * 나중에 들어오는 glb가 벽만 스러진 자리에 그대로 떠 버린다 — 그 소품은 늦게
 * 붙었다는 이유만으로 벽에서 떨어져 나오는 셈이다.
 *
 * 대신 값이 실제로 움직이는 프레임에만 부른다(CulledWall). 벽이 서 있거나 완전히
 * 걷힌 채 멈춰 있는 대부분의 시간에는 트래버스가 아예 일어나지 않는다.
 */
export function applyWallOpacity(root: Object3D, opacity: number): void {
  forEachMaterial(root, (material) => {
    markTransparent(material);
    material.opacity = opacity;
  });
}
