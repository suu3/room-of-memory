"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, Color, type ShaderMaterial } from "three";
import { ROOM_SHELL_BOUNDS } from "./layout";
import type { RoomPalette } from "./palette";

/**
 * 방 **바깥**.
 *
 * 방은 받침 위에 놓인 디오라마인데(RoomShell의 PLINTH), 그 받침 둘레가 통째로 비어
 * 있었다 — 캔버스 뒤에 깔린 CSS 그라디언트(.room-backdrop) 하나가 배경의 전부라,
 * 카메라를 돌리거나 타이틀에서 모형 전체를 잡을 때 방이 검은 판에 얹힌 것처럼 보였다.
 *
 * 여기 세우는 것은 **티끌 한 겹뿐이다** (OuterDrift). 방 밖에도 공기가 있다는 것만
 * 말하고 그친다.
 *
 * 받침 아래에 빛을 깔아 모형을 받쳐 보기도 했는데(고인 빛 원판, 그림자까지 넣은
 * 바닥판) 둘 다 뺐다. 바닥이 생기는 순간 이 방은 "허공에 뜬 기억"이 아니라 "무대에
 * 올린 모형"이 되고, 그 인상은 이 게임이 하려는 말과 다르다. 발밑이 없는 편이 낫다.
 *
 * 조명을 안 받는다. 방의 밝기는 진행에 따라 V자를 그리는데(ROOM_LIGHT_RAMP), 바깥까지
 * 같이 어두워지면 모형이 배경에 묻혀 실루엣을 잃는다 — 창밖 풍경을 meshBasicMaterial로만
 * 세운 것과 같은 이유다 (WindowView).
 */

/* -------------------------------------------------------------------- 둘레 티끌 */

const DRIFT_COUNT = 320;

/** 티끌이 도는 바깥 상자. 카메라가 잡는 범위보다 조금 넓게. */
const OUTER = {
  minX: -15,
  maxX: 17,
  minY: -5,
  maxY: 12,
  minZ: -13,
  maxZ: 15.5,
} as const;

/**
 * 방의 발자국 + 여유. 이 안쪽 x·z에 떨어진 티끌은 벽 위로만 올려 보낸다 —
 * 방 안에는 이미 창빛에 걸린 먼지가 있고(DustMotes), 무엇보다 **창을 통해 보인다**.
 * 창밖은 배경막이 맡은 그림이라 그 앞에 티끌이 지나가면 원경이 깨진다.
 */
const FOOTPRINT = {
  minX: ROOM_SHELL_BOUNDS.minX - 1.2,
  maxX: ROOM_SHELL_BOUNDS.maxX + 1.2,
  minZ: ROOM_SHELL_BOUNDS.minZ - 1.2,
  maxZ: ROOM_SHELL_BOUNDS.maxZ + 1.2,
} as const;

/** 벽 꼭대기(4.7) 위로 이만큼 띄운 뒤부터 티끌을 놓는다. */
const ABOVE_WALLS_Y = 6.2;

/** 화면상 지름(css px). 방 안 먼지보다 작고 흐리다 — 여기는 배경이지 주인공이 아니다. */
const DRIFT_MIN_SIZE = 1.2;
const DRIFT_SIZE_RANGE = 5.5;

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

interface DriftBuffers {
  positions: Float32Array;
  bands: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
  rises: Float32Array;
  sways: Float32Array;
  glows: Float32Array;
}

