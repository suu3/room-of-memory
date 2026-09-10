"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, MeshStandardMaterial } from "three";
import { playSound } from "@/lib/audio";
import { selectBatTaken, selectFrontDoorUnlocked, useMemoryRoomStore } from "@/store/memory-room";
import { CulledWall } from "./CulledWall";
import {
  FRONT_DOOR_INTERACTION,
  FRONT_DOOR_POSITION,
  FRONT_DOOR_ROTATION,
  LIVING_SHELL_BOUNDS,
  LIVING_SHELL_CENTER,
  ROOM_DOOR_LEAF,
  ROOM_DOOR_POSITION,
} from "./layout";
import { approach } from "./memory-motion";
import type { RoomPalette } from "./palette";
import { DOOR_HOLE_Z } from "./RoomShell";
import type { Vec3Tuple } from "./types";
import { useGlowHover } from "./use-glow-hover";
import { useNearPlayer } from "./use-near-player";

/**
 * 방문 너머의 거실 (docs/content-design.md 3-1).
 *
 * 아직 골격뿐이다. 바닥·벽·현관문. 가구(소파·TV·식탁·신발장)와 미궁 문제는
 * 다음 단계에서 선다. 벽 치수는 RoomShell과 같은 값을 쓴다: 같은 집이라 벽
 * 높이·두께·굽도리가 다르면 문 하나 건넜을 뿐인데 다른 건물이 된다.
 *
 * +x 쪽 벽은 없다. 방의 왼벽(x = ROOM_SHELL_BOUNDS.minX)이 그 자리다. 여기서
 * 또 세우면 문간에 벽이 두 겹으로 서서 지나갈 때 z-fighting이 난다.
 */

const WALL_HEIGHT = 4.8;
const WALL_THICKNESS = 0.18;
const WALL_CENTER_Y = 2.3;
const WALL_STUB_TOP_Y = 0.55;
const WALL_Y = { min: WALL_CENTER_Y - WALL_HEIGHT / 2, max: WALL_CENTER_Y + WALL_HEIGHT / 2 };

const WIDTH = LIVING_SHELL_BOUNDS.maxX - LIVING_SHELL_BOUNDS.minX;
const DEPTH = LIVING_SHELL_BOUNDS.maxZ - LIVING_SHELL_BOUNDS.minZ;
const [CENTER_X, CENTER_Z] = LIVING_SHELL_CENTER;

interface ShellPart {
  size: Vec3Tuple;
  position: Vec3Tuple;
}

/** z축을 보는 벽 (앞·뒤). 공유벽 쪽(+x)은 방 벽에 닿기 직전까지만 뻗는다. */
function endWall(z: number, minY: number, maxY: number): ShellPart {
  return {
    size: [WIDTH, maxY - minY, WALL_THICKNESS],
    position: [CENTER_X, (minY + maxY) / 2, z],
  };
}

/** x축을 보는 벽 (-x 끝, 현관 쪽). */
function sideWall(x: number, minY: number, maxY: number): ShellPart {
  return {
    size: [WALL_THICKNESS, maxY - minY, DEPTH],
    position: [x, (minY + maxY) / 2, CENTER_Z],
  };
}

const FLOOR: ShellPart = {
  size: [WIDTH, 0.22, DEPTH],
  position: [CENTER_X, -0.12, CENTER_Z],
};

/** 방과 같은 디오라마 받침: 한 받침 위의 한 집으로 읽혀야 한다 (RoomShell의 PLINTH). */
const PLINTH = [
  { size: [WIDTH + 0.5, 0.14, DEPTH + 0.5], position: [CENTER_X, -0.28, CENTER_Z] },
  { size: [WIDTH + 0.14, 0.55, DEPTH + 0.14], position: [CENTER_X, -0.6, CENTER_Z] },
] as const satisfies readonly ShellPart[];

const BASE_WALLS = [
  endWall(LIVING_SHELL_BOUNDS.minZ, WALL_Y.min, WALL_STUB_TOP_Y),
  endWall(LIVING_SHELL_BOUNDS.maxZ, WALL_Y.min, WALL_STUB_TOP_Y),
  sideWall(LIVING_SHELL_BOUNDS.minX, WALL_Y.min, WALL_STUB_TOP_Y),
] as const satisfies readonly ShellPart[];

const BACK_WALL_UPPER = endWall(LIVING_SHELL_BOUNDS.minZ, WALL_STUB_TOP_Y, WALL_Y.max);
const FRONT_WALL_UPPER = endWall(LIVING_SHELL_BOUNDS.maxZ, WALL_STUB_TOP_Y, WALL_Y.max);
const LEFT_WALL_UPPER = sideWall(LIVING_SHELL_BOUNDS.minX, WALL_STUB_TOP_Y, WALL_Y.max);

const DOOR_FRAME = [
  { size: [0.18, 3.62, 0.18], position: [-0.82, 0.09, 0] },
  { size: [0.18, 3.62, 0.18], position: [0.82, 0.09, 0] },
  { size: [1.82, 0.18, 0.18], position: [0, 1.81, 0] },
] as const satisfies readonly ShellPart[];

