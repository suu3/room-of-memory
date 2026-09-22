"use client";

import { BathroomFixtures, BathroomMirror, BathroomShower } from "./BathroomFixtures";
import { BathroomStain } from "./BathroomStains";
import { CulledWall } from "./CulledWall";
import { InteriorSurface } from "./InteriorPrimitives";
import { ItemPickup } from "./ItemPickup";
import { BATHROOM_COLLIDERS, BATHROOM_DOOR_POSITION, BATHROOM_SHELL_BOUNDS } from "./layout";
import type { RoomPalette } from "./palette";
import {
  endWallWithDoor,
  floorPart,
  plinthParts,
  type ShellPart,
  sideWallPlain,
} from "./space-shell";
import type { Vec3Tuple } from "./types";

const SHELL = BATHROOM_SHELL_BOUNDS;
const CENTER: readonly [number, number] = [
  (SHELL.minX + SHELL.maxX) / 2,
  (SHELL.minZ + SHELL.maxZ) / 2,
];
const X = { min: SHELL.minX, max: SHELL.maxX };
const Z = { min: SHELL.minZ, max: SHELL.maxZ };

/** 거실과의 공유벽(minZ): 문 자리를 비운다. 문틀·문짝은 SpaceDoor가 씬 층위에서 그린다. */
const SHARED_WALL = endWallWithDoor(SHELL.minZ, X, BATHROOM_DOOR_POSITION[0]);
const FAR_WALL = endWallWithDoor(SHELL.maxZ, X);
const LEFT_WALL = sideWallPlain(SHELL.minX, Z);
const RIGHT_WALL = sideWallPlain(SHELL.maxX, Z);
const FLOOR = floorPart(SHELL);
const PLINTH = plinthParts(SHELL);

const [, sink] = BATHROOM_COLLIDERS;

/**
 * 세면대 위에 놓인 열쇠 (자리 표시자 체인의 첫 물건, src/data/doors.ts). 대야 가장자리에
 * 얹혀 있다. 다가감 판정은 세면대 앞 한 걸음이다.
 */
const KEY = {
  position: [(sink.minX + sink.maxX) / 2 + 0.28, 0.87, sink.maxZ - 0.32] as Vec3Tuple,
  near: [(sink.minX + sink.maxX) / 2, sink.minZ - 0.5] as readonly [number, number],
  interactionRadius: 1.6,
} as const;

function Box({
  part,
  color,
  metalness = 0,
  roughness = 0.85,
}: {
  part: ShellPart;
  color: string;
  metalness?: number;
  roughness?: number;
}) {
  return (
    <mesh position={part.position} castShadow receiveShadow>
      <boxGeometry args={part.size} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  );
}

/**
 * 화장실 (v3). 거실 앞벽 너머의 작은 타일 방. 도기·타일·금속 수전의 재질 차이를 낮은 조도에서도 읽게 한다.
 * 어떤 단서가 여기 놓일지는 방탈출 설계와 함께 정한다 (docs/content-design.md 3-1).
 *
 * 벽은 밝은 타일(linen), 바닥은 한 톤 어두운 타일(trim). 방·거실과 다른 재질이라
 * 문 하나 건넜을 뿐인데 공기가 달라진다.
 */
