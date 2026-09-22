"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  type Camera,
  HalfFloatType,
  MathUtils,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  type Texture,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { useMemoryRoomStore } from "@/store/memory-room";
import { MIRROR_ONLY_LAYER } from "./first-person";
import { InteriorBox } from "./InteriorPrimitives";
import type { RoomPalette } from "./palette";
import { SLIT_SCAN, smearFromWarm } from "./slit-scan";

/**
 * 반사 텍스처의 한 변. 방의 전신거울(512)보다 작다: 유리가 작고, 같은 크기의 판이 링에
 * 12장 더 쌓이기 때문이다. 세로줄로 찢어 보이는 그림이라 해상도가 낮아도 티가 안 난다.
 */
const REFLECTION_SIZE = 256;

/**
 * 반사를 다시 찍는 간격(화면 프레임). 화장실은 1인칭으로 들어오지 않는 공간이라 늘
 * 3인칭 간격이다. 간격이 곧 링 한 칸의 시간이라, 12칸 × 3프레임 = 36프레임(0.6초)이
 * 유리 폭에 펼쳐지는 과거의 길이다.
 *
 * MirrorReflection은 `renderer.info.render.frame`으로 세는데, 그 수는 `renderer.render()`
 * 호출마다 오른다: 컴포저의 깊이·법선 패스, 반사 카메라의 렌더, 여기서 하는 복사 렌더까지
 * 전부 한 프레임 안에서 몇 번씩 올린다. 여기는 useFrame이 화면 프레임마다 하나씩 올리는
 * 카운터로 센다. 간격이 곧 시간축이라 셈이 정확해야 한다.
 */
const RENDER_INTERVAL = 3;

/** 시간차 폭이 목표값을 따라가는 damp 계수. 되찾는 순간 툭 맞아 들지 않고 몇 초에 걸쳐 든다. */
const SMEAR_LAMBDA = 0.8;

/** 폴백 금속판의 두께. 예전 BathroomMirror의 유리 상자와 같은 값이다. */
const GLASS_DEPTH = 0.018;

const { ringSize: RING, columns: COLUMNS } = SLIT_SCAN;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

/*
 * 링의 프레임을 샘플러 배열로 받는다. GLSL ES 3.0은 샘플러 배열을 상수 식으로만 안전하게
 * 인덱싱한다 (드라이버에 따라 동적 인덱스가 조용히 틀린다). 줄마다 다른 칸을 읽어야 하니
 * 인덱스가 프래그먼트마다 다르고, 그래서 if 사슬로 푼다. 12갈래면 이 크기의 판에서는 비용이
 * 안 잡힌다. 사슬은 링 크기에서 만들어 내므로 slit-scan.ts의 ringSize와 어긋날 수 없다.
 */
const FRAME_LOOKUP = Array.from(
  { length: RING },
  (_, i) => `    if (index == ${i}) return texture2D(uFrames[${i}], uv);`,
).join("\n");

/*
 * slitFrameIndex(slit-scan.ts)와 같은 식이다. 줄 번호를 0~1로 펴고 폭을 곱해 "몇 프레임 전"을
 * 반올림으로 정한 뒤, 다음에 쓸 칸(uWrite)에서 거슬러 간다. uWrite에 RING - 1을 더해 두면
 * 뺄셈이 음수로 안 떨어져 % 하나로 링을 돈다. 식을 고치면 그쪽도 같이 고친다.
 */
