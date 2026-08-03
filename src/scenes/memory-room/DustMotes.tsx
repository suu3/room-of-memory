"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, Color, MathUtils, type ShaderMaterial } from "three";
import { MEMORY_PLACEMENTS } from "./layout";

/**
 * 창으로 든 빛에 걸린 먼지.
 *
 * 빛줄기 볼륨 안에만 둔다. 방 밖 허공에 균일하게 뿌리면 "별이 뜬 우주"가 되고,
 * 방 안 여기저기 흩어두면 빛에 걸린 먼지가 아니라 그냥 떠다니는 점으로 읽힌다.
 * 먼지는 빛 자체가 아니라 빛 속의 반짝임이므로, 빛줄기 밖으로 나가면 안 된다.
 *
 * 그림은 셰이더가 전부 맡는다. 기본 pointsMaterial은 점을 네모난 단색 픽셀로 찍어서
 * 결국 "사각형 점"으로 보였다 — 먼지는 초점이 안 맞은 빛이라, 넓게 번지는 헤일로 위에
 * 작고 밝은 코어를 얹어야 반짝임으로 읽힌다. 움직임(상승·흔들림·명멸)도 정점 셰이더
 * 안에서 시간의 함수로 풀어, 매 프레임 CPU가 좌표 버퍼를 고쳐 쓰지 않는다.
 */
const MOTE_COUNT = 240;

/**
 * 화면상 먼지 지름(css px)의 하한과, 세제곱 분포로 뽑는 추가분.
 * 대부분은 작고 또렷한 반짝임이고 가끔 크고 흐릿한 보케가 섞인다 —
 * 크기가 다 같으면 눈이 "패턴"으로 읽어버려서 먼지처럼 안 보인다.
 */
const MOTE_MIN_SIZE = 1.8;
const MOTE_SIZE_RANGE = 9;

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

