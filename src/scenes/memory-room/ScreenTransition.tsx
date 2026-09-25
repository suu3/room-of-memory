"use client";

import { useFrame } from "@react-three/fiber";
import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import { Uniform } from "three";
import { screenTransitionInput } from "@/lib/effects/screen-transition-input";
import { useMemoryRoomStore } from "@/store/memory-room";

/**
 * 화면 전체가 넘어가는 순간의 전환 (컴포저 이펙트).
 *
 * - 신호 끊김(tear): 컷씬이 시작되는 순간. 방송이 끊기듯 화면이 가로로 찢기고
 *   주사선과 잡음이 지나간 뒤 어두워진다. 0.15초에 꼭대기, 0.5초 안에 잦아든다.
 *   컷씬 층(PlaybackScene)은 그 뒤에 떠오르므로 찢김이 먼저 보인다.
 * - 필름 타들어감(burn): 엔딩이 시작되는 순간. 가장자리부터 따뜻하게 밝아지며
 *   안쪽으로 번진다. 문이 열리는 1.8초 동안 천천히 차오르고, 엔딩 화면이 덮는다.
 *
 * - 재구성(settle): 공간이 선에서 면으로 돌아온 직후. 노이즈 결이 화면을 덮었다가
 *   0.55초 안에 잦아든다 (WireframeReveal이 screen-transition-input으로 흘린다).
 *
 * 입력 버퍼를 다른 좌표로 읽으므로(찢김) CONVOLUTION 이펙트다. 색수차와 같아서 제
 * 패스를 혼자 쓴다. 쉬는 동안(둘 다 0)에는 읽은 색을 그대로 내보낸다.
 */
const FRAGMENT = /* glsl */ `
  uniform float uTear;
  uniform float uBurn;
  uniform float uSettle;
  uniform float uTime;

  float hash(float n) {
    return fract(sin(n) * 43758.5453);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec4 color = inputColor;

    if (uTear > 0.001) {
      // 가로 띠마다 제멋대로 밀린다. 띠와 밀림은 시간에 따라 다시 뽑힌다
      float band = floor(uv.y * 28.0 + uTime * 9.0);
      float pick = hash(band + floor(uTime * 20.0) * 0.37);
      float shift = (pick - 0.5) * 0.18 * uTear * step(0.55, pick);
      vec2 p = vec2(uv.x + shift, fract(uv.y + uTear * uTear * 0.06 * sin(uTime * 3.0)));
      color = texture2D(inputBuffer, p);
      float scan = 0.85 + 0.15 * sin(p.y * 900.0 + uTime * 40.0);
      color.rgb = mix(color.rgb, color.rgb * scan, uTear);
      float grain = hash(p.x * 311.0 + p.y * 917.0 + uTime * 13.0);
      color.rgb = mix(color.rgb, vec3(grain) * 0.35, uTear * 0.35);
      color.rgb *= 1.0 - 0.6 * uTear;
    }

    if (uSettle > 0.001) {
      // 굵은 결: 아직 채워지지 않은 자리가 어둡게 남는다. 결은 시간과 무관하게 고정이라
      // 잦아드는 동안 같은 자리가 차오른다 (프레임마다 바뀌는 잡음이 아니다)
      float cell = hash(floor(uv.x * 96.0) * 3.1 + floor(uv.y * 54.0) * 57.0);
      float fill = step(cell, uSettle);
      color.rgb = mix(color.rgb, color.rgb * 0.45, fill * 0.85);
    }

    if (uBurn > 0.001) {
      vec2 d = uv - 0.5;
      float r = length(d) * 1.35;
      // 가장자리부터 안쪽으로: uBurn이 1이면 화면 전체
      float iris = smoothstep(uBurn * 1.25 - 0.3, uBurn * 1.25 + 0.05, 1.0 - r + 0.2) ;
      iris = 1.0 - iris;
      vec3 warm = vec3(0.98, 0.82, 0.58);
      color.rgb = mix(color.rgb, color.rgb * 0.25 + warm * 0.85, iris * uBurn);
      color.rgb += warm * uBurn * uBurn * 0.15;
    }

    outputColor = color;
  }
`;