const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uFrames[${RING}];
  uniform int uWrite;     // 다음에 쓸 칸. 가장 최근 프레임은 그 앞 칸
  uniform float uSmear;   // 시간차 폭 (0: 보통 거울, 1: 오른쪽 끝이 링에서 가장 오래된 칸)
  varying vec2 vUv;

  #include <logdepthbuf_pars_fragment>

  vec4 frameAt(int index, vec2 uv) {
${FRAME_LOOKUP}
    return texture2D(uFrames[${RING - 1}], uv);
  }

  void main() {
    #include <logdepthbuf_fragment>

    float column = clamp(floor(vUv.x * ${COLUMNS}.0), 0.0, ${COLUMNS - 1}.0);
    float spread = column / ${COLUMNS - 1}.0;
    int delay = int(floor(spread * clamp(uSmear, 0.0, 1.0) * ${RING - 1}.0 + 0.5));
    int index = (uWrite + ${RING - 1} - delay) % ${RING};

    // 링의 프레임은 Reflector 재질이 색까지 얹어 둔 선형 색이다. 여기서는 읽어 내기만 한다
    gl_FragColor = vec4(frameAt(index, vUv).rgb, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** 렌더 사이에 남는 것들. 렌더 루프와 onBeforeRender가 React 상태 없이 나눠 쓴다. */
interface MirrorState {
  /** useFrame이 화면 프레임마다 올리는 카운터 */
  frame: number;
  /** 마지막으로 반사를 찍은 화면 프레임 */
  renderedFrame: number;
  /** 링에서 다음에 쓸 칸 */
  write: number;
  /** 링이 한 번이라도 채워졌는가. 비었으면 첫 프레임을 모든 칸에 넣는다 */
  primed: boolean;
  /** 지금 화장실에 서 있는가. 아니면 반사도 복사도 하지 않는다 */
  inBathroom: boolean;
  /** 볕의 양. useFrame이 여기서 폭의 목표값을 만든다 */
  warm: number;
}

/**
 * 링버퍼와 그 안에 프레임을 넣는 복사 장치.
 *
 * **프레임은 유리 좌표로 펴서 저장한다** (projective가 아니라 unprojected). Reflector의 텍스처는
 * 반사 카메라의 투영 좌표라, 유리 위의 한 점이 텍스처의 어디인지는 프레임마다 다른
 * textureMatrix가 정한다. 그 좌표를 링에 그대로 쌓으면 세로줄마다 그때의 행렬을 함께
 * 들고 다녀야 한다. 대신 찍을 때마다 Reflector의 재질(지금 textureMatrix가 든)로 유리와
 * 똑같은 판을 딱 맞는 직교 카메라로 한 번 그려 링에 넣는다. 그러면 링의 프레임은
 * "그 순간 유리에 비쳤을 그림"을 [0,1] uv에 편 보통 이미지가 되고, 유리 위 셰이더는
 * `uv`로 읽기만 하면 된다. 비용은 256² 판 하나를 한 번 더 그리는 것: 반사 렌더에 비하면 없다.
 *
 * 색·톤: Reflector 재질은 렌더 타깃에 그릴 때 톤매핑·색공간 변환을 하지 않는다 (three가
 * 타깃이 있으면 둘 다 끈다). 그래서 링에는 Reflector가 `color`를 얹은 선형 색이 들어가고,
 * 유리 위 셰이더의 tonemapping_fragment·colorspace_fragment가 화면에 낼 때 한 번 처리한다.
 * 보통 Reflector와 같은 경로다.
 */
function buildRing(
  geometry: PlaneGeometry,
  reflectorMaterial: ShaderMaterial,
  width: number,
  height: number,
) {
  const targets = Array.from(
    { length: RING },
    () =>
      // 깊이 없이 색만. 반정밀: 밤의 방은 어둡고 선형 8비트는 어둠에서 띠가 진다
      new WebGLRenderTarget(REFLECTION_SIZE, REFLECTION_SIZE, {
        depthBuffer: false,
        stencilBuffer: false,
        type: HalfFloatType,
      }),
  );

  // 유리와 같은 판을 유리 크기의 직교 카메라로 본다: 판이 타깃을 정확히 채운다.
  // 재질은 Reflector의 것 그대로라 vUv = textureMatrix * position, 즉 지금 반사의 투영이다
  const scene = new Scene();
  const quad = new Mesh(geometry, reflectorMaterial);
  quad.frustumCulled = false;
  scene.add(quad);
  const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 10);
  camera.position.z = 1;

  function capture(renderer: WebGLRenderer, target: WebGLRenderTarget) {
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(previous);
  }

  function dispose() {
    for (const target of targets) target.dispose();
  }

  return {
    targets,
    textures: targets.map((target) => target.texture as Texture),
    capture,
    dispose,
  };
}

/**
 * 반사가 세로줄마다 시간이 어긋난 화장실 거울 (docs/visual-experiments.md 11장).
 *
 * three의 Reflector로 반사를 찍되(MirrorReflection과 같은 방식) 화면에 바로 내지 않는다.
 * 찍은 반사를 12칸 링버퍼에 쌓고, 유리의 세로줄마다 다른 칸을 읽는다: 왼쪽 줄은 지금,
 * 오른쪽으로 갈수록 오래된 프레임. 앞에 선 사람이 움직이면 얼굴이 시간 방향으로 찢어진다.
 * 서 있으면 모든 칸이 같아 보통 거울이다: 정지한 것의 slit-scan은 원본과 같다.
 * 2막이 진행될수록(볕 warm이 오를수록) 폭이 줄어 줄이 맞아 든다.
 *
 * Reflector 메쉬 자체가 유리다. Reflector는 제 재질을 건드리지 않으므로 만든 직후 재질을
 * slit-scan 재질로 바꿔 끼운다. 원래 재질(현재 반사를 투영해 그리는)은 링에 프레임을 펴
 * 넣는 복사 장치가 쓴다. 판을 하나 더 세워 덮는 것보다 그림이 한 번 덜 그려지고 z 싸움이 없다.
 *
 * 한 프레임에 한 번만 찍는다. 컴포저의 다른 패스(AO의 깊이·법선, 아웃라인 마스크)도 씬을
 * 훑으며 onBeforeRender를 부르는데, 오버라이드 재질이 걸린 패스와 메인 카메라가 아닌 렌더는
 * 건너뛴다 (MirrorReflection과 같은 가드). 화장실 밖에서는 아무것도 하지 않는다.
 *
 * `enabled`가 아니면 예전의 금속판이다 (효과의 폴백은 지금 화면 그대로, 9장).
 */
export function SlitScanMirror({
  width,
  height,
  offset,
  palette,
  warm,
  enabled,
}: {
  width: number;
  height: number;
  /** 유리 면의 로컬 z. 캐비닛 그룹 안에서 방 쪽(-z)으로 나온 값이다. */
  offset: number;
  palette: RoomPalette;
  /** 창으로 드는 볕의 양 (roomLightMix().warm). 폭은 1 - warm이다. */
  warm: number;
  /** 효과 예산 게이트 (useEffectEnabled("heavy")). 호출부가 정한다. */
  enabled: boolean;
}) {
  if (!enabled) {
    return (
      <InteriorBox
        size={[width, height, GLASS_DEPTH]}
        position={[0, 0, offset]}
        color={palette.storm}
        roughness={0.14}
        metalness={0.8}
      />
    );
  }
  return (
    <SlitScanGlass width={width} height={height} offset={offset} palette={palette} warm={warm} />
  );
}

function SlitScanGlass({
  width,
  height,
  offset,
  palette,
  warm,
}: {
  width: number;
  height: number;
  offset: number;
  palette: RoomPalette;
  warm: number;
}) {
  const get = useThree((state) => state.get);
  const inBathroom = useMemoryRoomStore((state) => state.space === "bathroom");

  /*
   * 프레임 사이에 남는 값은 전부 ref 하나에. 의존성에 넣으면 볕이 오를 때마다, 공간을
   * 옮길 때마다 Reflector와 링(타깃 12장)이 통째로 새로 생긴다.
   */
  const stateRef = useRef<MirrorState>({
    frame: 0,
    renderedFrame: Number.NEGATIVE_INFINITY,
    write: 0,
    primed: false,
    inBathroom,
    warm,
  });
  stateRef.current.inBathroom = inBathroom;
  stateRef.current.warm = warm;

  const mirror = useMemo(() => {
    const geometry = new PlaneGeometry(width, height);
    const reflector = new Reflector(geometry, {
      // 거울은 조금 어둡고 차갑다. 반사가 방보다 밝으면 유리가 아니라 창이다
      color: palette.daylight,
      textureWidth: REFLECTION_SIZE,
      textureHeight: REFLECTION_SIZE,
      clipBias: 0.003,
    });
    reflector.name = "bathroom-mirror-slit-scan";

    // Reflector가 만든 재질은 링 복사가 쓰고, 유리에는 slit-scan 재질을 끼운다 (위 설명)
    const reflectorMaterial = reflector.material as ShaderMaterial;
    const ring = buildRing(geometry, reflectorMaterial, width, height);
    const material = new ShaderMaterial({
      name: "SlitScanMirror",
      uniforms: {
        uFrames: { value: ring.textures },
        uWrite: { value: 0 },
        uSmear: { value: smearFromWarm(stateRef.current.warm) },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
    reflector.material = material;

    const render = reflector.onBeforeRender;
    reflector.onBeforeRender = (renderer: WebGLRenderer, scene: Scene, camera: Camera, ...rest) => {
      if (scene.overrideMaterial !== null || camera !== get().camera) return;
      const state = stateRef.current;
      if (!state.inBathroom) return;
      if (state.frame - state.renderedFrame < RENDER_INTERVAL) return;
      state.renderedFrame = state.frame;

      reflector.getReflectionCamera(camera).layers.enable(MIRROR_ONLY_LAYER);
      render.call(reflector, renderer, scene, camera, ...rest);

      if (!state.primed) {
        // 빈 링은 검다. 처음 들어선 0.6초 동안 오른쪽 줄이 검게 비는 대신 첫 프레임으로 채운다
        for (const target of ring.targets) ring.capture(renderer, target);
        state.primed = true;
        state.write = 0;
      } else {
        ring.capture(renderer, ring.targets[state.write]);
        state.write = (state.write + 1) % RING;
      }
      material.uniforms.uWrite.value = state.write;
    };

    return {
      reflector,
      material,
      dispose() {
        // reflector.dispose()는 제 렌더 타깃과 *지금 끼워진* 재질(slit-scan)을 지운다
        reflector.dispose();
        reflectorMaterial.dispose();
        ring.dispose();
        geometry.dispose();
      },
    };
  }, [width, height, palette, get]);

  useEffect(() => () => mirror.dispose(), [mirror]);

  /* 화장실을 나가면 링은 그 자리에 선 옛 그림이다. 다시 들어올 때 첫 프레임으로 새로 채운다 */
  useEffect(() => {
    if (!inBathroom) stateRef.current.primed = false;
  }, [inBathroom]);

  useFrame((_, delta) => {
    const state = stateRef.current;
    state.frame += 1;
    const smear = mirror.material.uniforms.uSmear;
    smear.value = MathUtils.damp(smear.value, smearFromWarm(state.warm), SMEAR_LAMBDA, delta);
  });

  /* 판은 +z를 보게 만들어진다. 캐비닛은 뒷벽(maxZ)에 붙어 방(-z)을 보므로 돌려 세운다 */
  return (
    <primitive object={mirror.reflector} position={[0, 0, offset]} rotation={[0, Math.PI, 0]} />
  );
}
