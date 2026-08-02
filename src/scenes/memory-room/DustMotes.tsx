"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, type BufferAttribute, type Points } from "three";
import { ROOM_SHELL_BOUNDS } from "./layout";

/**
 * 방 안을 떠도는 먼지 — 창으로 든 빛에 반짝이는 입자.
 * 어두운 디오라마에 온기와 공기감을 주는 용도라, 형체를 알아볼 만큼 밝히지 않는다.
 */
const MOTE_COUNT = 90;
const FIELD_MIN_Y = 0.35;
const FIELD_MAX_Y = 3.9;
/** 위로 떠오르는 속도(월드 유닛/초). 아주 느려야 먼지로 읽힌다. */
const RISE_SPEED = 0.085;
/** 좌우로 흔들리는 폭과 주기 — 전부 같은 속도로 뜨면 비처럼 보인다. */
const SWAY_AMPLITUDE = 0.22;

interface MoteSeed {
  swayPhase: number;
  swaySpeed: number;
  riseScale: number;
}

export function DustMotes({ color, opacity }: { color: string; opacity: number }) {
  const pointsRef = useRef<Points>(null);

  // 위치 버퍼와 시드는 한 번만 만든다 — useFrame 안에서 배열/객체를 새로 만들지 않는다.
  const { positions, seeds, baseX, baseZ } = useMemo(() => {
    const positionArray = new Float32Array(MOTE_COUNT * 3);
    const seedList: MoteSeed[] = [];
    const xs = new Float32Array(MOTE_COUNT);
    const zs = new Float32Array(MOTE_COUNT);
    const spanX = ROOM_SHELL_BOUNDS.maxX - ROOM_SHELL_BOUNDS.minX;
    const spanZ = ROOM_SHELL_BOUNDS.maxZ - ROOM_SHELL_BOUNDS.minZ;

    for (let index = 0; index < MOTE_COUNT; index += 1) {
      const x = ROOM_SHELL_BOUNDS.minX + Math.random() * spanX;
      const z = ROOM_SHELL_BOUNDS.minZ + Math.random() * spanZ;
      xs[index] = x;
      zs[index] = z;
      positionArray[index * 3] = x;
      positionArray[index * 3 + 1] = FIELD_MIN_Y + Math.random() * (FIELD_MAX_Y - FIELD_MIN_Y);
      positionArray[index * 3 + 2] = z;
      seedList.push({
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.25 + Math.random() * 0.4,
        riseScale: 0.55 + Math.random() * 0.9,
      });
    }

    return { positions: positionArray, seeds: seedList, baseX: xs, baseZ: zs };
  }, []);

  useFrame((state, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    const attribute = points.geometry.getAttribute("position") as BufferAttribute;
    const array = attribute.array as Float32Array;
    const elapsed = state.clock.elapsedTime;

    for (let index = 0; index < MOTE_COUNT; index += 1) {
      const seed = seeds[index];
      const offset = index * 3;

      let y = array[offset + 1] + RISE_SPEED * seed.riseScale * delta;
      // 천장에 닿으면 바닥에서 다시 올라온다
      if (y > FIELD_MAX_Y) y = FIELD_MIN_Y;
      array[offset + 1] = y;

      const sway = Math.sin(elapsed * seed.swaySpeed + seed.swayPhase) * SWAY_AMPLITUDE;
      array[offset] = baseX[index] + sway;
      array[offset + 2] = baseZ[index] + sway * 0.6;
    }

    attribute.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.055}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