/*
 * 방으로 돌아가는 문간: 공유벽(x = LIVING_SHELL_BOUNDS.maxX)의 거실 쪽 얼굴.
 *
 * 거실에 있는 동안 방은 통째로 숨는다(MemoryRoomScene). 그러면 공유벽과 방문도 같이
 * 사라져 거실의 +x 변은 바닥이 허공으로 끊긴 단면이 되고, 어디로 되돌아가는지 읽을 수
 * 없었다. 그래서 그 변에 거실 것을 따로 세운다: 다른 세 면과 같은 굽도리(문 자리는
 * 비운다)와 문턱에 고인 방의 빛. 문틀·문짝은 그리지 않는다. 이 변은 카메라 쪽이라
 * 키 큰 문틀이 거실을 가리고, 문짝은 숨은 방의 허공에 뜬 판이 된다. 방에 있는 동안은
 * 거실이 통째로 숨으므로 방의 왼벽과 겹쳐 깜빡일 일은 없다.
 *
 * 누르는 물건은 아니다. 문턱을 넘으면 방이다.
 */
const SHARED_WALL_X = LIVING_SHELL_BOUNDS.maxX;

/** 공유벽 굽도리 한 토막: 방의 왼벽 굽도리와 같은 자리에서 문 개구부(DOOR_HOLE_Z)를 비운다. */
function sharedWallStub(minZ: number, maxZ: number): ShellPart {
  return {
    size: [WALL_THICKNESS, WALL_STUB_TOP_Y - WALL_Y.min, maxZ - minZ],
    position: [SHARED_WALL_X, (WALL_Y.min + WALL_STUB_TOP_Y) / 2, (minZ + maxZ) / 2],
  };
}

export const ROOM_DOORWAY_STUBS = [
  sharedWallStub(LIVING_SHELL_BOUNDS.minZ, DOOR_HOLE_Z.min),
  sharedWallStub(DOOR_HOLE_Z.max, LIVING_SHELL_BOUNDS.maxZ),
] as const satisfies readonly ShellPart[];

/** 문턱 안쪽 거실 바닥에 고인 빛: 방에서 새어 나온다. 문틀 폭보다 조금 좁게. */
const THRESHOLD_GLOW: ShellPart = {
  size: [1.1, 0.02, DOOR_HOLE_Z.max - DOOR_HOLE_Z.min - 0.24],
  position: [SHARED_WALL_X - 0.7, 0.012, ROOM_DOOR_POSITION[2]],
};

function RoomDoorway({ palette }: { palette: RoomPalette }) {
  return (
    <group name="room-doorway">
      {ROOM_DOORWAY_STUBS.map((part) => (
        <ShellBox key={part.position.join(":")} part={part} color={palette.trim} />
      ))}
      <ShellBox
        part={THRESHOLD_GLOW}
        color={palette.memory}
        emissive={palette.memory}
        emissiveIntensity={0.45}
      />
      {/* 방에서 문간으로 떨어지는 빛: 현관 쪽 빛과 같은 문법, 방향만 반대다 */}
      <pointLight
        position={[SHARED_WALL_X - 0.6, 2.2, ROOM_DOOR_POSITION[2]]}
        color={palette.memory}
        intensity={0.55}
        distance={6}
        decay={2}
      />
    </group>
  );
}

/** 준비 전에도 아주 옅게 빛난다. "저 문이 출구다"까지만 말한다 (배트와 같은 문법). */
const DORMANT_EMISSIVE = 0.04;
const READY_EMISSIVE = 0.65;

