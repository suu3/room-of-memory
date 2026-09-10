"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { useMemoryRoomStore } from "@/store/memory-room";

/** 링이 한 번 숨쉬는 주기(초)와 크기의 폭. */
const PULSE_PERIOD_S = 1.1;
const PULSE_SCALE = 0.18;
/** 마커가 뜨고 지는 속도. */
const FADE_LAMBDA = 9;

/**
 * 바닥을 눌러 걸어가는 목적지의 링. 걷는 동안만 바닥에 서 있다가, 도착하거나
 * 다른 입력이 끼어들어 목표가 지워지면 사라진다.
 *
 * 없으면 클릭이 먹었는지 알 길이 없다. 특히 길을 돌아가는 경우(pathfind) 몸이 먼저
 * 반대쪽으로 움직여서, 표식이 없으면 잘못 눌린 것으로 읽힌다.
 * 글로우 루트 밖이라 아웃라인이 붙지 않고, 클릭도 받지 않는다.
 */
export function WalkMarker({ color }: { color: string }) {
  const walkTarget = useMemoryRoomStore((state) => state.walkTarget);
  const groupRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);
  const opacityRef = useRef(0);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const material = materialRef.current;
    const ring = ringRef.current;
    if (!group || !material || !ring) return;
    const goal = walkTarget ? 1 : 0;
    opacityRef.current += (goal - opacityRef.current) * (1 - Math.exp(-FADE_LAMBDA * delta));
    material.opacity = opacityRef.current * 0.85;
    group.visible = opacityRef.current > 0.02;
    const pulse =
      1 + PULSE_SCALE * Math.sin((state.clock.elapsedTime / PULSE_PERIOD_S) * Math.PI * 2);
    ring.scale.setScalar(pulse);
  });

  return (
    <group
      ref={groupRef}
      position={[walkTarget?.x ?? 0, 0.015, walkTarget?.z ?? 0]}
      visible={false}
    >
      <mesh ref={ringRef} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.2, 0.28, 32]} />
        <meshBasicMaterial
          ref={materialRef}
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.06, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} depthWrite={false} />
      </mesh>
    </group>
  );
}
