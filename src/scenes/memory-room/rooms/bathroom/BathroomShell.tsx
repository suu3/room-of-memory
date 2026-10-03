"use client";

import { playSound } from "@/lib/audio";
import { pressSinkCabinet } from "@/lib/room-press";
import { useMemoryRoomStore } from "@/store/memory-room";
import { BathroomStain } from "../../effects/BathroomStains";
import { TouchProp } from "../../memory/RoomClues";
import { InteriorSurface } from "../../shared/InteriorPrimitives";
import { CulledWall } from "../../world/CulledWall";
import { BATHROOM_DOOR_POSITION, BATHROOM_SHELL_BOUNDS } from "../../world/layout";
import type { RoomPalette } from "../../world/palette";
import {
  endWallWithDoor,
  floorPart,
  plinthParts,
  type ShellPart,
  sideWallPlain,
} from "../../world/space-shell";
import type { Vec3Tuple } from "../../world/types";
import {
  BathroomFixtures,
  BathroomMirror,
  BathroomShower,
  SINK_MOUNT,
  SINK_NEAR,
  SINK_RADIUS,
} from "./BathroomFixtures";

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

/**
 * 대야 밑 하부장 (v4 3-5): 엄마가 잠가 둔 칸. 다이얼(sink-dial)의 답은 선반 책 속 쪽지의 세 자리.
 * 세면대 틀(SINK_MOUNT)의 로컬 좌표: 문짝과 다이얼은 로컬 -z 면, 곧 카메라 쪽이다.
 */
const CABINET = {
  position: [0, 0.31, 0.02] as Vec3Tuple,
  size: [0.72, 0.62, 0.42] as Vec3Tuple,
} as const;
/** 대야 한쪽 테두리의 칫솔컵 (세면대 로컬, 비누 접시 반대편): 칫솔 셋, 하나만 젖어 있다. */
const CUP_POSITION: Vec3Tuple = [0.32, 0.87, 0.03];

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
 * 어떤 단서가 여기 놓일지는 방탈출 설계와 함께 정한다 (docs/story/content-design.md 3-1).
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
      {/* 왼쪽 벽은 카메라 반대쪽이라 늘 서 있다. 세면대와 거울이 여기 붙는다 (SINK_MOUNT) */}
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
        <BathroomMirror palette={palette} />
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
      </CulledWall>

      <BathroomFixtures palette={palette} />

      <SinkCabinet palette={palette} />
      <ToothbrushCup palette={palette} />
    </group>
  );
}

/**
 * 세면대 하부장. 아빠 메일 힌트(컴퓨터 3차)를 보기 전에는 누르면 혼잣말만 흐르고,
 * 본 뒤에는 다이얼이 열린다. 열리면 안방 열쇠가 손에 들어오고(store의 finishPuzzle)
 * 문짝이 살짝 벌어진 채로 남는다.
 *
 * 세면대 틀(SINK_MOUNT) 안에 선다. 문짝·다이얼이 달린 앞면이 카메라를 봐야 "잠긴 칸"으로
 * 읽힌다: 안쪽 벽에 붙어 있던 때는 앞면이 카메라 반대쪽이라 밋밋한 상자로만 보였다.
 */
function SinkCabinet({ palette }: { palette: RoomPalette }) {
  const opened = useMemoryRoomStore((state) => state.solvedPuzzles.includes("sink-dial"));
  const [x, y, z] = CABINET.position;
  const [width, height, depth] = CABINET.size;
  const front = z - depth / 2;

  return (
    <TouchProp
      name="sink-cabinet"
      near={SINK_NEAR}
      radius={SINK_RADIUS}
      enabled={!opened}
      onPress={pressSinkCabinet}
    >
      <group name="sink-cabinet" position={SINK_MOUNT.position} rotation={SINK_MOUNT.rotation}>
        <mesh position={[x, y, z]} castShadow receiveShadow>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color={palette.linen} roughness={0.6} />
        </mesh>
        {/* 문짝 둘. 열리면 오른쪽 문이 살짝 벌어진다 */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[x + side * (width / 4), y, front - 0.012]}
            rotation={[0, opened && side === 1 ? -0.5 : 0, 0]}
            castShadow
          >
            <boxGeometry args={[width / 2 - 0.02, height - 0.06, 0.02]} />
            <meshStandardMaterial color={palette.trim} roughness={0.55} />
          </mesh>
        ))}
        {/* 다이얼 자물쇠: 두 문 사이의 작은 원판 */}
        <mesh position={[x, y + 0.1, front - 0.03]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.02, 16]} />
          <meshStandardMaterial color={palette.amber} metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
    </TouchProp>
  );
}

/** 칫솔컵 (v4 3-5 쉼표 비트): 누르면 한 줄. 진행에는 아무것도 남기지 않는다. */
function ToothbrushCup({ palette }: { palette: RoomPalette }) {
  const sayRemark = useMemoryRoomStore((state) => state.sayRemark);
  return (
    <TouchProp
      name="toothbrush-cup"
      near={SINK_NEAR}
      radius={SINK_RADIUS}
      onPress={() => {
        playSound("select");
        sayRemark("toothbrush");
      }}
    >
      <group name="toothbrush-cup" position={SINK_MOUNT.position} rotation={SINK_MOUNT.rotation}>
        <group position={CUP_POSITION}>
          <mesh position={[0, 0.05, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.034, 0.1, 12]} />
            <meshStandardMaterial color={palette.sage} roughness={0.5} />
          </mesh>
          {/* 칫솔 셋: 하나만 젖어서 색이 짙다 */}
          {(
            [
              [-0.015, -0.12, palette.clay],
              [0.012, 0.1, palette.daylight],
              [0.0, 0.0, palette.frame],
            ] as const
          ).map(([dx, tilt, color]) => (
            <mesh key={`${dx}:${tilt}`} position={[dx, 0.14, 0]} rotation={[0, 0, tilt]} castShadow>
              <boxGeometry args={[0.012, 0.18, 0.012]} />
              <meshStandardMaterial color={color} roughness={0.4} />
            </mesh>
          ))}
        </group>
      </group>
    </TouchProp>
  );
}
