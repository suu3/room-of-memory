"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, MultiplyBlending, SRGBColorSpace } from "three";
import { bakeGrayScott, stainPixels } from "@/lib/effects/reaction-diffusion";
import type { Vec3Tuple } from "./types";

/** 무늬 격자. 타일 몇 장에 걸치는 얼룩이라 이 정도면 충분하다. */
const FIELD = { width: 96, height: 96, steps: 320 } as const;
/** 가장 진한 자리의 어두움. 물때는 낮은 대비다 (DESIGN.md 무드: 공포가 아니라 쓸쓸함). */
const STAIN_DEPTH = 0.32;

function canDraw(ctx: CanvasRenderingContext2D | null): ctx is CanvasRenderingContext2D {
  return typeof ctx?.putImageData === "function" && typeof ImageData !== "undefined";
}

/**
 * 반응확산 무늬를 한 번 굽어 텍스처로 만든다. 씨앗이 같으면 같은 무늬라 새로고침마다
 * 같은 자리에 같은 얼룩이 있다. 30일째 그대로인 화장실이다.
 *
 * `steps`를 주면 그만큼만 자란 무늬다 (컵라면 용기: 방이 어두워질수록 더 자란다). 값이
 * 바뀔 때만 다시 굽는다. 96²에 300스텝이 수 ms라 조사 한 번에 한 번 굽는 정도는 값싸다.
 */
export function useStainTexture(
  seed: number,
  steps: number = FIELD.steps,
  depth: number = STAIN_DEPTH,
): CanvasTexture | null {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = FIELD.width;
    canvas.height = FIELD.height;
    const ctx = canvas.getContext("2d");
    if (!canDraw(ctx)) return null;
    const field = bakeGrayScott({ width: FIELD.width, height: FIELD.height, steps, seed });
    const image = new ImageData(stainPixels(field, depth), FIELD.width, FIELD.height);
    ctx.putImageData(image, 0, 0);
    const made = new CanvasTexture(canvas);
    made.colorSpace = SRGBColorSpace;
    return made;
  }, [seed, steps, depth]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

/** 방 밝기(0~1) → 컵라면 용기 무늬의 성장 스텝. 밝을 때는 갓 시작, 바닥에서 다 자란다. */
export function stainStepsForLevel(level: number): number {
  const clamped = Math.min(1, Math.max(0, Number.isNaN(level) ? 0 : level));
  // 조사 한 번(1/7)마다 눈에 띄게 자라도록 40스텝 단위로 끊는다. 같은 값이면 다시 안 굽는다
  return 40 + Math.round(((1 - clamped) * 280) / 40) * 40;
}

/**
 * 화장실의 물때 (docs/visual-experiments.md 11장 "reaction-diffusion → 화장실 타일 · 욕조").
 *
 * 타일 면 위에 곱셈 블렌딩으로 얹는 얇은 판이다. 무늬가 있는 자리만 어두워지고 나머지는
 * 그대로다. 매 프레임 도는 것은 없다: 굽는 것은 마운트에 한 번이고, 그 뒤로는 텍스처 한 장.
 * 모션이 아니라 정적인 재질이라 효과 예산 게이트를 타지 않는다.
 */
export function BathroomStain({
  size,
  position,
  rotation,
  seed,
}: {
  size: readonly [number, number];
  position: Vec3Tuple;
  rotation?: Vec3Tuple;
  seed: number;
}) {
  const texture = useStainTexture(seed);
  if (!texture) return null;
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size[0], size[1]]} />
      {/* three의 곱셈 블렌딩은 premultipliedAlpha를 요구한다. 없으면 블렌딩이 풀려 흰 판으로 선다 */}
      <meshBasicMaterial
        map={texture}
        blending={MultiplyBlending}
        premultipliedAlpha
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