function createDrift(): DriftBuffers {
  const positions = new Float32Array(DRIFT_COUNT * 3);
  const bands = new Float32Array(DRIFT_COUNT * 2);
  const sizes = new Float32Array(DRIFT_COUNT);
  const phases = new Float32Array(DRIFT_COUNT);
  const rises = new Float32Array(DRIFT_COUNT);
  const sways = new Float32Array(DRIFT_COUNT);
  const glows = new Float32Array(DRIFT_COUNT);

  for (let index = 0; index < DRIFT_COUNT; index += 1) {
    const x = lerp(OUTER.minX, OUTER.maxX, Math.random());
    const z = lerp(OUTER.minZ, OUTER.maxZ, Math.random());

    const overRoom =
      x > FOOTPRINT.minX && x < FOOTPRINT.maxX && z > FOOTPRINT.minZ && z < FOOTPRINT.maxZ;
    // 방 위에 걸린 티끌은 벽보다 높은 구간만 돈다. 나머지는 상자 전체를 쓴다.
    const bandBottom = overRoom
      ? lerp(ABOVE_WALLS_Y, OUTER.maxY - 3, Math.random())
      : lerp(OUTER.minY, OUTER.maxY - 4, Math.random());
    const bandHeight = 3 + Math.random() * 5;

    positions[index * 3] = x;
    positions[index * 3 + 1] = lerp(bandBottom, bandBottom + bandHeight, Math.random());
    positions[index * 3 + 2] = z;

    bands[index * 2] = bandBottom;
    bands[index * 2 + 1] = bandHeight;

    // 세제곱 편향 — 대부분 작고 또렷하고 가끔 크고 흐리다 (DustMotes와 같은 분포).
    const bulk = Math.random() ** 3;
    sizes[index] = DRIFT_MIN_SIZE + bulk * DRIFT_SIZE_RANGE;
    glows[index] = lerp(0.85, 0.22, bulk);

    phases[index] = Math.random() * Math.PI * 2;
    // 방 안 먼지(0.035~0.11)보다 더 느리다. 멀리 있는 것은 천천히 움직여야 멀어 보인다.
    rises[index] = 0.02 + Math.random() * 0.055;
    sways[index] = 0.1 + Math.random() * 0.22;
  }

  return { positions, bands, sizes, phases, rises, sways, glows };
}

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;

  attribute vec2 aBand;   // x = 이 티끌이 도는 구간의 바닥, y = 구간 높이
  attribute float aSize;
  attribute float aPhase;
  attribute float aRise;
  attribute float aSway;
  attribute float aGlow;

  varying float vFade;
  varying float vGlow;

  void main() {
    vec3 pos = position;

    // 제 구간 안에서만 오른다. mod로 감으면 위로 빠져나간 티끌이 저절로 아래에서 돌아온다.
    float travel = mod(pos.y - aBand.x + uTime * aRise, aBand.y);
    pos.y = aBand.x + travel;

    pos.x += sin(uTime * aSway + aPhase) * 0.55;
    pos.z += cos(uTime * aSway * 0.63 + aPhase * 1.7) * 0.4;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    // 직교 카메라라 gl_PointSize가 곧 화면 픽셀이다. dpr을 곱해야 기기가 달라도 같다.
    gl_PointSize = aSize * uPixelRatio;

    // 구간 끝에서 스러진다 — 허공에서 툭 나타났다 툭 사라지면 낱알로 안 읽힌다.
    float edge = min(travel, aBand.y - travel) / (aBand.y * 0.28);
    float twinkle = 0.6 + 0.4 * sin(uTime * (0.3 + aSway * 1.4) + aPhase * 2.7);
    vFade = clamp(edge, 0.0, 1.0) * twinkle;
    vGlow = aGlow;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vFade;
  varying float vGlow;

  void main() {
    // 네모난 점을 동그란 빛으로. 넓은 헤일로 위에 작은 코어 (DustMotes와 같은 식).
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float halo = smoothstep(0.5, 0.0, dist);
    float core = smoothstep(0.24, 0.0, dist);
    float alpha = (halo * halo * 0.5 + core * 0.7) * vFade * vGlow * uOpacity;
    if (alpha <= 0.002) discard;

    gl_FragColor = vec4(uColor + core * 0.25, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function OuterDrift({ color, opacity }: { color: string; opacity: number }) {
  const materialRef = useRef<ShaderMaterial>(null);
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const drift = useMemo(createDrift, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 초기값 전용 — 이후 갱신은 아래 effect와 useFrame이 맡는다.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uColor: { value: new Color(color) },
      uOpacity: { value: opacity },
    }),
    [],
  );

  useEffect(() => {
    uniforms.uColor.value.set(color);
  }, [color, uniforms]);

  useEffect(() => {
    uniforms.uPixelRatio.value = pixelRatio;
  }, [pixelRatio, uniforms]);

  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    // 상자 밖으로 나가는 낱알이 없으므로 절두체 컬링을 켜 두면 통째로 사라지는 순간이 있다.
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[drift.positions, 3]} />
        <bufferAttribute attach="attributes-aBand" args={[drift.bands, 2]} />
        <bufferAttribute attach="attributes-aSize" args={[drift.sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[drift.phases, 1]} />
        <bufferAttribute attach="attributes-aRise" args={[drift.rises, 1]} />
        <bufferAttribute attach="attributes-aSway" args={[drift.sways, 1]} />
        <bufferAttribute attach="attributes-aGlow" args={[drift.glows, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

/** 둘레 티끌의 밝기. 방 안 먼지보다 옅다 — 배경이 주인공보다 밝으면 안 된다. */
const DRIFT_OPACITY = 0.55;

export function RoomSurroundings({ palette }: { palette: RoomPalette }) {
  return (
    <group name="room-surroundings">
      <OuterDrift color={palette.memory} opacity={DRIFT_OPACITY} />
    </group>
  );
}
