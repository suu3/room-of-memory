"use client";

import { selectSheetBeckons, useMemoryRoomStore } from "@/store/memory-room";
import { ItemPickup } from "../../memory/ItemPickup";
import { InteriorSurface } from "../../shared/InteriorPrimitives";
import { CulledWall } from "../../world/CulledWall";
import { PARENTS_COLLIDERS, PARENTS_DOOR_POSITION, PARENTS_SHELL_BOUNDS } from "../../world/layout";
import type { RoomPalette } from "../../world/palette";
import {
  endWallWithDoor,
  floorPart,
  plinthParts,
  type ShellPart,
  sideWallPlain,
  sideWallWithDoor,
} from "../../world/space-shell";
import type { Vec3Tuple } from "../../world/types";
import { ParentsRoomFurniture } from "./ParentsRoomFurniture";

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

/**
 * 서류 옆에 놓인 찢어진 악보 조각: 집어 가면 거실 피아노의 지워진 마디가 드러난다
 * (src/minigames/piano-melody). 서류와 같은 책상, 같은 다가감 반경이라 한 번 다가서면
 * 둘 다 켜진다: 조각만 놓치고 돌아서는 일이 없게.
 *
 * 종이 한 장이라 얇고, 서류 뭉치보다 조금 앞으로 나와 겹치지 않는다.
 */
const SHEET_SCRAP = [
  {
    size: [0.3, 0.012, 0.22],
    position: [desk.minX + 1.32, 1.13, desk.minZ + 0.36],
    color: "linen",
  },
  // 그려진 오선 한 줄. 이게 없으면 이 거리에서는 그냥 흰 조각이다
  {
    size: [0.22, 0.004, 0.02],
    position: [desk.minX + 1.32, 1.14, desk.minZ + 0.36],
    color: "frame",
  },
] as const satisfies readonly { size: Vec3Tuple; position: Vec3Tuple; color: keyof RoomPalette }[];
/** 조각 표식이 서는 자리: 조각 위, 책상 윗면 높이. */
const SHEET_BEACON: Vec3Tuple = [...SHEET_SCRAP[0].position];

/** 악보 조각에 다가서는 자리: 책상 앞 한 걸음. */
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
 * 안방 (v3). 거실 -x 벽 너머, 가장 오래 닫혀 있던 공간. 낮은 목가구와 겹쳐진 침구에 생활의 흔적이 남아 있다.
 *
 * 4페이즈의 클라이막스 (v4 3-6). 연구 일지·출입증·소집 공지(기억 셋)가 부모님이
 * 연구원이었다는 것, 앰플이 치료제 후보라는 것, 여행이 아니었다는 것을 흘린다.
 * 무엇을 알았고 어디로 갔는지는 끝까지 미공개다 (docs/story/story.md 1장).
 *
 * 벽은 차분한 세이지, 바닥은 거실과 같은 마루. 부모님이 꾸민 공간이라 방(네이비)과 다르다.
 */
export function ParentsRoomShell({ palette }: { palette: RoomPalette }) {
  const sheetBeckons = useMemoryRoomStore(selectSheetBeckons);
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
      {/* 책상 위 서류·출입증과 침대 위 봉투는 기억이다 (MemoryObjects의 안방 몫) */}
      {/* 피아노의 빈 마디를 봤거나 안방 조사를 다 마친 뒤부터 조각이 부른다. 그 전에는 책상 위의 종잇조각일 뿐이다 */}
      <ItemPickup
        id="piano-sheet"
        near={PAPERS_NEAR.near}
        radius={PAPERS_NEAR.interactionRadius}
        beacon={{ position: SHEET_BEACON, palette }}
        beckon={sheetBeckons}
      >
        {SHEET_SCRAP.map((piece) => (
          <Box key={piece.position.join(":")} part={piece} color={palette[piece.color]} />
        ))}
      </ItemPickup>
    </group>
  );
}
