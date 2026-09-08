import type { Intersection, Object3D } from "three";

/**
 * 보이지 않는 오브젝트는 클릭도 받지 않는다.
 *
 * three의 레이캐스트도 r3f의 이벤트도 `visible`을 보지 않는다 — 숨긴 그룹의 메쉬도
 * 광선에 걸린다. 방과 거실은 한 번에 하나만 보이는데(MemoryRoomScene), 방은 카메라와
 * 거실 사이에 있어서 거실 바닥을 누르면 숨은 방의 야구공·기억 판정 구가 먼저 맞고
 * 그쪽 인터랙션이 돈다. 맞은 것 가운데 조상까지 전부 보이는 것만 남긴다.
 */
export function isVisibleInTree(object: Object3D): boolean {
  for (let node: Object3D | null = object; node !== null; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}

/** r3f 이벤트 필터(`setEvents({ filter })`)에 그대로 꽂는다. */
export function visibleHitsOnly<T extends Intersection>(hits: T[]): T[] {
  return hits.filter((hit) => isVisibleInTree(hit.object));
}
