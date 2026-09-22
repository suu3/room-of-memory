"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  type Camera,
  MathUtils,
  PlaneGeometry,
  type Scene,
  ShaderMaterial,
  Vector2,
  type WebGLRenderer,
} from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { useMemoryRoomStore } from "@/store/memory-room";
import type { RoomPalette } from "./palette";
import { dotsAcrossHeight, dotsForLevel } from "./tv-dots";

/**
 * 유리판의 크기와 자리. TV 화면 상자(LivingRoomFurniture의 TV_PARTS, 1.9×1.08×0.09,
 * 중심 z 6.28)의 앞면은 z 6.235다. 그보다 3mm 앞에 화면 테두리만큼 작은 판을 세워
 * 상자의 검은 면이 액자처럼 남게 한다. 소파가 -z에 있으니 판은 -z를 본다.
 */
const GLASS = {
  width: 1.86,
  height: 1.04,
  position: [-9.5, 1.12, 6.232] as const,
  rotation: [0, Math.PI, 0] as const,
} as const;

/**
 * 반사 텍스처의 한 변. 도트 격자가 어차피 해상도를 지우니 거울(512)의 절반이면 된다.
 * 촘촘할 때도 가로 88도트라 256이면 도트 하나에 세 텍셀이 든다.
 */
const REFLECTION_SIZE = 256;

/**
 * 반사를 다시 그리는 간격(프레임). 거울(2)보다 성기다. TV는 소파 건너편이고 도트로
 * 뭉개져 있어서 두 프레임 묵은 반사를 눈으로 가릴 수 없다. 씬을 한 번 더 그리는 값이
 * 셋 중 하나로 준다.
 */
const RENDER_INTERVAL = 3;

/**
 * 유리 전체를 누르는 배율. 꺼진 화면이 거울처럼 훤하면 이야기가 어긋난다(마지막
 * 채널이 꺼진 채다). 인광체 사이는 거의 검고 도트만 희미하게 방을 비춘다.
 */
const GAIN = 0.55;

/** 도트 사이의 밝기. 0이면 격자가 검은 그물로 읽혀 유리가 아니라 방충망이 된다. */
const BETWEEN_DOTS = 0.15;

/** 도트 굵기가 밝기를 따라가는 속도. 조명 damp와 같은 호흡 (MemoryRoomScene의 LIGHT_LAMBDA). */
const LEVEL_LAMBDA = 2.2;

/**
 * Reflector의 셰이더에 도트 스크린을 끼운다.
 *
 * Reflector의 vUv는 반사 카메라의 투영 좌표(vec4)라 도트 격자의 기준으로 못 쓴다.
 * 카메라가 움직이면 격자도 유리 위를 미끄러진다. 인광체는 유리에 박혀 있어야 하므로
 * 판의 로컬 uv를 varying 하나로 따로 넘긴다. 격자는 fract(uv × 개수)의 셀마다 원 하나,
 * 원 밖은 BETWEEN_DOTS까지 눌러 인광체 사이의 검은 틈이 된다.
 *
 * three 버전이 바뀌어 붙일 자리를 못 찾으면 셰이더를 손대지 않고 그대로 돌려준다.
 * 그때는 도트 없는 어두운 반사가 선다. 거실이 통째로 안 뜨는 것보다 낫다.
 */
function patchDotScreen(vertexShader: string, fragmentShader: string) {
  const vertexAnchor = "varying vec4 vUv;";
  const vertexAssign = "vUv = textureMatrix * vec4( position, 1.0 );";
  const fragmentAnchor = "varying vec4 vUv;";
  const fragmentOutput = "gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );";
  if (
    !vertexShader.includes(vertexAnchor) ||
    !vertexShader.includes(vertexAssign) ||
    !fragmentShader.includes(fragmentAnchor) ||
    !fragmentShader.includes(fragmentOutput)
  ) {
    return { vertexShader, fragmentShader, patched: false };
  }
  return {
    patched: true,
    vertexShader: vertexShader
      .replace(vertexAnchor, `${vertexAnchor}\n\t\tvarying vec2 vLocalUv;`)
      .replace(vertexAssign, `${vertexAssign}\n\t\t\tvLocalUv = uv;`),
    fragmentShader: fragmentShader
      .replace(
        fragmentAnchor,
        [
          fragmentAnchor,
          "varying vec2 vLocalUv;",
          "uniform vec2 uDots;",
          "uniform float uGain;",
          "uniform float uBetweenDots;",
        ].join("\n\t\t"),
      )
      .replace(
        fragmentOutput,
        [
          "vec3 reflected = blendOverlay( base.rgb, color );",
          // 셀 중심에서의 거리. 0.25 안쪽이 꽉 찬 인광체, 0.5(셀 모서리)에서 사라진다
          "float cellDistance = length( fract( vLocalUv * uDots ) - 0.5 );",
          "float dotMask = smoothstep( 0.5, 0.25, cellDistance );",
          "gl_FragColor = vec4( mix( reflected * uBetweenDots, reflected, dotMask ) * uGain, 1.0 );",
        ].join("\n\t\t\t"),
      ),
  };
}