export function BathroomShell({ palette }: { palette: RoomPalette }) {
  return (
    <group name="bathroom-shell">
      {PLINTH.map((part, index) => (
        <Box
          key={part.position.join(":")}
          part={part}
          color={index === 0 ? palette.frame : palette.void}
        />
      ))}
      <Box part={FLOOR} color={palette.floor} roughness={0.65} />
      <InteriorSurface
        size={[SHELL.maxX - SHELL.minX - 0.18, SHELL.maxZ - SHELL.minZ - 0.18]}
        cell={[0.38, 0.38]}
        position={[CENTER[0], 0.004, CENTER[1]]}
        rotation={[-Math.PI / 2, 0, 0]}
        color={palette.trim}
        shade={palette.floor}
      />
      {/* 바닥 타일의 물때: 30일 안 쓴 화장실. 타일 판(두께 0.018) 바로 위에 곱셈으로 얹힌다 */}
      <BathroomStain
        size={[SHELL.maxX - SHELL.minX - 0.18, SHELL.maxZ - SHELL.minZ - 0.18]}
        position={[CENTER[0], 0.016, CENTER[1]]}
        rotation={[-Math.PI / 2, 0, 0]}
        seed={3}
      />

      {/* 공유벽(뒷벽)은 카메라 쪽이 아니라 늘 서 있다. 걷히는 규칙은 방과 같되 중심이 이 공간이다 */}
      {SHARED_WALL.map((part) => (
        <Box key={part.position.join(":")} part={part} color={palette.linen} roughness={0.5} />
      ))}
      <Box part={LEFT_WALL.stub} color={palette.linen} roughness={0.5} />
      <Box part={RIGHT_WALL.stub} color={palette.linen} roughness={0.5} />
      {FAR_WALL.slice(0, 1).map((part) => (
        <Box key={part.position.join(":")} part={part} color={palette.linen} roughness={0.5} />
      ))}
      <CulledWall side="left" center={CENTER}>
        <Box part={LEFT_WALL.upper} color={palette.linen} roughness={0.5} />
        <InteriorSurface
          size={[SHELL.maxZ - SHELL.minZ - 0.2, 1.6]}
          cell={[0.55, 0.32]}
          position={[SHELL.minX + 0.105, 1.12, CENTER[1]]}
          rotation={[0, Math.PI / 2, 0]}
          color={palette.trim}
          shade={palette.linen}
        />
      </CulledWall>
      <CulledWall side="right" center={CENTER}>
        <Box part={RIGHT_WALL.upper} color={palette.linen} roughness={0.5} />
        <InteriorSurface
          size={[SHELL.maxZ - SHELL.minZ - 0.2, 2.3]}
          cell={[0.55, 0.32]}
          position={[SHELL.maxX - 0.105, 1.47, CENTER[1]]}
          rotation={[0, -Math.PI / 2, 0]}
          color={palette.trim}
          shade={palette.linen}
        />
        {/* 샤워 벽 아랫단의 물때: 물이 튀던 자리라 무늬가 가장 진하다 */}
        <BathroomStain
          size={[SHELL.maxZ - SHELL.minZ - 0.2, 1.1]}
          position={[SHELL.maxX - 0.105 - 0.012, 0.87, CENTER[1]]}
          rotation={[0, -Math.PI / 2, 0]}
          seed={11}
        />
        <BathroomShower palette={palette} />
      </CulledWall>
      <CulledWall side="front" center={CENTER}>
        {FAR_WALL.slice(1).map((part) => (
          <Box key={part.position.join(":")} part={part} color={palette.linen} roughness={0.5} />
        ))}
        <InteriorSurface
          size={[SHELL.maxX - SHELL.minX - 0.2, 1.6]}
          cell={[0.55, 0.32]}
          position={[CENTER[0], 1.12, SHELL.maxZ - 0.105]}
          rotation={[0, Math.PI, 0]}
          color={palette.trim}
          shade={palette.linen}
        />
        <BathroomMirror palette={palette} />
      </CulledWall>

      <BathroomFixtures palette={palette} />

      {/* 안방 열쇠: 손잡이 고리와 날. 집으면 사라진다 */}
      <ItemPickup id="parents-key" near={KEY.near} radius={KEY.interactionRadius}>
        <group position={KEY.position} rotation={[0, 0.6, 0]}>
          <mesh castShadow>
            <torusGeometry args={[0.05, 0.016, 8, 16]} />
            <meshStandardMaterial color={palette.amber} metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0.11, 0, 0]} castShadow>
            <boxGeometry args={[0.14, 0.012, 0.03]} />
            <meshStandardMaterial color={palette.amber} metalness={0.7} roughness={0.35} />
          </mesh>
        </group>
      </ItemPickup>
    </group>
  );
}