export class ScreenTransitionEffect extends Effect {
  constructor() {
    super("ScreenTransitionEffect", FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ["uTear", new Uniform(0)],
        ["uBurn", new Uniform(0)],
        ["uSettle", new Uniform(0)],
        ["uTime", new Uniform(0)],
      ]),
    });
  }

  set tear(value: number) {
    const uniform = this.uniforms.get("uTear");
    if (uniform) uniform.value = value;
  }

  set burn(value: number) {
    const uniform = this.uniforms.get("uBurn");
    if (uniform) uniform.value = value;
  }

  set settle(value: number) {
    const uniform = this.uniforms.get("uSettle");
    if (uniform) uniform.value = value;
  }

  set time(value: number) {
    const uniform = this.uniforms.get("uTime");
    if (uniform) uniform.value = value;
  }
}

/** 찢김의 꼭대기까지, 그리고 잦아들기까지 (초). */
const TEAR_ATTACK_S = 0.15;
const TEAR_RELEASE_S = 0.5;
/** 타들어감이 다 차는 시간(초). EndingScreen의 DOOR_BEAT(1.8초)보다 짧아야 덮이기 전에 다 찬다 */
const BURN_RISE_S = 1.5;

/** 찢김의 세기 (0~1). 시작 뒤 흐른 시간의 함수. */
export function tearAmount(elapsed: number): number {
  // 아직 한 번도 시작하지 않았으면 시작 시각이 -Infinity라 경과가 +Infinity다: 0이다
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  if (elapsed < TEAR_ATTACK_S) return elapsed / TEAR_ATTACK_S;
  return Math.max(0, 1 - (elapsed - TEAR_ATTACK_S) / TEAR_RELEASE_S);
}

/** 타들어감의 세기 (0~1). 켜진 뒤 흐른 시간의 함수, 다 차면 1에 머문다. */
export function burnAmount(elapsed: number): number {
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  const u = Math.min(1, elapsed / BURN_RISE_S);
  return u * u * (3 - 2 * u);
}

export function useScreenTransitionEffect() {
  const effect = useMemo(() => new ScreenTransitionEffect(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  return effect;
}

/** 스토어의 사건을 듣고 두 세기를 프레임마다 굴린다. 그리는 것은 없다. */
export function ScreenTransitionDriver({
  effect,
  reducedMotion,
}: {
  effect: ScreenTransitionEffect;
  reducedMotion: boolean;
}) {
  const clock = useRef({
    tearStart: Number.NEGATIVE_INFINITY,
    burnStart: Number.NEGATIVE_INFINITY,
    now: 0,
  });

  useEffect(
    () =>
      useMemoryRoomStore.subscribe((state, previous) => {
        const timing = clock.current;
        // 컷씬이 열리는 순간 (재생이 없다가 생긴다). 모션을 끈 판에서는 찢지 않는다
        if (!reducedMotion && state.activePlayback !== null && previous.activePlayback === null) {
          timing.tearStart = timing.now;
        }
        if (state.endingStarted && !previous.endingStarted) timing.burnStart = timing.now;
        if (!state.endingStarted && previous.endingStarted) {
          timing.burnStart = Number.NEGATIVE_INFINITY;
        }
      }),
    [reducedMotion],
  );

  useFrame((state) => {
    const timing = clock.current;
    timing.now = state.clock.elapsedTime;
    effect.time = timing.now;
    effect.tear = tearAmount(timing.now - timing.tearStart);
    effect.burn = burnAmount(timing.now - timing.burnStart);
    effect.settle = reducedMotion ? 0 : screenTransitionInput.settle;
  });

  return null;
}
