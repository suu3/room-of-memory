"use client";

import { forwardRef } from "react";
import type { Group } from "three";
import { DRAWER_FRONT } from "./fridge-drawer";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";

/** 서랍 통의 깊이: 냉장고 몸통(0.68) 안에 든다. */
const TRAY_DEPTH = 0.5;
const WALL = 0.02;

/**
 * 냉장고 아래칸: "손대지 마"라던 서랍 (docs/content-design.md 4-2).
 *
 * 앞면·손잡이·통이 한 그룹이라 그룹의 z를 밀면 통째로 열린다. 닫혀 있을 때 통은
 * 냉장고 몸통 속에 잠겨 보이지 않는다. 몸통을 복제하지 않고 앞면만 5mm 앞에 세워
 * 이음매로 읽히게 한다 (냉장실 문 테두리와 같은 규칙).
 *
 * `contents`는 통 안에 놓을 것들. 열기 전엔 어차피 안 보이므로 빈 채로 둬도 된다.
 */
export const FridgeDrawer = forwardRef<
  Group,
  {
    palette: RoomPalette;
    opacity?: number;
    /** 통 안에 든 것들 (서랍과 함께 밀려 나온다). */
    children?: React.ReactNode;
  }
>(function FridgeDrawer({ palette, opacity = 1, children }, ref) {
  const transparent = opacity < 1;
  const { width, height } = DRAWER_FRONT;
  const trayCenterZ = -TRAY_DEPTH / 2 - 0.005;
  const walls: { size: Vec3Tuple; position: Vec3Tuple }[] = [
    { size: [width - 0.04, WALL, TRAY_DEPTH], position: [0, -height / 2 + 0.03, trayCenterZ] },
    { size: [width - 0.04, height * 0.75, WALL], position: [0, -0.03, -TRAY_DEPTH] },
    {
      size: [WALL, height * 0.75, TRAY_DEPTH],
      position: [-(width - 0.04) / 2, -0.03, trayCenterZ],
    },
    { size: [WALL, height * 0.75, TRAY_DEPTH], position: [(width - 0.04) / 2, -0.03, trayCenterZ] },
  ];
  return (
    <group ref={ref} name="fridge-drawer">
      {/* 앞면 뒤의 어두운 테: 몸통보다 한 치수 커서 서랍의 틈으로 읽힌다 */}
      <mesh position={[0, 0, -0.004]}>
        <boxGeometry args={[width + 0.04, height + 0.04, 0.02]} />
        <meshStandardMaterial
          color={palette.frame}
          roughness={0.8}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>
      <mesh position={[0, 0, 0.01]} castShadow>
        <boxGeometry args={[width, height, 0.03]} />
        <meshStandardMaterial
          color={palette.trim}
          roughness={0.7}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>
      {/* 손잡이: 냉장실 문 손잡이와 같은 색 */}
      <mesh position={[0, 0.11, 0.04]} castShadow>
        <boxGeometry args={[0.22, 0.035, 0.035]} />
        <meshStandardMaterial
          color={palette.frame}
          roughness={0.6}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>
      {walls.map((wall) => (
        <mesh key={wall.position.join(":")} position={wall.position}>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial
            color={palette.trim}
            roughness={0.85}
            opacity={opacity}
            transparent={transparent}
          />
        </mesh>
      ))}
      {children}
    </group>
  );
});

/**
 * 통 안의 식량: 통조림 둘과 봉지 하나. "식량 밑에 이런 걸 묻어두고"가 그림으로
 * 서려면 앰플 옆에 뭔가 쌓여 있어야 한다.
 */
export function DrawerRations({ palette }: { palette: RoomPalette }) {
  return (
    <group name="drawer-rations">
      <mesh position={[-0.22, -0.105, -0.3]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.11, 14]} />
        <meshStandardMaterial color={palette.sage} roughness={0.5} />
      </mesh>
      <mesh position={[-0.11, -0.105, -0.37]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.11, 14]} />
        <meshStandardMaterial color={palette.trim} roughness={0.5} />
      </mesh>
      <mesh position={[0.24, -0.11, -0.33]} rotation={[0, -0.2, 0]} castShadow>
        <boxGeometry args={[0.17, 0.1, 0.12]} />
        <meshStandardMaterial color={palette.linen} roughness={0.9} />
      </mesh>
    </group>
  );
}
