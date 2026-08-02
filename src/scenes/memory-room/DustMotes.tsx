"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, type BufferAttribute, type Points } from "three";
import { MEMORY_PLACEMENTS } from "./layout";

/**
 * 창으로 든 빛에 걸린 먼지.
 *
 * 빛줄기 볼륨 안에만 둔다. 방 밖 허공에 균일하게 뿌리면 "별이 뜬 우주"가 되고,
 * 방 안 여기저기 흩어두면 빛에 걸린 먼지가 아니라 그냥 떠다니는 점으로 읽힌다.
 * 먼지는 빛 자체가 아니라 빛 속의 반짝임이므로, 빛줄기 밖으로 나가면 안 된다.
 */
const MOTE_COUNT = 170;

/** 화면상 먼지 지름(px). 직교 카메라라 월드 크기가 아니라 픽셀로 지정된다. */
const MOTE_PIXEL_SIZE = 2.6;

const WINDOW = MEMORY_PLACEMENTS.window.position;

/**
 * 빛줄기 — 창(z≈-3.9)에서 방 안(+Z)으로 비스듬히 내려꽂힌다.
 * t=0이 창가, t=1이 바닥에 닿는 끝.
 */
const SHAFT = {
  startZ: WINDOW[2] + 0.6,
  endZ: 2.4,
  startY: WINDOW[1] + 0.35,
  endY: 0.25,
  startHalfWidth: 1.15,
  endHalfWidth: 2.5,
  halfThickness: 0.8,
} as const;

const RISE_SPEED = 0.075;
const SWAY_AMPLITUDE = 0.18;

interface MoteSeed {
  swayPhase: number;
  swaySpeed: number;
  riseScale: number;
  minY: number;
  maxY: number;
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** 세제곱 편향 — 빛줄기 가운데가 촘촘하고 가장자리로 갈수록 성기다. */
function centerBiased(): number {
  const raw = Math.random() * 2 - 1;
  return raw ** 3;
}

export function DustMotes({ color, opacity }: { color: string; opacity: number }) {
  const pointsRef = useRef<Points>(null);

  // 위치 버퍼와 시드는 한 번만 만든다 — useFrame 안에서 배열/객체를 새로 만들지 않는다.
  const { positions, seeds, baseX, baseZ } = useMemo(() => {
    const positionArray = new Float32Array(MOTE_COUNT * 3);
    const seedList: MoteSeed[] = [];
    const xs = new Float32Array(MOTE_COUNT);
    const zs = new Float32Array(MOTE_COUNT);

    for (let index = 0; index < MOTE_COUNT; index += 1) {
      const t = Math.random();
      const z = lerp(SHAFT.startZ, SHAFT.endZ, t);
      const x = WINDOW[0] + centerBiased() * lerp(SHAFT.startHalfWidth, SHAFT.endHalfWidth, t);
      const centerY = lerp(SHAFT.startY, SHAFT.endY, t);
      const minY = Math.max(0.15, centerY - SHAFT.halfThickness);
      const maxY = centerY + SHAFT.halfThickness;

      xs[index] = x;
      zs[index] = z;
      positionArray[index * 3] = x;
      positionArray[index * 3 + 1] = lerp(minY, maxY, Math.random());
      positionArray[index * 3 + 2] = z;
      seedList.push({
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.22 + Math.random() * 0.35,
        riseScale: 0.5 + Math.random() * 0.9,
        minY,
        maxY,
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
      // 제 구간 위로 벗어나면 아래에서 다시 올라온다 — 빛줄기 밖으로 새지 않는다
      if (y > seed.maxY) y = seed.minY;
      array[offset + 1] = y;

      const sway = Math.sin(elapsed * seed.swaySpeed + seed.swayPhase) * SWAY_AMPLITUDE;
      array[offset] = baseX[index] + sway;
      array[offset + 2] = baseZ[index] + sway * 0.5;
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
        // 직교 카메라에서는 three의 points 셰이더가 sizeAttenuation 분기를 타지 않는다
        // (isPerspectiveMatrix가 false). 그래서 size는 월드 유닛이 아니라 픽셀로 쓰인다.
        size={MOTE_PIXEL_SIZE}
        sizeAttenuation={false}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
