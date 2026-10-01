"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, Color, type Points, type ShaderMaterial, Vector3 } from "three";
import type { MemoryId } from "@/data/memory-room";
import { useMemoryRoomStore } from "@/store/memory-room";
import { MEMORY_PLACEMENTS } from "../world/layout";

/**
 * 기억을 되찾는 순간 물건에서 솟는 금빛 티끌.
 *
 * 수첩에 한 줄이 적히는 사건인데 화면에서는 소리(collect)와 HUD 숫자만 바뀌었다.
 * 물건 자리에서 티끌이 터져 나와 잠깐 흩어졌다가, 화면 오른쪽 위(수첩 손잡이가 있는
 * 쪽)로 쓸려 가며 사라진다. "기억이 물건에서 떨어져 나와 수첩으로 갔다"는 그림이다.
 *
 * 먼지(DustMotes)와 같은 재질·같은 셰이더 문법이라 방의 공기와 한 종류로 읽힌다.
 * 움직임은 전부 정점 셰이더 안에서 시간의 함수로 푼다. CPU는 프레임마다 uTime 하나만
 * 올린다 (.claude/rules/r3f.md).
 */
const BURST_COUNT = 140;
/** 폭발이 끝나는 시간(초). 그 뒤에는 그리지 않는다. */
const BURST_DURATION = 1.7;
/** 처음 흩어지는 반경(월드 유닛)과 쓸려 가는 거리. */
const BURST_SPREAD = 0.75;
const BURST_PULL = 2.8;
const MOTE_MIN_SIZE = 2;
const MOTE_SIZE_RANGE = 7;

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;      // 폭발 뒤 흐른 시간(초)
  uniform float uDuration;
  uniform vec3 uOrigin;     // 물건의 자리
  uniform vec3 uPull;       // 쓸려 가는 방향 (월드)
  uniform float uPixelRatio;

  attribute vec3 aDir;      // 흩어지는 방향 (위로 치우친 단위 벡터)
  attribute float aSize;
  attribute float aSeed;

  varying float vFade;
  varying float vGlow;

  void main() {
    float u = clamp(uTime / uDuration, 0.0, 1.0);
    // 터져 나오는 구간: 빠르게 나갔다가 서고(ease-out), 낱알마다 조금씩 늦게 출발한다
    float delay = aSeed * 0.12;
    float scatter = 1.0 - pow(1.0 - clamp((u - delay) * 2.2, 0.0, 1.0), 3.0);
    // 쓸려 가는 구간: 뒤로 갈수록 세게 끌려간다
    float pull = pow(smoothstep(0.3, 1.0, u), 2.0);
    vec3 pos = uOrigin
      + aDir * scatter * BURST_SPREAD * (0.6 + 0.4 * aSeed)
      + vec3(0.0, 0.35 * u, 0.0)
      + uPull * pull * BURST_PULL * (0.7 + 0.3 * aSeed);
    // 쓸려 가는 동안 살짝 흔들린다. 곧게 날면 입자가 아니라 선이다
    pos.x += sin(uTime * 6.0 + aSeed * 12.0) * 0.04 * pull;
    pos.y += cos(uTime * 5.0 + aSeed * 9.0) * 0.04 * pull;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    // 터질 때 크고, 쓸려 가며 작아진다
    gl_PointSize = aSize * uPixelRatio * (1.0 - 0.6 * pull);

    vFade = smoothstep(0.0, 0.06, u) * (1.0 - smoothstep(0.62, 1.0, u));
    vGlow = 0.55 + 0.45 * aSeed;
  }
