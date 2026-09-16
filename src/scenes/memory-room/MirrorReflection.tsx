"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { type Camera, PlaneGeometry, type Scene, type WebGLRenderer } from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import type { RoomPalette } from "./palette";

/** 반사 텍스처의 한 변. 유리가 화면의 일부라 화면 해상도까지는 필요 없다. */
const REFLECTION_SIZE = 512;

/**
 * 등 뒤 시점 구간에서만 서는 진짜 거울 유리.
 *
 * three의 Reflector로 씬을 거울 너머 카메라에서 한 번 더 그린다. 어둠 속에서 걸어가다
 * 거울 앞에 서면 캐릭터의 앞모습이 거기 비친다: 등만 보이던 사람과 처음 마주치는 자리.
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
}: {
  width: number;
  height: number;
  /** 유리 두께의 절반. 판을 이만큼 앞에 세워 평소 유리와 같은 면에 둔다. */
  offset: number;
  palette: RoomPalette;
}) {
  const get = useThree((state) => state.get);
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
    let renderedFrame = -1;
    mirror.onBeforeRender = (renderer: WebGLRenderer, scene: Scene, camera: Camera, ...rest) => {
      if (scene.overrideMaterial !== null || camera !== get().camera) return;
      const frame = renderer.info.render.frame;
      if (frame === renderedFrame) return;
      renderedFrame = frame;
      render.call(mirror, renderer, scene, camera, ...rest);
    };
    return mirror;
  }, [width, height, palette, get]);

  useEffect(() => () => reflector.dispose(), [reflector]);

  return <primitive object={reflector} position={[0, 0, offset]} />;
}
