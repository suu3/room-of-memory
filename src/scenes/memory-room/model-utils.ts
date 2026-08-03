import { Box3, type Object3D, Vector3 } from "three";

const bounds = new Box3();
const center = new Vector3();

/**
 * 모델의 x·z 중심을 원점으로 옮긴다. y는 건드리지 않는다.
 *
 * 가구킷 glb는 원점이 물건의 한쪽 모서리에 있다 (x는 0~w, z는 -d~0).
 * 그대로 놓으면 좌표를 준 자리에서 반쪽만큼 밀려 앉는다 — 러그가 침대 밑으로
 * 밀려 들어가고 책상 소품이 상판 밖으로 나갔던 원인.
 *
 * y를 맞추지 않는 건 이 모델들이 이미 밑면을 y=0에 두고 있어서다. 덕분에
 * "놓을 면의 높이를 position.y로 준다"는 규칙이 그대로 유지된다.
 */
export function centerModelXZ(object: Object3D): Object3D {
  bounds.setFromObject(object);
  if (bounds.isEmpty()) return object;
  bounds.getCenter(center);
  for (const child of object.children) {
    child.position.x -= center.x;
    child.position.z -= center.z;
  }
  return object;
}
