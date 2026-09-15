"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, Color, DoubleSide, MathUtils, type ShaderMaterial } from "three";
import { MEMORY_PLACEMENTS } from "./layout";

/**
 * 창으로 들어오는 빛줄기.
 *
 * 먼지 입자만으로는 "점이 떠다닌다"로 읽히고 빛으로 보이지 않는다.
 * 실제로 빛줄기 볼륨을 그리고, 먼지는 그 안에서 반짝이는 역할만 맡긴다.
 *
 * 창밖으로 새어나가는 번짐은 여기 두지 않는다. three는 투명 오브젝트를 항상
 * 불투명 오브젝트 뒤에 그리므로, depthTest를 끈 스프라이트는 벽을 뚫고 방 위에
 * 덧칠된다. 그 워시는 캔버스 아래 DOM 레이어(.room-backdrop)가 담당한다.
 */

const WINDOW = MEMORY_PLACEMENTS.window.position;

/**
 * 광선 판. 카메라 궤도가 ±0.32rad로 좁아 판 한 장으로도 볼륨처럼 읽힌다.
 *
 * 창(z=-3.88)과 커튼에 닿게 두면 그 위에 덧그려져 "빛이 창을 뚫는" 것처럼 보인다.
 * 위쪽 끝을 방 안쪽(z≈-3.3)에서 시작시켜 창 지오메트리와 아예 겹치지 않게 한다.
 * rotation.x=-1.02에서 local +Y는 (0, 0.523, -0.852)로 가므로
 * 중심 z=-0.74, 길이 6.0(반 3.0)이면 위쪽 끝이 z=-3.30이다.
 */
const SHAFT_WIDTH = 2.6;
const SHAFT_LENGTH = 6;
const SHAFT_POSITION = [WINDOW[0] + 0.35, 1.43, WINDOW[2] + 3.14] as const;
const SHAFT_ROTATION = [-1.02, 0, 0] as const;

/**
 * 광선의 그림. 세로 그라디언트(창가에서 밝고 방 안 끝에서 옅어짐) 위에 흐르는 노이즈를
 * 두 겹 태운다. 판 한 장이지만 결이 서로 다른 속도로 흘러 빛이 "흐르는" 것으로 읽힌다.
 *
 * 커튼은 가운데서 양쪽으로 젖혀지므로(curtain-motion) 빛도 가운데 틈에서 시작해
 * 양옆으로 넓어진다(uOpen). 젖히는 손을 따라 빛이 열리는 것이 커튼 인터랙션의 보상이다.
 */
const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uOpen;   // 커튼이 젖혀진 몫 (0 닫힘 ~ 1 활짝)
  uniform vec3 uColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // 값 노이즈 두 옥타브. 광선 결에는 이 정도면 충분하고, 더 넣으면 모바일이 운다
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    return noise(p) * 0.65 + noise(p * 2.3 + 7.1) * 0.35;
  }

  void main() {
    // v=1이 창가(위), v=0이 방 안 끝(아래)
    float head = vUv.y;
    float along = smoothstep(0.0, 0.7, head);
    // 결은 판의 길이 방향으로 흐른다. 두 겹의 속도·주기가 달라야 한 덩어리로 안 흐른다
    float rays = 0.55 + 0.45 * fbm(vec2(vUv.x * 5.0 + uTime * 0.02, head * 2.2 - uTime * 0.09));
    rays *= 0.7 + 0.3 * fbm(vec2(vUv.x * 11.0 - uTime * 0.05, head * 4.0 - uTime * 0.16));
    // 판의 좌우 끝을 부드럽게: 광선이 네모난 판으로 읽히면 안 된다
    float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
    // 커튼 틈: 가운데서 양옆으로 열린다. 조금 열린 커튼은 가는 빛줄기 하나다
    float half = mix(0.04, 0.5, uOpen);
    float slit = smoothstep(0.5 - half - 0.08, 0.5 - half + 0.04, vUv.x)
               * smoothstep(0.5 + half + 0.08, 0.5 + half - 0.04, vUv.x);
    float alpha = along * rays * edge * slit * uOpacity;
    if (alpha <= 0.002) discard;
    gl_FragColor = vec4(uColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const MAX_SHAFT_OPACITY = 0.3;

export function WindowLight({
  color,
  intensity,
  open,
}: {
  color: string;
  intensity: number;
  /** 커튼이 젖혀진 몫 (0~1). 0이면 빛이 들어올 이유가 없다. 켜두면 "빛이 창을 뚫는" 것처럼 보인다. */
  open: number;
}) {
  const materialRef = useRef<ShaderMaterial>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 초기값 전용: 이후 갱신은 effect와 useFrame이 맡는다.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uOpen: { value: open },
      uColor: { value: new Color(color) },
    }),
    [],
  );

  useEffect(() => {
    uniforms.uColor.value.set(color);
  }, [color, uniforms]);

  // 커튼이 열리는 모션(RoomFurniture)과 같은 호흡으로 빛이 번지도록 damp로 따라간다
  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    // 틈은 손을 바로 따라오고, 밝기는 천천히 차오른다
    uniforms.uOpen.value = MathUtils.damp(uniforms.uOpen.value, open, 8, delta);
    const goal = open > 0.02 ? MAX_SHAFT_OPACITY * intensity * (0.35 + 0.65 * open) : 0;
    uniforms.uOpacity.value = MathUtils.damp(uniforms.uOpacity.value, goal, 3, delta);
    material.visible = uniforms.uOpacity.value > 0.002;
  });

  return (
    <mesh position={SHAFT_POSITION} rotation={SHAFT_ROTATION}>
      <planeGeometry args={[SHAFT_WIDTH, SHAFT_LENGTH]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        side={DoubleSide}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}