/** 상승 속도(월드 유닛/초)의 하한과 폭. 낱알마다 달라야 줄 맞춰 오르지 않는다. */
const RISE_MIN = 0.035;
const RISE_RANGE = 0.075;
const SWAY_AMPLITUDE = 0.2;

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** 세제곱 편향 — 빛줄기 가운데가 촘촘하고 가장자리로 갈수록 성기다. */
function centerBiased(): number {
  const raw = Math.random() * 2 - 1;
  return raw ** 3;
}

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uSway;
  uniform float uPixelRatio;

  attribute vec2 aBand;   // x = 이 먼지가 오르내리는 구간의 바닥, y = 구간 높이
  attribute float aSize;  // 화면상 지름(css px)
  attribute float aPhase;
  attribute float aDrift; // 좌우 흔들림 속도
  attribute float aRise;  // 상승 속도
  attribute float aGlow;  // 밝기 — 큰 알갱이일수록 흐리다(보케)

  varying float vFade;
  varying float vGlow;

  void main() {
    vec3 pos = position;

    // 제 구간 안에서만 오르내린다. mod로 감아 돌리면 위로 빠져나간 먼지가
    // 저절로 아래에서 다시 올라온다 — 빛줄기 밖으로 새지 않는다.
    float travel = mod(pos.y - aBand.x + uTime * aRise, aBand.y);
    pos.y = aBand.x + travel;

    // 주파수가 다른 두 흔들림을 겹친다. 하나만 쓰면 전부 같은 박자로 흔들려 기계적이다.
    pos.x += sin(uTime * aDrift + aPhase) * uSway;
    pos.z += cos(uTime * aDrift * 0.61 + aPhase * 1.7) * uSway * 0.55;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    // 직교 카메라에서는 gl_PointSize가 곧 화면 픽셀이다. 다만 단위가 드로잉 버퍼
    // 픽셀이라 dpr을 곱해야 기기가 달라져도 같은 크기로 보인다.
    gl_PointSize = aSize * uPixelRatio;

    // 구간 끝에서 서서히 꺼진다 — 안 그러면 먼지가 허공에서 툭 나타났다 툭 사라진다.
    float edge = min(travel, aBand.y - travel) / (aBand.y * 0.3);
    float twinkle = 0.55 + 0.45 * sin(uTime * (0.7 + aDrift * 2.0) + aPhase * 3.1);
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
    // 네모난 점을 동그란 빛으로. 넓게 번지는 헤일로 위에 작고 흰 코어를 얹으면
    // 초점이 안 맞은 반짝임처럼 읽힌다.
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float halo = smoothstep(0.5, 0.0, dist);
    float core = smoothstep(0.22, 0.0, dist);
    float alpha = (halo * halo * 0.55 + core * 0.8) * vFade * vGlow * uOpacity;
    if (alpha <= 0.002) discard;

    gl_FragColor = vec4(uColor + core * 0.3, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface MoteBuffers {
  positions: Float32Array;
  bands: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
  drifts: Float32Array;
  rises: Float32Array;
  glows: Float32Array;
}

function createMotes(): MoteBuffers {
  const positions = new Float32Array(MOTE_COUNT * 3);
  const bands = new Float32Array(MOTE_COUNT * 2);
  const sizes = new Float32Array(MOTE_COUNT);
  const phases = new Float32Array(MOTE_COUNT);
  const drifts = new Float32Array(MOTE_COUNT);
  const rises = new Float32Array(MOTE_COUNT);
  const glows = new Float32Array(MOTE_COUNT);

  for (let index = 0; index < MOTE_COUNT; index += 1) {
    const t = Math.random();
    const centerY = lerp(SHAFT.startY, SHAFT.endY, t);
    const minY = Math.max(0.15, centerY - SHAFT.halfThickness);
    const maxY = centerY + SHAFT.halfThickness;

    positions[index * 3] =
      WINDOW[0] + centerBiased() * lerp(SHAFT.startHalfWidth, SHAFT.endHalfWidth, t);
    positions[index * 3 + 1] = lerp(minY, maxY, Math.random());
    positions[index * 3 + 2] = lerp(SHAFT.startZ, SHAFT.endZ, t);

    bands[index * 2] = minY;
    bands[index * 2 + 1] = maxY - minY;

    // 세제곱이라 큰 알갱이는 드물게 나온다. 큰 만큼 흐려야 보케로 읽힌다.
    const bulk = Math.random() ** 3;
    sizes[index] = MOTE_MIN_SIZE + bulk * MOTE_SIZE_RANGE;
    glows[index] = lerp(1, 0.32, bulk);

    phases[index] = Math.random() * Math.PI * 2;
    drifts[index] = 0.22 + Math.random() * 0.35;
    rises[index] = RISE_MIN + Math.random() * RISE_RANGE;
  }

  return { positions, bands, sizes, phases, drifts, rises, glows };
}

export function DustMotes({ color, opacity }: { color: string; opacity: number }) {
  const materialRef = useRef<ShaderMaterial>(null);
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const motes = useMemo(createMotes, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 초기값 전용 — 이후 갱신은 아래 effect와 useFrame이 맡는다.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSway: { value: SWAY_AMPLITUDE },
      uPixelRatio: { value: pixelRatio },
      uColor: { value: new Color(color) },
      // 첫 프레임부터 제 밝기로 시작한다 — 커튼이 이미 열린 채 들어오는 경우가 있다.
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

  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    // 커튼을 여닫을 때 먼지가 툭 켜지지 않게 밝기만 따라붙인다.
    material.uniforms.uOpacity.value = MathUtils.damp(
      material.uniforms.uOpacity.value,
      opacity,
      3.5,
      delta,
    );
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[motes.positions, 3]} />
        <bufferAttribute attach="attributes-aBand" args={[motes.bands, 2]} />
        <bufferAttribute attach="attributes-aSize" args={[motes.sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[motes.phases, 1]} />
        <bufferAttribute attach="attributes-aDrift" args={[motes.drifts, 1]} />
        <bufferAttribute attach="attributes-aRise" args={[motes.rises, 1]} />
        <bufferAttribute attach="attributes-aGlow" args={[motes.glows, 1]} />
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
