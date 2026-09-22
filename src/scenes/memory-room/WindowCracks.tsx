"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";
import { crackSegments } from "./window-cracks";

/** 금 그림의 해상도. 창(2.84×2.4)의 비율을 따른다. */
const TEXTURE = { width: 512, height: 432 };
/** 유리 판을 창 중심에서 방 쪽으로 띄우는 거리. 창틀·배경막과 같은 면에 놓으면 깜빡인다. */
const GLASS_OFFSET_Z = 0.03;

function canDraw(ctx: CanvasRenderingContext2D | null): ctx is CanvasRenderingContext2D {
  return typeof ctx?.beginPath === "function" && typeof ctx.stroke === "function";
}

/**
 * 금을 한 장의 그림으로 굽는다. 붕괴도는 조사할 때만 바뀌므로(일곱 단계) 그때만 다시 굽는다.
 * 프레임마다 그리는 셰이더는 여기 필요 없다.
 */
function useCrackTexture(decay: number, color: string): CanvasTexture | null {
  const segments = useMemo(() => crackSegments(decay), [decay]);
  const texture = useMemo(() => {
    if (segments.length === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE.width;
    canvas.height = TEXTURE.height;
    const ctx = canvas.getContext("2d");
    if (canDraw(ctx)) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = "round";
      ctx.strokeStyle = color;
      for (const segment of segments) {
        // 충격점 가까이는 굵고 또렷하게, 끝으로 갈수록 실금으로 가늘어진다
        ctx.lineWidth = 0.8 + segment.weight * 2.2;
        ctx.globalAlpha = 0.35 + segment.weight * 0.5;
        ctx.beginPath();
        ctx.moveTo(segment.from[0] * canvas.width, (1 - segment.from[1]) * canvas.height);
        ctx.lineTo(segment.to[0] * canvas.width, (1 - segment.to[1]) * canvas.height);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    const made = new CanvasTexture(canvas);
    made.colorSpace = SRGBColorSpace;
    return made;
  }, [segments, color]);

  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

/**
 * 창 유리의 실금. 창밖 배경막(WindowView) 앞, 창틀과 같은 자리에 선 투명한 판 한 장이다.
 * 붕괴도(outsideDecay)를 따라 금이 늘고 길어지며 되돌아가지 않는다 (window-cracks.ts).
 */
export function WindowCracks({
  palette,
  decay,
  center,
  width,
  height,
}: {
  palette: RoomPalette;
  decay: number;
  center: Vec3Tuple;
  width: number;
  height: number;
}) {
  const texture = useCrackTexture(decay, palette.linen);
  if (!texture) return null;
  return (
    <mesh position={[center[0], center[1], center[2] + GLASS_OFFSET_Z]}>
      <planeGeometry args={[width, height]} />
      {/* 조명을 받지 않는다: 금은 유리에 걸린 빛이라 방이 어두워도 희미하게 남는다 */}
      <meshBasicMaterial map={texture} transparent depthWrite={false} opacity={0.75} />
    </mesh>
  );
}
