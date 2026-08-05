"use client";

import { useEffect, useState } from "react";
import { SRGBColorSpace, type Texture, TextureLoader } from "three";

/** 로더 하나를 모듈이 공유한다 — 텍스처마다 새로 만들 이유가 없다. */
const loader = new TextureLoader();

export interface CoverTransform {
  /** 텍스처 UV 배율 (x, y). 1보다 작으면 그만큼 잘려 나간다. */
  repeat: [number, number];
  /** 잘려 나간 만큼을 양쪽에 반씩 나눠 그림을 가운데로 민다. */
  offset: [number, number];
}

const NO_CROP: CoverTransform = { repeat: [1, 1], offset: [0, 0] };

function isPositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

/**
 * 판을 꽉 채우고 넘치는 쪽을 잘라내는 UV 변환. CSS의 `object-fit: cover`와 같다.
 *
 * 그림이 판보다 옆으로 넓으면 좌우를, 세로로 길면 위아래를 자른다. 자르는 기준은
 * 항상 가운데다 — 사진의 주인공은 대개 가운데 있고, 한쪽 끝을 기준으로 자르면
 * 그림마다 어디가 살아남을지 예측할 수 없다.
 *
 * 비율을 아직 모를 때(이미지 로드 전)나 값이 이상할 때는 자르지 않는다. 잘못 자른
 * 그림보다 잠깐 늘어난 그림이 낫다.
 */
export function coverTransform(imageAspect: number, planeAspect: number): CoverTransform {
  if (!isPositive(imageAspect) || !isPositive(planeAspect)) return NO_CROP;

  const wide = imageAspect > planeAspect;
  const repeatX = wide ? planeAspect / imageAspect : 1;
  const repeatY = wide ? 1 : imageAspect / planeAspect;
  return {
    repeat: [repeatX, repeatY],
    offset: [(1 - repeatX) / 2, (1 - repeatY) / 2],
  };
}

/** 로드된 텍스처에서 그림의 가로세로 비. 아직 모르면 0. */
function imageAspectOf(texture: Texture): number {
  const image = texture.image as { width?: number; height?: number } | null;
  if (!image?.width || !image?.height) return 0;
  return image.width / image.height;
}

/**
 * 판에 꽉 차게 깔리는 텍스처를 읽어 온다.
 *
 * drei의 `useTexture`를 쓰지 않는 이유가 둘이다. 하나, `useTexture`는 서스펜드하는데
 * 이 훅을 쓰는 자리(액자 사진)는 Suspense 경계 밖의 프리미티브라 경계를 새로
 * 세워야 한다. 둘, 파일이 없을 때 서스펜스는 그대로 터지지만 여기서는 조용히
 * null로 떨어져야 한다 — 사진 한 장 때문에 방이 안 뜨면 안 된다
 * (.claude/rules/assets.md의 "파일이 아직 없어도 되는" 에셋들과 같은 계약).
 *
 * 반환값은 머티리얼의 `map`에 그대로 물린다. null인 동안에는 바탕색이 그 자리를 채운다.
 */
export function useCoverTexture(path: string, planeAspect: number): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: Texture | null = null;

    loader.load(
      path,
      (result) => {
        // 늦게 도착한 텍스처는 붙일 자리가 없다 — 그대로 버린다.
        if (cancelled) {
          result.dispose();
          return;
        }
        loaded = result;
        result.colorSpace = SRGBColorSpace;
        setTexture(result);
      },
      undefined,
      () => undefined,
    );

    return () => {
      cancelled = true;
      loaded?.dispose();
      setTexture(null);
    };
  }, [path]);

  // 판 비율이 바뀌면 크롭을 다시 잡는다. 텍스처 객체는 그대로 두고 UV만 민다.
  useEffect(() => {
    if (!texture) return;
    const { repeat, offset } = coverTransform(imageAspectOf(texture), planeAspect);
    texture.repeat.set(repeat[0], repeat[1]);
    texture.offset.set(offset[0], offset[1]);
    texture.needsUpdate = true;
  }, [texture, planeAspect]);

  return texture;
}