/**
 * 꺼진 TV 유리에 비치는 거실 (docs/visual-experiments.md 11장). 거울(MirrorReflection)과
 * 같은 Reflector에 도트 스크린을 끼웠다. 굵기 곡선은 tv-dots.ts.
 *
 * 마지막에 보던 채널이 꺼진 채 그대로인 화면이다. 꺼진 유리에 방이 비치는 것은
 * 이야기에 안 어긋나고, 그 방이 **인광체 격자**로 뭉개져 있는 것이 이 물건의 재질이다.
 * 어두울수록 도트가 굵어 형체가 안 잡히고, 되찾을수록 촘촘해진다.
 *
 * 한 프레임에 한 번, 거실에 있을 때만 그린다. 컴포저의 다른 패스(AO의 깊이·법선,
 * 아웃라인 마스크)도 씬을 훑으며 onBeforeRender를 부르므로 오버라이드 재질이 걸린
 * 패스와 메인 카메라가 아닌 렌더는 건너뛴다 (거울과 같은 가드). 다른 공간에 있을 때는
 * 마지막 반사가 유리에 남는데, 문 너머로 보이는 TV는 손톱만 해서 티가 안 난다.
 *
 * 거울과 달리 MIRROR_ONLY_LAYER를 켜지 않는다. 1인칭 구간은 방과 현관뿐이라 거실 TV에
 * 머리 없는 몸이 비칠 일이 없고, 3인칭에서는 몸이 메인 층에 있어 그대로 비친다.
 */
export function TvReflection({
  palette,
  level,
  enabled,
}: {
  palette: RoomPalette;
  /** 방 밝기 (0~1). 도트 굵기만 정한다: 반사 자체는 조명이 만든다. */
  level: number;
  /** 효과 예산 게이트 (useEffectEnabled("heavy")). 꺼지면 상자의 void 면이 그대로 화면이다. */
  enabled: boolean;
}) {
  if (!enabled) return null;
  return <TvGlass palette={palette} level={level} />;
}

/**
 * 게이트 안쪽. 바깥에서 갈라 둔 이유는 렌더 타깃이다: 꺼진 채로도 useMemo가 돌면
 * 256² 타깃과 셰이더가 GPU에 올라간 채 놀고 있다.
 */
function TvGlass({ palette, level }: { palette: RoomPalette; level: number }) {
  const get = useThree((state) => state.get);
  /*
   * 거실에 있는가는 ref로 읽는다. 의존성에 넣으면 문을 건널 때마다 Reflector와 렌더
   * 타깃이 새로 생기고, useFrame/onBeforeRender 안에서 스토어를 읽으면 매 프레임
   * 셀렉터가 돈다. 바뀔 때 한 번 React가 ref를 갈아 끼우는 것으로 충분하다.
   */
  const inLiving = useMemoryRoomStore((state) => state.space === "living");
  const inLivingRef = useRef(inLiving);
  inLivingRef.current = inLiving;
  /*
   * 밝기도 ref다. 첫 도트 굵기를 지금 밝기에서 시작시키려고 읽을 뿐이고(아니면 마운트마다
   * 가장 굵은 도트에서 촘촘해지는 연출이 한 번 돈다), 이후는 useFrame이 uniform을 damp로
   * 민다. 의존성에 넣을 값이 아니다: 밝기가 바뀔 때마다 렌더 타깃을 새로 만들게 된다.
   */
  const levelRef = useRef(level);
  levelRef.current = level;

  const reflector = useMemo(() => {
    const glass = new Reflector(new PlaneGeometry(GLASS.width, GLASS.height), {
      // 유리는 방보다 어둡고 푸르다. storm은 창밖 어둠과 같은 색이라 꺼진 화면에 맞다
      color: palette.storm,
      textureWidth: REFLECTION_SIZE,
      textureHeight: REFLECTION_SIZE,
      clipBias: 0.003,
    });
    glass.name = "tv-reflection";

    const material = glass.material;
    if (material instanceof ShaderMaterial) {
      const patched = patchDotScreen(material.vertexShader, material.fragmentShader);
      if (patched.patched) {
        const dots = dotsForLevel(levelRef.current);
        material.uniforms.uDots = { value: new Vector2(dots, dotsAcrossHeight(dots)) };
        material.uniforms.uGain = { value: GAIN };
        material.uniforms.uBetweenDots = { value: BETWEEN_DOTS };
        material.vertexShader = patched.vertexShader;
        material.fragmentShader = patched.fragmentShader;
        material.needsUpdate = true;
      }
    }

    const render = glass.onBeforeRender;
    let renderedFrame = Number.NEGATIVE_INFINITY;
    glass.onBeforeRender = (renderer: WebGLRenderer, scene: Scene, camera: Camera, ...rest) => {
      if (!inLivingRef.current) return;
      if (scene.overrideMaterial !== null || camera !== get().camera) return;
      const frame = renderer.info.render.frame;
      if (frame - renderedFrame < RENDER_INTERVAL) return;
      renderedFrame = frame;
      render.call(glass, renderer, scene, camera, ...rest);
    };
    return glass;
  }, [palette, get]);

  useEffect(
    () => () => {
      // Reflector.dispose는 타깃과 재질만 버린다. 지오메트리는 우리가 만들었으니 우리가 버린다
      reflector.dispose();
      reflector.geometry.dispose();
    },
    [reflector],
  );

  useFrame((_, delta) => {
    const material = reflector.material;
    if (!(material instanceof ShaderMaterial)) return;
    const dots = material.uniforms.uDots?.value;
    if (!(dots instanceof Vector2)) return;
    dots.x = MathUtils.damp(dots.x, dotsForLevel(level), LEVEL_LAMBDA, delta);
    dots.y = dotsAcrossHeight(dots.x);
  });

  return <primitive object={reflector} position={GLASS.position} rotation={GLASS.rotation} />;
}
