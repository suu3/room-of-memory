"use client";

import { CulledWall } from "./CulledWall";
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

const [toilet, sink, tub] = BATHROOM_COLLIDERS;
/** 발자국(layout의 BATHROOM_COLLIDERS)에 맞춰 세운 소품. 자리를 옮기면 거기도 같이. */
const FIXTURES = [
  // 변기: 물탱크와 좌대
  {
    size: [0.7, 0.42, 0.66],
    position: [(toilet.minX + toilet.maxX) / 2, 0.21, toilet.minZ + 0.36],
    color: "linen",
  },
  {
    size: [0.62, 0.7, 0.2],
    position: [(toilet.minX + toilet.maxX) / 2, 0.55, toilet.maxZ - 0.12],
    color: "linen",
  },
  // 세면대: 기둥과 대야
  {
    size: [0.3, 0.7, 0.3],
    position: [(sink.minX + sink.maxX) / 2, 0.35, sink.maxZ - 0.25],
    color: "linen",
  },
  {
    size: [0.86, 0.14, 0.56],
    position: [(sink.minX + sink.maxX) / 2, 0.78, sink.maxZ - 0.3],
    color: "linen",
  },
  // 욕조
  {
    size: [tub.maxX - tub.minX, 0.6, tub.maxZ - tub.minZ],
    position: [(tub.minX + tub.maxX) / 2, 0.3, (tub.minZ + tub.maxZ) / 2],
    color: "linen",
  },
] as const satisfies readonly { size: Vec3Tuple; position: Vec3Tuple; color: keyof RoomPalette }[];

/**
 * 세면대 위에 놓인 열쇠 (자리 표시자 체인의 첫 물건, src/data/doors.ts). 대야 가장자리에
 * 얹혀 있다. 다가감 판정은 세면대 앞 한 걸음이다.
 */
const KEY = {
  position: [(sink.minX + sink.maxX) / 2 + 0.28, 0.87, sink.maxZ - 0.32] as Vec3Tuple,
  near: [(sink.minX + sink.maxX) / 2, sink.minZ - 0.5] as readonly [number, number],
  interactionRadius: 1.6,
} as const;

/** 세면대 위 거울: 매끈한 판. 방의 전신거울과 같은 유리다. */
const MIRROR = {
  size: [0.9, 0.7, 0.03],
  position: [(sink.minX + sink.maxX) / 2, 1.75, SHELL.maxZ - 0.11],
} as const satisfies ShellPart;

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
 * 화장실 (v3). 거실 앞벽 너머의 작은 타일 방. 아직 골격과 소품뿐이다.
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
      <Box part={FLOOR} color={palette.trim} roughness={0.5} />

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
      </CulledWall>
      <CulledWall side="right" center={CENTER}>
        <Box part={RIGHT_WALL.upper} color={palette.linen} roughness={0.5} />
      </CulledWall>
      <CulledWall side="front" center={CENTER}>
        {FAR_WALL.slice(1).map((part) => (
          <Box key={part.position.join(":")} part={part} color={palette.linen} roughness={0.5} />
        ))}
        <Box part={MIRROR} color={palette.storm} metalness={0.85} roughness={0.12} />
      </CulledWall>

      {FIXTURES.map((fixture) => (
        <Box
          key={fixture.position.join(":")}
          part={fixture}
          color={palette[fixture.color]}
          roughness={0.4}
        />
      ))}

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
