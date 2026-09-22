"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, type ShaderMaterial, Vector2 } from "three";
import { useEffectEnabled } from "@/lib/effects/effect-budget";
import { useMemoryRoomStore } from "@/store/memory-room";
import type { RoomPalette } from "./palette";
import { RIPPLE, rippleAlive, rippleAmplitude, rippleWavefront } from "./water-ripple";

/**
 * 세면대에 고인 물 (docs/visual-experiments.md 11장 "굴절 · 파문 → 세면대의 물").
 *
 * 30일 멈춘 집이라 물은 평소 정지다. 열쇠(parents-key)를 집는 순간 손이 물을 스친 듯
 * 파문 하나가 번지고, 대야 바닥의 배수구가 굴절로 흔들리다 잔다. 그 한 번이 전부다.
 *
 * 판 한 장, 패스 하나, 렌더 타깃 없음. 바닥은 텍스처가 아니라 셰이더가 그린다 (가운데
 * 배수구 원판과 테). 굴절은 그 바닥 그림을 파문의 기울기만큼 밀어 읽는 가짜 굴절이라,
 * 뒤에 실제로 무엇이 있든 상관없이 배수구가 흔들리는 것이 보인다. 하이라이트는 고정
 * 방향의 빛 줄기 하나: 파문이 지나가면 기울어진 법선이 그 줄기를 반짝이게 한다.
 *
 * 값은 water-ripple.ts의 순수 함수가 정하고, useFrame은 그 값을 uniform에 옮기기만 한다.
 * setState는 없다 (.claude/rules/r3f.md).
 */

/** 물 판의 크기(m). 대야 바닥판(0.45×0.29)보다 한 치수 작게, 테두리 밑으로 들어간다. */
const WATER_SIZE: readonly [number, number] = [0.44, 0.28];
/**
 * 물 높이(Sink 그룹 로컬). 대야 바닥판 윗면이 0.774, 금속 배수구 원판 윗면이 0.785다.
 * 그 위에 두어야 배수구를 물이 덮고, 셰이더가 그린 배수구가 굴절로 흔들리는 게 보인다.
 * 테두리 벽(0.75~0.85)의 안쪽이라 물이 넘치는 그림은 안 나온다.
 */
