"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { Object3D } from "three";

/** 이 오브젝트와 조상 중 하나라도 보이지 않으면 거짓. */
function inVisibleChain(object: Object3D | null): boolean {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}

/**
 * 보이지 않는 오브젝트는 포인터 판정에서 뺀다.
 *
 * 한 번에 한 방만 보인다 (MemoryRoomScene): 다른 공간은 `visible={false}`로 숨는데,
 * r3f의 레이캐스트는 보이지 않는 오브젝트도 맞힌다. 방에서 서쪽 벽을 누르면 광선이 벽을
 * 지나 숨은 거실의 기억까지 닿아, 안 보이는 물건이 반응하고(대사·조사가 시작되고)
 * 호버 소리가 났다. 맞힌 것 중 보이는 것만 남긴다.
 */
export function VisibleHitsOnly() {
  const setEvents = useThree((state) => state.setEvents);
  useEffect(() => {
    setEvents({ filter: (hits) => hits.filter((hit) => inVisibleChain(hit.object)) });
    return () => setEvents({ filter: undefined });
  }, [setEvents]);
  return null;
}
