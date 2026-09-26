"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { MathUtils, Plane, type PointLight, Vector3 } from "three";
import { LANTERN_HEIGHT, lanternIntensity, lanternReach } from "./lantern-light";
import { usePlayerPosition } from "./use-near-player";

/** 바닥 평면. 커서의 광선이 여기 닿는 자리에 등이 선다 (MemoryRoomScene의 걷기 판정과 같은 면). */
const FLOOR_PLANE = new Plane(new Vector3(0, 1, 0), 0);
const hit = new Vector3();
/** 등이 손을 따라가는 속도. 커서보다 조금 늦어야 손에 든 것으로 읽힌다. */
const FOLLOW_LAMBDA = 7;
/** 세기·거리가 밝기를 따라가는 속도. 조명 damp와 같은 호흡 (LIGHT_LAMBDA). */
const LEVEL_LAMBDA = 2.2;

/**
 * 손 가까이만 비추는 등 (docs/visual-experiments.md 6장). 수치는 lantern-light.ts.
 *
 * 마우스 기기에서는 커서가 바닥에 닿는 자리, 손가락 기기에서는 몸의 자리다. 커서가 캔버스
 * 밖에 있으면(r3f의 pointer는 마지막 자리에 멈춘다) 광선이 바닥을 못 만날 때만 몸으로
 * 돌아온다. 1인칭 구간에서는 꺼 둔다(enabled): 그 구간은 빛 하나만 보여야 한다.
 */
export function Lantern({
  enabled,
  level,
  color,
  followCursor,
}: {
  /** 켤 수 있는 구간인가. 아니면 세기만 0으로 내려간다 (광원은 늘 세워 둔다). */
  enabled: boolean;
  /** 방 밝기 (0~1). 문턱(LANTERN_THRESHOLD) 아래에서만 켜진다. */
  level: number;
  color: string;
  /** 커서를 따라가는가. 손가락 기기에서는 몸을 따라간다. */
  followCursor: boolean;
}) {
  const lightRef = useRef<PointLight>(null);
  const player = usePlayerPosition();

  useFrame((state, delta) => {
    const light = lightRef.current;
    if (!light) return;
    const goalIntensity = enabled ? lanternIntensity(level) : 0;
    light.intensity = MathUtils.damp(light.intensity, goalIntensity, LEVEL_LAMBDA, delta);
    light.distance = MathUtils.damp(light.distance, lanternReach(level), LEVEL_LAMBDA, delta);
    /*
     * 꺼진 등도 광원으로 남겨 둔다 (visible을 끄지 않는다). 광원 수가 바뀌면 화면의 모든
     * 재질이 재컴파일돼 멈칫한다. 세기 0인 광원 하나의 값보다 그 멈칫이 훨씬 비싸다.
     */
    if (light.intensity <= 0.02) return;

    let x = player.current.x;
    let z = player.current.z;
    if (followCursor) {
      state.raycaster.setFromCamera(state.pointer, state.camera);
      if (state.raycaster.ray.intersectPlane(FLOOR_PLANE, hit)) {
        x = hit.x;
        z = hit.z;
      }
    }
    if (Number.isNaN(x) || Number.isNaN(z)) return;
    light.position.x = MathUtils.damp(light.position.x, x, FOLLOW_LAMBDA, delta);
    light.position.z = MathUtils.damp(light.position.z, z, FOLLOW_LAMBDA, delta);
  });

  return (
    <pointLight
      ref={lightRef}
      position={[0, LANTERN_HEIGHT, 0]}
      color={color}
      intensity={0}
      distance={lanternReach(level)}
      decay={2}
    />
  );
}
