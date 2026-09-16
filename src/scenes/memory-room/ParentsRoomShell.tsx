"use client";

import { CulledWall } from "./CulledWall";
import { InteriorSurface } from "./InteriorPrimitives";
import { PARENTS_COLLIDERS, PARENTS_DOOR_POSITION, PARENTS_SHELL_BOUNDS } from "./layout";
import { ParentsRoomFurniture } from "./ParentsRoomFurniture";
import type { RoomPalette } from "./palette";
import { ClueProp } from "./RoomClues";
import {
  endWallWithDoor,
  floorPart,
  plinthParts,
  type ShellPart,
  sideWallPlain,
  sideWallWithDoor,
} from "./space-shell";
import type { Vec3Tuple } from "./types";

const SHELL = PARENTS_SHELL_BOUNDS;
const CENTER: readonly [number, number] = [
  (SHELL.minX + SHELL.maxX) / 2,
  (SHELL.minZ + SHELL.maxZ) / 2,
];
const X = { min: SHELL.minX, max: SHELL.maxX };
const Z = { min: SHELL.minZ, max: SHELL.maxZ };

/** 거실과의 공유벽(maxX, 카메라 쪽): 문 자리를 비운다. 걷히면 굽도리 두 토막만 남는다. */
const SHARED_WALL = sideWallWithDoor(SHELL.maxX, Z, PARENTS_DOOR_POSITION[2]);
const FAR_WALL = sideWallPlain(SHELL.minX, Z);
const BACK_WALL = endWallWithDoor(SHELL.minZ, X);
const FRONT_WALL = endWallWithDoor(SHELL.maxZ, X);
const FLOOR = floorPart(SHELL);
const PLINTH = plinthParts(SHELL);

const [, , desk] = PARENTS_COLLIDERS;

/** 책상 위 서류 뭉치: 집어 들면 펼쳐진다 (ClueOverlay의 research-note). 다가감은 책상 앞 한 걸음. */
const PAPERS = [
  { size: [0.55, 0.06, 0.4], position: [desk.minX + 0.6, 1.15, desk.minZ + 0.4], color: "linen" },
  { size: [0.5, 0.05, 0.36], position: [desk.minX + 0.72, 1.2, desk.minZ + 0.32], color: "linen" },
] as const satisfies readonly { size: Vec3Tuple; position: Vec3Tuple; color: keyof RoomPalette }[];
const PAPERS_NEAR = {
  near: [(desk.minX + desk.maxX) / 2, desk.minZ - 0.5] as readonly [number, number],
  interactionRadius: 1.8,
} as const;

function Box({
  part,
  color,
  roughness = 0.85,
}: {
  part: ShellPart;
  color: string;
  roughness?: number;
}) {
  return (
    <mesh position={part.position} castShadow receiveShadow>
      <boxGeometry args={part.size} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

/**
 * 안방 (v3). 거실 -x 벽(현관 쪽) 너머, 가장 오래 닫혀 있던 공간. 낮은 목가구와 겹쳐진 침구에 생활의 흔적이 남아 있다.
 *
 * 떡밥의 금고다: 부모님이 연구원이었다는 것과 앰플이 치료제 같다는 것**까지만** 흘린다.
 * 무엇을 알았고 어디로 갔는지는 끝까지 미공개다 (docs/story.md 1장). 책상 위 서류
 * 뭉치가 그 자리다. 어떤 단서를 놓을지는 방탈출 설계와 함께 정한다.
 *
 * 벽은 차분한 세이지, 바닥은 거실과 같은 마루. 부모님이 꾸민 공간이라 방(네이비)과 다르다.
 */
export function ParentsRoomShell({ palette }: { palette: RoomPalette }) {
  return (
    <group name="parents-room-shell">
      {PLINTH.map((part, index) => (
        <Box
          key={part.position.join(":")}
          part={part}
          color={index === 0 ? palette.frame : palette.void}
        />
      ))}
      <Box part={FLOOR} color={palette.frame} />
      <InteriorSurface
        size={[SHELL.maxX - SHELL.minX - 0.18, SHELL.maxZ - SHELL.minZ - 0.18]}
        cell={[1.3, 0.24]}
        position={[CENTER[0], 0.004, CENTER[1]]}
        rotation={[-Math.PI / 2, 0, 0]}
        color={palette.wood}
        shade={palette.linen}
        gap={0.008}
        roughness={0.85}
      />

      {/* 굽도리는 늘 남는다 */}
      {[SHARED_WALL[0], SHARED_WALL[1], BACK_WALL[0], FRONT_WALL[0], FAR_WALL.stub].map((part) => (
        <Box key={part.position.join(":")} part={part} color={palette.trim} />
      ))}
      <CulledWall side="back" center={CENTER}>
        <Box part={BACK_WALL[1]} color={palette.sage} />
      </CulledWall>
      <CulledWall side="front" center={CENTER}>
        <Box part={FRONT_WALL[1]} color={palette.sage} />
      </CulledWall>
      <CulledWall side="left" center={CENTER}>
        <Box part={FAR_WALL.upper} color={palette.sage} />
      </CulledWall>
      {/* 공유벽(오른벽)은 카메라 쪽이라 걷힌다. 문틀은 SpaceDoor가 씬 층위에 세운다 */}
      <CulledWall side="right" center={CENTER}>
        {SHARED_WALL.slice(2).map((part) => (
          <Box key={part.position.join(":")} part={part} color={palette.sage} />
        ))}
      </CulledWall>

      <ParentsRoomFurniture palette={palette} />
      <ClueProp clue="research-note" near={PAPERS_NEAR.near} radius={PAPERS_NEAR.interactionRadius}>
        {PAPERS.map((piece) => (
          <Box key={piece.position.join(":")} part={piece} color={palette[piece.color]} />
        ))}
      </ClueProp>
    </group>
  );
}