function ShellBox({
  part,
  color,
  emissive,
  emissiveIntensity = 0,
}: {
  part: ShellPart;
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  return (
    <mesh position={part.position} receiveShadow>
      <boxGeometry args={part.size} />
      <meshStandardMaterial
        color={color}
        emissive={emissive ?? color}
        emissiveIntensity={emissiveIntensity}
        roughness={0.82}
      />
    </mesh>
  );
}

/**
 * 현관문: 3막의 마지막 물건 (docs/content-design.md 3-2).
 *
 * 잠금이 안 풀렸으면 클릭이 잠금 화면(글자 세 쌍 미궁, angle-turn)을 연다.
 * 각도를 읽는 법은 방의 탁상시계가 들고 있다. 도해가 30일 전에 자기 손으로
 * 걸어 잠근 문이라, 나가려면 그걸 먼저 풀어야 한다.
 *
 * 금빛으로 켜지는 것은 **배트를 쥔 뒤**다. 배트는 앰플을 손에 넣어야 켜지므로
 * (selectBatReady), 문이 열릴 때 도해의 손에는 배트와 앰플이 둘 다 있다.
 */
function FrontDoor({ palette }: { palette: RoomPalette }) {
  const ready = useMemoryRoomStore(selectBatTaken);
  const unlocked = useMemoryRoomStore(selectFrontDoorUnlocked);
  const started = useMemoryRoomStore((state) => state.endingStarted);
  const startEnding = useMemoryRoomStore((state) => state.startEnding);
  const openPuzzle = useMemoryRoomStore((state) => state.openPuzzle);
  // 잠긴 동안은 언제든 눌러 잠금을 들여다볼 수 있고, 풀린 뒤에는 엔딩이 준비돼야 눌린다
  const clickable = !started && (!unlocked || ready);
  const { hovered, handlers } = useGlowHover(clickable);
  const near = useNearPlayer(
    FRONT_DOOR_INTERACTION.near[0],
    FRONT_DOOR_INTERACTION.near[1],
    FRONT_DOOR_INTERACTION.interactionRadius,
  );
  const leafRef = useRef<Group>(null);
  const glowRef = useRef(DORMANT_EMISSIVE);

  useFrame((_, delta) => {
    const leaf = leafRef.current;
    if (!leaf) return;
    // 열리는 각도는 방문과 같은 문법: 다만 밖으로 민다
    leaf.rotation.y = approach(leaf.rotation.y, started ? ROOM_DOOR_LEAF.openAngle : 0, 4, delta);
    glowRef.current = approach(
      glowRef.current,
      clickable && (hovered || near) ? READY_EMISSIVE : ready ? 0.3 : DORMANT_EMISSIVE,
      3,
      delta,
    );
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      name="front-door"
      position={FRONT_DOOR_POSITION}
      rotation={FRONT_DOOR_ROTATION}
      onClick={(event) => {
        if (!clickable) return;
        event.stopPropagation();
        if (!unlocked) {
          // 잠금 화면부터: 문제가 풀려야 문이 열 물건이 된다
          playSound("select");
          openPuzzle("angle-turn");
          return;
        }
        playSound("open");
        startEnding();
      }}
      {...handlers}
    >
      <group ref={leafRef}>
        <FrontDoorLeaf palette={palette} ready={ready} glowRef={glowRef} />
      </group>
      {DOOR_FRAME.map((part) => (
        <ShellBox key={part.position.join(":")} part={part} color={palette.frame} />
      ))}
    </group>
  );
}

/** 문짝: 금빛은 프레임마다 glowRef 값을 받아 올라온다 (재질 재생성 없이). */
function FrontDoorLeaf({
  palette,
  ready,
  glowRef,
}: {
  palette: RoomPalette;
  ready: boolean;
  glowRef: { current: number };
}) {
  const materialRef = useRef<MeshStandardMaterial>(null);

  useFrame(() => {
    if (materialRef.current) materialRef.current.emissiveIntensity = glowRef.current;
  });

  return (
    <>
      <mesh castShadow>
        <boxGeometry args={[1.45, 3.4, 0.12]} />
        <meshStandardMaterial
          ref={materialRef}
          color={ready ? palette.memory : palette.wood}
          emissive={palette.memory}
          emissiveIntensity={DORMANT_EMISSIVE}
          roughness={0.82}
        />
      </mesh>
      <mesh position={[0.48, 0, 0.1]}>
        <boxGeometry args={[0.11, 0.11, 0.1]} />
        <meshStandardMaterial color={palette.amber} roughness={0.82} />
      </mesh>
    </>
  );
}

export function LivingRoomShell({ palette }: { palette: RoomPalette }) {
  /*
   * 색이 방과 다르다. 방은 도해 취향의 깊은 네이비 벽인데, 거실은 부모님이
   * 꾸민 밝은 벽지(linen)다. 문 하나 건넜을 뿐인데 공기가 달라지는 게 이 색 차이가
   * 하는 일의 전부다. 바닥은 마루 느낌의 우드.
   */
  return (
    <group name="living-room-shell">
      {PLINTH.map((part, index) => (
        <ShellBox
          key={part.position.join(":")}
          part={part}
          color={index === 0 ? palette.frame : palette.void}
        />
      ))}
      <ShellBox part={FLOOR} color={palette.wood} />

      {BASE_WALLS.map((part) => (
        <ShellBox key={part.position.join(":")} part={part} color={palette.trim} />
      ))}

      {/* 걷히는 규칙은 방과 같되, 중심이 거실이다. 카메라가 거실의 어느 쪽에
          있느냐로 계산해야 앞벽만 걷히고 뒷벽·현관벽은 서 있는다 */}
      <CulledWall side="back" center={LIVING_SHELL_CENTER}>
        <ShellBox part={BACK_WALL_UPPER} color={palette.linen} />
      </CulledWall>
      <CulledWall side="front" center={LIVING_SHELL_CENTER}>
        <ShellBox part={FRONT_WALL_UPPER} color={palette.linen} />
      </CulledWall>
      <CulledWall side="left" center={LIVING_SHELL_CENTER}>
        <ShellBox part={LEFT_WALL_UPPER} color={palette.linen} />
      </CulledWall>

      <FrontDoor palette={palette} />
      <RoomDoorway palette={palette} />

      {/* 현관 쪽에서 새어 드는 빛: 방문 밑 금빛 틈의 출처가 여기다 */}
      <pointLight
        position={[FRONT_DOOR_POSITION[0] + 0.8, 2.4, FRONT_DOOR_POSITION[2]]}
        color={palette.memory}
        intensity={0.5}
        distance={7}
        decay={2}
      />
    </group>
  );
}
