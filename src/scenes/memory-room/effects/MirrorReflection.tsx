"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  type Camera,
  CanvasTexture,
  PlaneGeometry,
  type Scene,
  SRGBColorSpace,
  type WebGLRenderer,
} from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { MIRROR_ONLY_LAYER } from "../camera/first-person";
import type { RoomPalette } from "../world/palette";

/** 반사 텍스처의 한 변. 유리가 화면의 일부라 화면 해상도까지는 필요 없다. */
const REFLECTION_SIZE = 512;

/**
 * 3인칭에서 반사를 다시 그리는 간격(프레임). 거울은 화면에서 손톱만 하고 방은 거의
 * 멈춰 있어서, 한 프레임 묵은 반사와 새 반사를 눈으로 가릴 수 없다. 대신 씬을 한 번 더
 * 그리는 비용이 반으로 준다. 1인칭에서는 얼굴을 들이대는 자리라 매 프레임 그린다.
 */
const THIRD_PERSON_INTERVAL = 2;

/**
 * 이 컨텍스트로 그림을 그릴 수 있는가.
 *
 * null인지만 보면 모자란다. jsdom의 2d 컨텍스트는 null이 아니라 **속이 반쯤 빈 스텁**이라
 * (createLinearGradient는 있고 translate는 없다) 첫 호출에서 터진다. 테스트가 이 컴포넌트를
 * 렌더하는 순간 방 전체가 안 뜨는 셈이다. 못 그리면 유리에 빛줄기만 안 걸리고 반사는 선다.
 */
function canDraw(ctx: CanvasRenderingContext2D | null): ctx is CanvasRenderingContext2D {
  return (
    typeof ctx?.translate === "function" &&
    typeof ctx.rotate === "function" &&
    typeof ctx.createLinearGradient === "function" &&
    typeof ctx.fillRect === "function"
  );
}

/** 유리에 비스듬히 걸리는 빛줄기 두 개. 폭·자리는 텍스처 좌표(0~1) 기준. */
const SHINE = { angle: -0.72, alpha: 0.22, bands: [0.36, 0.58] } as const;

/**
 * 유리에 걸린 빛. 어두운 방에서 반사만으로는 거울이 "검은 판"으로 읽히기 때문에 얹는다.
 *
 * 반사는 방을 그대로 비추는데, 이 방은 밤이고 온통 남색이라 비친 것도 남색이다. 실제로
 * 비치고 있어도 눈에는 안 비치는 것과 같다. 유리에 비스듬히 걸린 빛줄기 하나가 "여기
 * 유리가 있다"를 반사보다 먼저 말한다.
 *
 * 색은 팔레트에서 온다(daylight: 차가운 간접광). 새 hex를 만들지 않는다 (DESIGN.md).
 */
function useGlassShine(color: string): CanvasTexture {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (canDraw(ctx)) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(SHINE.angle);
      ctx.globalAlpha = SHINE.alpha;
      const gradient = ctx.createLinearGradient(-canvas.height, 0, canvas.height, 0);
      gradient.addColorStop(0, "transparent");
      for (const at of SHINE.bands) {
        gradient.addColorStop(at - 0.05, "transparent");
        gradient.addColorStop(at, color);
        gradient.addColorStop(at + 0.05, "transparent");
      }
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      // 돌려놓은 좌표계라 판보다 넉넉히 칠해야 모서리가 비지 않는다
      ctx.fillRect(-canvas.height, -canvas.height, canvas.height * 2, canvas.height * 2);
    }
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    return result;
  }, [color]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/**
 * 거울 유리. 씬을 거울 너머 카메라에서 한 번 더 그린다 (three의 Reflector).
 *
 * 1인칭에서는 카메라가 머리 안에 있는 동안 몸이 메인 카메라가 안 보는 층
 * (MIRROR_ONLY_LAYER)으로 옮겨져 있는데, 거울의 반사 카메라에는 그 층을 켜 준다.
 * 그래서 어둠 속에서 제 모습을 처음 보는 자리가 거울이 된다.
 *
 * 3인칭에서도 똑같이 비친다 (2026-09-16). 전에는 여기서만 금속 판으로 바꿔 세웠는데,
 * 방 한가운데 선 전신거울에 아무것도 안 비치면 거울이 아니라 검은 판이다. 비용은
 * 간격(THIRD_PERSON_INTERVAL)으로 깎는다.
 *
 * 한 프레임에 한 번만 그린다. 컴포저의 다른 패스(AO의 깊이·법선, 아웃라인 마스크)도
 * 씬을 훑으며 이 물건의 onBeforeRender를 부르는데, 그때마다 씬을 또 그리면 반사
 * 하나에 프레임이 서너 배가 된다. 오버라이드 재질이 걸린 패스와 메인 카메라가 아닌
 * 렌더는 건너뛴다.
 */
export function MirrorReflection({
  width,
  height,
  offset,
  palette,
  firstPerson,
}: {
  width: number;
  height: number;
  /** 유리 두께의 절반. 판을 이만큼 앞에 세워 평소 유리와 같은 면에 둔다. */
  offset: number;
  palette: RoomPalette;
  /** 1인칭 구간인가. 간격만 정한다: 반사 자체는 두 시점에서 똑같이 선다. */
  firstPerson: boolean;
}) {
  const get = useThree((state) => state.get);
  /*
   * 시점은 ref로 넘긴다. 의존성에 넣으면 시점이 바뀔 때마다 Reflector와 렌더 타깃이
   * 통째로 새로 생긴다. 바뀌는 건 간격뿐이라 그럴 값이 아니다.
   */
  const firstPersonRef = useRef(firstPerson);
  firstPersonRef.current = firstPerson;

  const reflector = useMemo(() => {
    const mirror = new Reflector(new PlaneGeometry(width, height), {
      // 거울은 조금 어둡고 차갑다. 반사가 방보다 밝으면 유리가 아니라 창이다
      color: palette.daylight,
      textureWidth: REFLECTION_SIZE,
      textureHeight: REFLECTION_SIZE,
      clipBias: 0.003,
    });
    mirror.name = "mirror-reflection";
    const render = mirror.onBeforeRender;
    let renderedFrame = Number.NEGATIVE_INFINITY;
    mirror.onBeforeRender = (renderer: WebGLRenderer, scene: Scene, camera: Camera, ...rest) => {
      if (scene.overrideMaterial !== null || camera !== get().camera) return;
      const frame = renderer.info.render.frame;
      const interval = firstPersonRef.current ? 1 : THIRD_PERSON_INTERVAL;
      if (frame - renderedFrame < interval) return;
      renderedFrame = frame;
      mirror.getReflectionCamera(camera).layers.enable(MIRROR_ONLY_LAYER);
      render.call(mirror, renderer, scene, camera, ...rest);
    };
    return mirror;
  }, [width, height, palette, get]);

  useEffect(
    () => () => {
      // Reflector.dispose는 렌더 타깃과 재질만 놓는다. 넘겨준 지오메트리는 우리 몫이다
      reflector.geometry.dispose();
      reflector.dispose();
    },
    [reflector],
  );

  const shine = useGlassShine(palette.daylight);

  return (
    <>
      <primitive object={reflector} position={[0, 0, offset]} />
      {/* 반사면 바로 앞. 깊이를 쓰지 않아 반사 위에 그대로 얹힌다 */}
      <mesh position={[0, 0, offset + 0.003]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={shine} transparent depthWrite={false} />
      </mesh>
    </>
  );
}
