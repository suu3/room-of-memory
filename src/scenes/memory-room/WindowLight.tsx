"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, CanvasTexture, DoubleSide, type Material, MathUtils } from "three";
import { MEMORY_PLACEMENTS } from "./layout";

/**
 * 창으로 들어오는 빛줄기.
 *
 * 먼지 입자만으로는 "점이 떠다닌다"로 읽히고 빛으로 보이지 않는다.
 * 실제로 빛줄기 볼륨을 그리고, 먼지는 그 안에서 반짝이는 역할만 맡긴다.
 *
 * 창밖으로 새어나가는 번짐은 여기 두지 않는다 — three는 투명 오브젝트를 항상
 * 불투명 오브젝트 뒤에 그리므로, depthTest를 끈 스프라이트는 벽을 뚫고 방 위에
 * 덧칠된다. 그 워시는 캔버스 아래 DOM 레이어(.room-backdrop)가 담당한다.
 */

const WINDOW = MEMORY_PLACEMENTS.window.position;

/**
 * 광선 판. 카메라 궤도가 ±0.32rad로 좁아 판 한 장으로도 볼륨처럼 읽힌다.
 *
 * 창(z=-3.88)과 커튼에 닿게 두면 그 위에 덧그려져 "빛이 창을 뚫는" 것처럼 보인다.
 * 위쪽 끝을 방 안쪽(z≈-3.3)에서 시작시켜 창 지오메트리와 아예 겹치지 않게 한다 —
 * rotation.x=-1.02에서 local +Y는 (0, 0.523, -0.852)로 가므로
 * 중심 z=-0.74, 길이 6.0(반 3.0)이면 위쪽 끝이 z=-3.30이다.
 */
const SHAFT_WIDTH = 2.6;
const SHAFT_LENGTH = 6;
const SHAFT_POSITION = [WINDOW[0] + 0.35, 1.43, WINDOW[2] + 3.14] as const;
const SHAFT_ROTATION = [-1.02, 0, 0] as const;

/** 위(창가)에서 아래(방 안 끝)로 갈수록 옅어지는 세로 그라디언트. */
function createShaftTexture(color: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.35, color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  return new CanvasTexture(canvas);
}

const MAX_SHAFT_OPACITY = 0.26;

export function WindowLight({
  color,
  intensity,
  curtainsOpen,
}: {
  color: string;
  intensity: number;
  /** 커튼이 닫혀 있으면 빛이 들어올 이유가 없다 — 켜두면 "빛이 창을 뚫는" 것처럼 보인다. */
  curtainsOpen: boolean;
}) {
  const shaftTexture = useMemo(() => createShaftTexture(color), [color]);
  const materialRef = useRef<Material>(null);

  // 수동으로 만든 텍스처라 r3f 자동 dispose에 기대지 않는다 (.claude/rules/r3f.md)
  useEffect(() => () => shaftTexture.dispose(), [shaftTexture]);

  // 커튼이 열리는 모션(RoomFurniture)과 같은 호흡으로 빛이 번지도록 damp로 따라간다
  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) return;
    const goal = curtainsOpen ? MAX_SHAFT_OPACITY * intensity : 0;
    material.opacity = MathUtils.damp(material.opacity, goal, 3, delta);
    material.visible = material.opacity > 0.002;
  });

  return (
    <mesh position={SHAFT_POSITION} rotation={SHAFT_ROTATION}>
      <planeGeometry args={[SHAFT_WIDTH, SHAFT_LENGTH]} />
      <meshBasicMaterial
        ref={materialRef}
        map={shaftTexture}
        color={color}
        transparent
        opacity={0}
        depthWrite={false}
        side={DoubleSide}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}