const WATER_Y = 0.786;
/** 고인 물은 바닥보다 어둡다. 바닥색(trim)에 곱하는 몫. */
const WATER_SHADE = 0.78;
/** 파문이 바닥 그림을 미는 최대 거리(uv). 진폭 1에서 배수구 테가 한 폭쯤 흔들린다. */
const REFRACT_SCALE = 0.028;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uImpactAt;    // 손이 닿은 시각(elapsedTime). 아직이면 아주 먼 과거
  uniform float uAmplitude;   // 지금 프레임의 파문 진폭 (water-ripple × intensity)
  uniform float uFront;       // 지금 프레임의 파두 반경 (uv)
  uniform vec2 uAspect;       // 판의 가로세로 비: uv를 둥글게 재기 위해 (1, 짧은변/긴변)
  uniform vec3 uColor;        // 물 아래 바닥색
  uniform vec3 uHighlight;    // 하이라이트 빛깔
  varying vec2 vUv;

  // 대야 바닥의 그림: 가운데 배수구. 어두운 원판 위에 얇은 밝은 테. 테두리로 갈수록
  // 대야 벽이 올라오며 살짝 밝아진다. 텍스처 없이 이것만으로 "바닥"이 읽힌다
  // pow는 밑이 음수면 정의되지 않는다 (GPU마다 다르다). 제곱은 곱으로
  float sq(float x) { return x * x; }

  float bottomShade(vec2 p) {
    float r = length(p);
    float disc = smoothstep(0.072, 0.064, r);
    float rim = 1.0 - smoothstep(0.0, 0.011, abs(r - 0.078));
    float wall = smoothstep(0.18, 0.5, r) * 0.22;
    return 1.0 - disc * 0.55 + rim * 0.28 + wall;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uAspect;
    float dist = length(p);
    float age = uTime - uImpactAt;

    // 파문: 파두 안쪽에서만 살고, 파두 바로 뒤가 가장 세고 안으로 갈수록 잔다.
    // 마루는 sin, 기울기는 cos: 둘이 같은 위상을 써야 굴절과 하이라이트가 맞물린다
    float slope = 0.0;
    if (uAmplitude > 0.0005) {
      float inside = 1.0 - smoothstep(uFront - 0.015, uFront + 0.03, dist);
      float trail = exp(-(uFront - dist) * 3.5);
      float phase = dist * WAVE_NUMBER - age * ANGULAR_SPEED;
      slope = cos(phase) * uAmplitude * inside * trail;
    }
    // 가짜 굴절: 바닥 그림을 파문의 기울기 방향(방사)으로 밀어 읽는다
    vec2 radial = dist > 0.0005 ? p / dist : vec2(0.0);
    vec2 offset = radial * slope * REFRACT_SCALE;
    vec3 base = uColor * bottomShade(p + offset);

    // 하이라이트: 고정 방향의 빛 줄기 하나. 정지한 물에도 옅게 서 있어 "물이 있다"를
    // 말하고, 파문이 지나가면 기울어진 법선이 줄기를 따라 반짝인다
    vec3 normal = normalize(vec3(-radial * slope * 2.2, 1.0));
    vec3 light = normalize(vec3(0.42, 0.55, 0.72));
    float spec = pow(clamp(dot(normal, light), 0.0, 1.0), 28.0);
    float streak = exp(-sq((p.x * 0.55 + p.y - 0.1) * 5.5));
    float sheen = streak * (0.06 + 0.22 * spec) + 0.05 * spec * abs(slope) * 6.0;

    gl_FragColor = vec4(base + uHighlight * sheen, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
  .replace(/WAVE_NUMBER/g, RIPPLE.waveNumber.toFixed(1))
  .replace(/ANGULAR_SPEED/g, RIPPLE.angularSpeed.toFixed(1))
  .replace(/REFRACT_SCALE/g, REFRACT_SCALE.toFixed(4));

/** 아직 손이 닿지 않은 물. 어떤 elapsedTime과 빼도 age가 duration을 훌쩍 넘는다. */
const NEVER = -1e9;

function shadedTrim(palette: RoomPalette): Color {
  return new Color(palette.trim).multiplyScalar(WATER_SHADE);
}

export function SinkWater({
  palette,
  impactKey = 0,
  intensity = 1,
  enabled,
}: {
  palette: RoomPalette;
  /**
   * 바뀔 때마다 파문 하나. 게임에서는 안 쓴다 (열쇠는 스토어에서 듣는다). lab의 버튼용.
   */
  impactKey?: number;
  /** 파문의 세기 (0~1). 게임은 1, lab의 슬라이더가 이걸 민다. */
  intensity?: number;
  /**
   * 파문을 그릴지. 비우면 효과 예산(cheap)이 정한다. 꺼지면 물은 그대로 있고 파문만 없다:
   * 물이 사라지면 "멈춘 집"이 아니라 "빈 대야"가 된다.
   */
  enabled?: boolean;
}) {
  const budget = useEffectEnabled("cheap");
  const animate = enabled ?? budget;
  const materialRef = useRef<ShaderMaterial>(null);
  /** 다음 useFrame에서 uImpactAt을 찍어야 하는가. 스토어와 impactKey 둘 다 여기로 모인다. */
  const pendingRef = useRef(false);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  const stillColor = useMemo(() => shadedTrim(palette), [palette]);

  // r3f는 uniforms 프롭을 복제한다. 초기값으로만 쓰고 이후 갱신은 materialRef.current.uniforms
  // biome-ignore lint/correctness/useExhaustiveDependencies: 초기값 전용: 이후 갱신은 effect와 useFrame이 맡는다.
  const initialUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uImpactAt: { value: NEVER },
      uAmplitude: { value: 0 },
      uFront: { value: 0 },
      uAspect: { value: new Vector2(1, WATER_SIZE[1] / WATER_SIZE[0]) },
      uColor: { value: shadedTrim(palette) },
      uHighlight: { value: new Color(palette.linen) },
    }),
    [],
  );

  useEffect(() => {
    const uniforms = materialRef.current?.uniforms;
    if (!uniforms) return;
    (uniforms.uColor.value as Color).copy(stillColor);
    (uniforms.uHighlight.value as Color).set(palette.linen);
  }, [stillColor, palette.linen]);

  // 열쇠가 인벤토리에 드는 순간이 손이 물을 스치는 순간이다. 시각은 다음 프레임의
  // clock에서 찍는다: 여기서는 언제가 "지금"인지 모른다
  useEffect(
    () =>
      useMemoryRoomStore.subscribe((state, previous) => {
        if (
          state.inventory.includes("parents-key") &&
          !previous.inventory.includes("parents-key")
        ) {
          pendingRef.current = true;
        }
      }),
    [],
  );

  // lab의 버튼. 첫 마운트의 값은 사건이 아니다: 바뀐 뒤부터 센다
  const seenKeyRef = useRef(impactKey);
  useEffect(() => {
    if (seenKeyRef.current === impactKey) return;
    seenKeyRef.current = impactKey;
    pendingRef.current = true;
  }, [impactKey]);

  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;
    const uniforms = material.uniforms;
    const now = state.clock.elapsedTime;
    uniforms.uTime.value = now;
    if (pendingRef.current) {
      pendingRef.current = false;
      uniforms.uImpactAt.value = now;
    }
    const age = now - uniforms.uImpactAt.value;
    // 잔 뒤에는 진폭 0으로 두면 셰이더가 파문 분기를 건너뛴다. 정지한 물은 그만큼 싸다
    if (rippleAlive(age)) {
      uniforms.uAmplitude.value = rippleAmplitude(age) * intensityRef.current;
      uniforms.uFront.value = rippleWavefront(age);
    } else {
      uniforms.uAmplitude.value = 0;
      uniforms.uFront.value = 0;
    }
  });

  if (!animate) {
    // 폴백: 같은 자리에 같은 어둡기의 잔잔한 물. 파문만 없다
    return (
      <mesh position={[0, WATER_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} name="basin-water">
        <planeGeometry args={[WATER_SIZE[0], WATER_SIZE[1]]} />
        <meshStandardMaterial color={stillColor} roughness={0.15} />
      </mesh>
    );
  }

  return (
    <mesh position={[0, WATER_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} name="basin-water">
      <planeGeometry args={[WATER_SIZE[0], WATER_SIZE[1]]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={initialUniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
      />
    </mesh>
  );
}
