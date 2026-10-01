"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { RoomPalette } from "@/scenes/memory-room/world/palette";

/**
 * 3D 인스펙트의 면 그림 (InspectTurntable · InspectFoldedNote · InspectBook이 나눠 쓴다).
 *
 * 면 그림은 캔버스에 코드로 그린다. 글자가 언어를 따라야 해서다 (ko/en/ja). 그림 파일
 * (`image`)이 주어지면 불러오는 대로 그 위를 덮고, 없으면 코드 그림이 그대로 남는다.
 */

/** 면 하나를 그리는 손. 캔버스 크기는 면의 비율을 따른다. */
export type FacePainter = (
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number },
  palette: RoomPalette,
  font: string,
) => void;

export interface InspectFace {
  paint: FacePainter;
  /** 그림 파일 (public 기준). 오면 코드 그림을 덮는다. 없거나 못 불러오면 코드 그림 그대로. */
  image?: string;
  /**
   * 그림 파일을 면의 일부에만 붙인다 (면 크기에 대한 비율, 0~1). 없으면 면 전체.
   * 앰플 라벨처럼 원통에 띠로 감기는 그림이 이 경우다: 나머지는 `imageBase` 색으로 칠한다.
   */
  imageRect?: { x: number; y: number; width: number; height: number };
  /** `imageRect`로 붙일 때 그림 밖을 채우는 색. */
  imageBase?: keyof RoomPalette;
  /**
   * 그림 위에 다시 그리는 손. 코드 그림 직후에 한 번, 그림 파일이 덮인 뒤 한 번 더
   * 불린다. 책장의 접힌 귀처럼 그림 파일과 무관하게 늘 위에 있어야 하는 것.
   */
  overlay?: FacePainter;
}

/** 면 그림의 긴 변 해상도. 손글씨가 또렷하려면 512는 있어야 한다. */
const FACE_RESOLUTION = 704;

/** 페이지의 글꼴을 그대로 쓴다: 방의 UI와 같은 Pretendard가 next/font로 이미 실려 있다. */
export function bodyFont(): string {
  try {
    return getComputedStyle(document.body).fontFamily || "sans-serif";
  } catch {
    return "sans-serif";
  }
}

/** 면의 월드 치수 → 캔버스 크기 (긴 변을 resolution에 맞춘다). */
export function canvasSize(worldWidth: number, worldHeight: number, resolution = FACE_RESOLUTION) {
  const scale = resolution / Math.max(worldWidth, worldHeight);
  return {
    width: Math.max(64, Math.round(worldWidth * scale)),
    height: Math.max(64, Math.round(worldHeight * scale)),
  };
}

const FULL_RECT = { x: 0, y: 0, width: 1, height: 1 };

/**
 * 면 여럿을 텍스처로. 같은 크기의 면들(책의 쪽들)이 한 번에 굽힌다. 그림 파일이 오면
 * 같은 캔버스에 덮어 그린다. 언마운트 때 내려놓는다.
 *
 * 배열이라 훅을 반복문에 넣지 않아도 된다. `faces`는 부르는 쪽이 useMemo로 붙잡아야
 * 한다: 새 배열이 오면 전부 다시 굽는다.
 */
export function useFaceTextures(
  faces: readonly InspectFace[],
  size: { width: number; height: number },
  palette: RoomPalette,
  font: string,
): CanvasTexture[] {
  const textures = useMemo(
    () =>
      faces.map((face) => {
        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const ctx = canvas.getContext("2d");
        if (ctx && typeof ctx.fillRect === "function") {
          face.paint(ctx, size, palette, font);
          face.overlay?.(ctx, size, palette, font);
        }
        const made = new CanvasTexture(canvas);
        made.colorSpace = SRGBColorSpace;
        made.anisotropy = 4;
        return made;
      }),
    [faces, size, palette, font],
  );

  useEffect(() => {
    let alive = true;
    faces.forEach((face, index) => {
      const texture = textures[index];
      if (!face.image || !texture) return;
      const image = new Image();
      image.onload = () => {
        if (!alive) return;
        const canvas = texture.image as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const rect = face.imageRect;
        if (rect) {
          // 코드 그림은 그림 파일과 같은 것을 그리므로 통째로 걷어 내고 바탕만 남긴다
          ctx.fillStyle = palette[face.imageBase ?? "linen"];
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        const dest = rect ?? FULL_RECT;
        ctx.drawImage(
          image,
          dest.x * canvas.width,
          dest.y * canvas.height,
          dest.width * canvas.width,
          dest.height * canvas.height,
        );
        face.overlay?.(ctx, { width: canvas.width, height: canvas.height }, palette, font);
        texture.needsUpdate = true;
      };
      image.src = face.image;
    });
    return () => {
      alive = false;
    };
  }, [textures, faces, palette, font]);

  useEffect(
    () => () => {
      for (const texture of textures) texture.dispose();
    },
    [textures],
  );
  return textures;
}

const NO_FACES: readonly InspectFace[] = [];

/** 면 하나를 텍스처로. 없는 면(원통의 뒷면)은 null. */
export function useFaceTexture(
  face: InspectFace | undefined,
  size: { width: number; height: number },
  palette: RoomPalette,
  font: string,
): CanvasTexture | null {
  const faces = useMemo(() => (face ? [face] : NO_FACES), [face]);
  return useFaceTextures(faces, size, palette, font)[0] ?? null;
}
