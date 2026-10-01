"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { Group } from "three";
import { approach } from "../memory/memory-motion";
import { ROOM_DOOR_LEAF } from "../world/layout";

/** 문짝이 목표 각도를 따라가는 빠르기. 1초 남짓이면 다 젖혀진다. */
const SWING_LAMBDA = 4;

/**
 * 경첩을 축으로 젖혀지는 문짝 하나 (방문 · 화장실 · 안방). 누르는 순간 확 열리지 않고
 * 판이 저쪽으로 젖혀진다. 방문만 즉시 열려서 같은 집의 문이 둘로 갈렸었다.
 *
 * 처음 그릴 때는 지금 상태에서 시작한다. 이어하기로 들어왔을 때 이미 열린 문이 닫혔다가
 * 다시 젖혀지면, 방금 연 것처럼 보인다. `rotation`은 경첩 그룹에 한 번만 건다.
 */
export function useDoorSwing(open: boolean) {
  const leafRef = useRef<Group>(null);
  const target = open ? -ROOM_DOOR_LEAF.openAngle : 0;
  const [initialRotation] = useState<[number, number, number]>(() => [0, target, 0]);

  useFrame((_, delta) => {
    const leaf = leafRef.current;
    if (!leaf) return;
    leaf.rotation.y = approach(leaf.rotation.y, target, SWING_LAMBDA, delta);
  });

  return { leafRef, initialRotation };
}