`
  .replace(/BURST_SPREAD/g, BURST_SPREAD.toFixed(2))
  .replace(/BURST_PULL/g, BURST_PULL.toFixed(2));

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  varying float vFade;
  varying float vGlow;

  void main() {
    float dist = length(gl_PointCoord - 0.5);
    if (dist > 0.5) discard;
    float halo = smoothstep(0.5, 0.0, dist);
    float core = smoothstep(0.22, 0.0, dist);
    float alpha = (halo * halo * 0.6 + core * 0.9) * vFade * vGlow;
    if (alpha <= 0.002) discard;
    gl_FragColor = vec4(uColor + core * 0.35, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createBurst() {
  const dirs = new Float32Array(BURST_COUNT * 3);
  const sizes = new Float32Array(BURST_COUNT);
  const seeds = new Float32Array(BURST_COUNT);
  const positions = new Float32Array(BURST_COUNT * 3);
  for (let index = 0; index < BURST_COUNT; index++) {
    // 위로 치우친 반구: 바닥으로 파고드는 티끌은 없다
    const theta = Math.random() * Math.PI * 2;
    const lift = 0.15 + Math.random() * 0.85;
    const ring = Math.sqrt(1 - lift * lift);
    dirs[index * 3] = Math.cos(theta) * ring;
    dirs[index * 3 + 1] = lift;
    dirs[index * 3 + 2] = Math.sin(theta) * ring;
    sizes[index] = MOTE_MIN_SIZE + Math.random() ** 3 * MOTE_SIZE_RANGE;
    seeds[index] = Math.random();
  }
  return { dirs, sizes, seeds, positions };
}

const pull = new Vector3();
const cameraRight = new Vector3();
const cameraUp = new Vector3();

/** 새로 적힌 기억. 1바퀴는 collected, 2바퀴는 revisited에 붙는다. */
export function newlyRecorded(
  next: readonly MemoryId[],
  previous: readonly MemoryId[],
): MemoryId | null {
  if (next.length <= previous.length) return null;
  return next.find((id) => !previous.includes(id)) ?? null;
}

export function MemoryBurst({ color }: { color: string }) {
  const pointsRef = useRef<Points>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const camera = useThree((state) => state.camera);
  const burst = useMemo(createBurst, []);
  /** 폭발 뒤 흐른 시간. 끝나면 duration보다 크게 두고 그리지 않는다. */
  const elapsed = useRef(BURST_DURATION + 1);
  /*
   * r3f는 uniforms 프롭을 복제해 머티리얼에 넣는다. 이 객체를 고쳐도 화면에는 안
   * 닿으므로 초기값으로만 쓰고, 이후 갱신은 전부 materialRef.current.uniforms를 만진다.
   * (먼지가 materialRef를 거치는 이유와 같다.)
   */
  const initialUniforms = useMemo(
    () => ({
      uTime: { value: BURST_DURATION + 1 },
      uDuration: { value: BURST_DURATION },
      uOrigin: { value: new Vector3() },
      uPull: { value: new Vector3(0, 1, 0) },
      uPixelRatio: { value: pixelRatio },
      uColor: { value: new Color(color) },
    }),
    [pixelRatio, color],
  );
  /** 살아 있는 머티리얼의 uniforms. 마운트 전에는 초기값 객체. */
  const uniformsOf = useCallback(
    () => materialRef.current?.uniforms ?? initialUniforms,
    [initialUniforms],
  );

  useEffect(() => {
    (uniformsOf().uColor.value as Color).set(color);
  }, [color, uniformsOf]);

  useEffect(() => {
    uniformsOf().uPixelRatio.value = pixelRatio;
  }, [pixelRatio, uniformsOf]);

  // 사건은 스토어에서 듣는다. 어느 물건인지 알아야 하므로 event-pulse가 아니라 목록 차이를 본다
  useEffect(
    () =>
      useMemoryRoomStore.subscribe((state, previous) => {
        const id =
          newlyRecorded(state.collected, previous.collected) ??
          newlyRecorded(state.revisited, previous.revisited);
        if (!id) return;
        const placement = MEMORY_PLACEMENTS[id];
        if (!placement) return;
        const [x, y, z] = placement.position;
        const uniforms = uniformsOf();
        (uniforms.uOrigin.value as Vector3).set(x, y, z);
        /*
         * 쓸려 가는 쪽은 화면의 오른쪽 위다. 수첩 손잡이가 오른쪽 가장자리에 있고 HUD
         * 숫자가 위에 있다. 카메라 기준 오른쪽·위 벡터를 섞어 월드 방향으로 만든다.
         */
        camera.matrixWorld.extractBasis(cameraRight, cameraUp, pull);
        pull.copy(cameraRight).multiplyScalar(0.8).addScaledVector(cameraUp, 0.6).normalize();
        (uniforms.uPull.value as Vector3).copy(pull);
        elapsed.current = 0;
      }),
    [camera, uniformsOf],
  );

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    const live = elapsed.current < BURST_DURATION;
    points.visible = live;
    if (!live) return;
    elapsed.current += delta;
    uniformsOf().uTime.value = elapsed.current;
  });

  return (
    <points ref={pointsRef} frustumCulled={false} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[burst.positions, 3]} />
        <bufferAttribute attach="attributes-aDir" args={[burst.dirs, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[burst.sizes, 1]} />
        <bufferAttribute attach="attributes-aSeed" args={[burst.seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={initialUniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
