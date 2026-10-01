"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { playSound } from "@/lib/audio";
import { selectExitReady, useMemoryRoomStore } from "@/store/memory-room";
import { setEndingLightMesh } from "../../effects/ending-light";
import { useGlowHover } from "../../effects/use-glow-hover";
import { approach } from "../../memory/memory-motion";
import { useNearPlayer } from "../../player/use-near-player";
import { InteriorSurface } from "../../shared/InteriorPrimitives";
import { SpaceLight } from "../../shared/SpaceLight";
import { CulledWall } from "../../world/CulledWall";
import {
  BATHROOM_DOOR_POSITION,
  FRONT_DOOR_INTERACTION,
  FRONT_DOOR_INWARD,
  FRONT_DOOR_POSITION,
  FRONT_DOOR_ROTATION,
  LIVING_ENTRY_SHELL,
  LIVING_SHARED_WALL_MIN_Z,
  LIVING_SHELL_BOUNDS,
  LIVING_SHELL_CENTER,
  PARENTS_DOOR_POSITION,
  ROOM_DOOR_LEAF,
  ROOM_DOOR_POSITION,
} from "../../world/layout";
import type { RoomPalette } from "../../world/palette";
import {
  endWallWithDoor,
  WALL_STUB_TOP_Y as SHELL_STUB_TOP_Y,
  WALL_Y as SHELL_WALL_Y,
  sideWallPlain,
  sideWallWithDoors,
  WALL_THICKNESS,
} from "../../world/space-shell";
import type { Vec3Tuple } from "../../world/types";
import { DOOR_HOLE_Z } from "../room/RoomShell";

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

// 벽 치수는 space-shell 한곳의 값이다 (v3). 굽도리 높이도 방·새 공간과 같아야 문턱에서 안 어긋난다
const WALL_STUB_TOP_Y = SHELL_STUB_TOP_Y;
const WALL_Y = SHELL_WALL_Y;

const WIDTH = LIVING_SHELL_BOUNDS.maxX - LIVING_SHELL_BOUNDS.minX;
const DEPTH = LIVING_SHELL_BOUNDS.maxZ - LIVING_SHELL_BOUNDS.minZ;
const [CENTER_X, CENTER_Z] = LIVING_SHELL_CENTER;

interface ShellPart {
  size: Vec3Tuple;
  position: Vec3Tuple;
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

/*
 * 벽들은 문 자리를 비운 조각들이다 (v3): 앞벽(+z) 너머가 화장실, -x 벽 너머가 안방,
 * 현관 홈의 뒷벽이 현관문. 조각의 앞 둘이 굽도리, 나머지가 윗벽이다 (space-shell의
 * endWallWithDoor·sideWallWithDoor). 안방·화장실의 문틀·문짝은 SpaceDoor가 씬 층위에서
 * 그린다: 어느 쪽에 서 있든 문은 보여야 한다.
 *
 * 뒷벽은 현관 홈(LIVING_ENTRY_SHELL) 폭만큼 비어 있다. 그 자리는 홈의 뒷벽이 2만큼 물러나
 * 막고, +x 벽은 홈의 끝까지 이어진다. 거실 윤곽이 거기서 한 번 꺾인다.
 */
const LIVING_X = { min: LIVING_SHELL_BOUNDS.minX, max: LIVING_SHELL_BOUNDS.maxX };
const BACK_WALL = endWallWithDoor(LIVING_SHELL_BOUNDS.minZ, {
  min: LIVING_SHELL_BOUNDS.minX,
  max: LIVING_ENTRY_SHELL.minX,
});
const FRONT_WALL = endWallWithDoor(LIVING_SHELL_BOUNDS.maxZ, LIVING_X, BATHROOM_DOOR_POSITION[0]);
const LEFT_WALL = sideWallWithDoors(
  LIVING_SHELL_BOUNDS.minX,
  { min: LIVING_SHELL_BOUNDS.minZ, max: LIVING_SHELL_BOUNDS.maxZ },
  [PARENTS_DOOR_POSITION[2]],
);

/*
 * 현관 홈. 현관문 자리도 뚫어 둔다. 엔딩에 도해가 걸어서 문턱을 넘을 때(FirstPersonRig의
 * exit) 열린 문 너머가 벽이면 나갈 데가 없다. 닫혀 있는 동안은 문짝과 문틀이 구멍을 가린다.
 * 홈의 -x 벽은 카메라를 마주 보고 서 있고, +x 쪽은 거실의 +x 벽이 이어져 막는다.
 */
const ENTRY_CENTER = [
  (LIVING_ENTRY_SHELL.minX + LIVING_ENTRY_SHELL.maxX) / 2,
  (LIVING_ENTRY_SHELL.minZ + LIVING_ENTRY_SHELL.maxZ) / 2,
] as const;
const ENTRY_WIDTH = LIVING_ENTRY_SHELL.maxX - LIVING_ENTRY_SHELL.minX;
const ENTRY_DEPTH = LIVING_ENTRY_SHELL.maxZ - LIVING_ENTRY_SHELL.minZ;
const ENTRY_BACK_WALL = endWallWithDoor(
  LIVING_ENTRY_SHELL.minZ,
  { min: LIVING_ENTRY_SHELL.minX, max: LIVING_ENTRY_SHELL.maxX },
  FRONT_DOOR_POSITION[0],
);
const ENTRY_LEFT_WALL = sideWallPlain(LIVING_ENTRY_SHELL.minX, {
  min: LIVING_ENTRY_SHELL.minZ,
  max: LIVING_ENTRY_SHELL.maxZ,
});
const ENTRY_FLOOR: ShellPart = {
  size: [ENTRY_WIDTH, 0.22, ENTRY_DEPTH],
  position: [ENTRY_CENTER[0], -0.12, ENTRY_CENTER[1]],
};
/*
 * 현관 받침: 거실 받침과 같은 두 단을 홈 쪽(-x·-z·+x)으로만 내민다. 거실 받침과 겹치는 띠가
 * 같은 높이면 윗면이 깜빡이므로 한 치 낮춘다.
 */
const ENTRY_PLINTH = [
  {
    size: [ENTRY_WIDTH + 0.5, 0.14, ENTRY_DEPTH + 0.25],
    position: [ENTRY_CENTER[0], -0.284, ENTRY_CENTER[1] - 0.125],
  },
  {
    size: [ENTRY_WIDTH + 0.14, 0.55, ENTRY_DEPTH + 0.07],
    position: [ENTRY_CENTER[0], -0.604, ENTRY_CENTER[1] - 0.035],
  },
] as const satisfies readonly ShellPart[];
/** 거실 마루와 현관 타일이 만나는 선에 놓인 낮은 문턱 (현관 턱). */
const ENTRY_THRESHOLD: ShellPart = {
  size: [ENTRY_WIDTH - 0.18, 0.03, 0.1],
  position: [ENTRY_CENTER[0], 0.015, LIVING_ENTRY_SHELL.maxZ],
};

/*
 * 침실과 공유하던 +x 벽은 예전 거실 깊이(z=-4)까지만 존재한다. 뒤로 늘어난 구간과 현관
 * 홈은 맞은편 방이 없으므로 거실이 직접 벽을 소유해야 허공이 드러나지 않는다.
 */
const KITCHEN_RIGHT_WALL = sideWallPlain(LIVING_SHELL_BOUNDS.maxX, {
  min: LIVING_ENTRY_SHELL.minZ,
  max: LIVING_SHARED_WALL_MIN_Z,
});

const BASE_WALLS = [
  ...BACK_WALL.slice(0, 1),
  ...ENTRY_BACK_WALL.slice(0, 2),
  ENTRY_LEFT_WALL.stub,
  ...FRONT_WALL.slice(0, 2),
  ...LEFT_WALL.stubs,
  KITCHEN_RIGHT_WALL.stub,
] as const satisfies readonly ShellPart[];

const BACK_WALL_UPPER = BACK_WALL.slice(1);
const ENTRY_BACK_WALL_UPPER = ENTRY_BACK_WALL.slice(2);
const ENTRY_LEFT_WALL_UPPER = [ENTRY_LEFT_WALL.upper] as const;
const FRONT_WALL_UPPER = FRONT_WALL.slice(2);
const LEFT_WALL_UPPER = LEFT_WALL.uppers;
const KITCHEN_RIGHT_WALL_UPPER = [KITCHEN_RIGHT_WALL.upper] as const;

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
 * 키 큰 문틀이 거실을 가리고, 문짝은 숨은 방의 허공에 뜬 판이 된다.
 *
 * 거실에 있을 때만 그린다. 2막 도입의 1인칭 문 넘기 동안은 방에 선 채로 거실이 함께
 * 보이는데(열린 문 너머가 허공이면 안 된다), 그때 이 굽도리까지 서면 방의 왼벽
 * 굽도리와 같은 자리에서 겹쳐 깜빡인다.
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
 * 잠금 퍼즐은 없다. 30일 만에 나가는 문이라, 여기서 문제를 풀게 하면 결심의 순간이
 * 퍼즐에 묻힌다. 떠날 준비는 챙기는 것으로 끝난다.
 *
 * 금빛으로 켜지고 눌리는 것은 **챙길 것 셋(가방·앰플·배트)을 다 챙긴 뒤**다
 * (selectExitReady). 순서는 자유라, 문이 열릴 때 도해에게는 셋이 다 있다.
 */
function FrontDoor({ palette }: { palette: RoomPalette }) {
  const ready = useMemoryRoomStore(selectExitReady);
  const started = useMemoryRoomStore((state) => state.endingStarted);
  const startEnding = useMemoryRoomStore((state) => state.startEnding);
  const clickable = !started && ready;
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
        playSound("doorOpen");
        startEnding();
      }}
      {...handlers}
    >
      {/* 경첩은 손잡이 반대쪽 모서리다 (방문 SpaceDoor와 같은 문법). 가운데를 축으로 돌리면
          문짝이 회전문처럼 돈다 */}
      <group ref={leafRef} position={[-ROOM_DOOR_LEAF.hingeOffset, 0, 0]}>
        <group position={[ROOM_DOOR_LEAF.hingeOffset, 0, 0]}>
          <FrontDoorLeaf palette={palette} ready={ready} glowRef={glowRef} />
        </group>
      </group>
      {DOOR_FRAME.map((part) => (
        <ShellBox key={part.position.join(":")} part={part} color={palette.frame} />
      ))}
      <EndingLightPlane color={palette.sun} visible={started} />
    </group>
  );
}

/**
 * 현관문 밖의 빛. 문이 열리는 동안 개구부 너머에서 보이는 밝은 판 하나다. 30일 만의 바깥 빛.
 *
 * 그 자체로는 판이지만 컴포저의 GodRays(MemoryGlowRoot)가 이 판을 광원으로 삼아 문틈으로
 * 새는 빛기둥을 만든다. 광원 메시는 깊이를 쓰지 않고 투명 플래그가 서 있어야 한다는 것이
 * postprocessing의 계약이다. 문 로컬 좌표: 문틀 뒤(-z)로 조금 물러선 자리.
 */
function EndingLightPlane({ color, visible }: { color: string; visible: boolean }) {
  const meshRef = useRef<Mesh>(null);
  useEffect(() => {
    setEndingLightMesh(meshRef.current);
    return () => setEndingLightMesh(null);
  }, []);
  return (
    // 아래로 바닥 두께만큼 더 내린다. 엔딩에 가까이서 문을 볼 때 판 밑에 어두운 띠가 비친다
    <mesh ref={meshRef} position={[0, -0.05, -0.32]} visible={visible} frustumCulled={false}>
      <planeGeometry args={[1.5, 3.6]} />
      <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
    </mesh>
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

export function LivingRoomShell({
  palette,
  inLivingRoom,
}: {
  palette: RoomPalette;
  /** 플레이어가 거실에 서 있는가: 방으로 돌아가는 문간 얼굴은 그때만 그린다. */
  inLivingRoom: boolean;
}) {
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
      {ENTRY_PLINTH.map((part, index) => (
        <ShellBox
          key={part.position.join(":")}
          part={part}
          color={index === 0 ? palette.frame : palette.void}
        />
      ))}
      <ShellBox part={ENTRY_FLOOR} color={palette.floor} />
      {/* 현관 바닥은 마루가 아니라 타일이다: 신발을 신고 서는 자리라는 걸 바닥이 말한다 */}
      <InteriorSurface
        size={[ENTRY_WIDTH - 0.18, ENTRY_DEPTH - 0.09]}
        cell={[0.42, 0.42]}
        position={[ENTRY_CENTER[0], 0.004, ENTRY_CENTER[1] - 0.045]}
        rotation={[-Math.PI / 2, 0, 0]}
        color={palette.trim}
        shade={palette.floor}
      />
      <ShellBox part={ENTRY_THRESHOLD} color={palette.frame} />

      {BASE_WALLS.map((part) => (
        <ShellBox key={part.position.join(":")} part={part} color={palette.trim} />
      ))}

      {/* 걷히는 규칙은 방과 같되, 중심이 거실이다. 카메라가 거실의 어느 쪽에
          있느냐로 계산해야 앞벽만 걷히고 뒷벽·현관벽은 서 있는다. 조사 클로즈업은
          카메라가 거실 안으로 들어오므로(신발장·식탁) 벽 안쪽이면 걷지 않는다 (bounds) */}
      <CulledWall side="back" center={LIVING_SHELL_CENTER} bounds={LIVING_SHELL_BOUNDS}>
        {BACK_WALL_UPPER.map((part) => (
          <ShellBox key={part.position.join(":")} part={part} color={palette.linen} />
        ))}
      </CulledWall>
      <CulledWall side="front" center={LIVING_SHELL_CENTER} bounds={LIVING_SHELL_BOUNDS}>
        {FRONT_WALL_UPPER.map((part) => (
          <ShellBox key={part.position.join(":")} part={part} color={palette.linen} />
        ))}
      </CulledWall>
      <CulledWall side="left" center={LIVING_SHELL_CENTER} bounds={LIVING_SHELL_BOUNDS}>
        {LEFT_WALL_UPPER.map((part) => (
          <ShellBox key={part.position.join(":")} part={part} color={palette.linen} />
        ))}
      </CulledWall>
      <CulledWall side="right" center={LIVING_SHELL_CENTER} bounds={LIVING_SHELL_BOUNDS}>
        {KITCHEN_RIGHT_WALL_UPPER.map((part) => (
          <ShellBox key={part.position.join(":")} part={part} color={palette.linen} />
        ))}
      </CulledWall>
      {/* 현관 홈의 벽은 홈을 중심으로 걷는다: 거실 중심으로 재면 홈의 -x 벽이 "오른쪽"으로 잡힌다 */}
      <CulledWall side="back" center={ENTRY_CENTER} bounds={LIVING_ENTRY_SHELL}>
        {ENTRY_BACK_WALL_UPPER.map((part) => (
          <ShellBox key={part.position.join(":")} part={part} color={palette.linen} />
        ))}
      </CulledWall>
      <CulledWall side="left" center={ENTRY_CENTER} bounds={LIVING_ENTRY_SHELL}>
        {ENTRY_LEFT_WALL_UPPER.map((part) => (
          <ShellBox key={part.position.join(":")} part={part} color={palette.linen} />
        ))}
      </CulledWall>

      <FrontDoor palette={palette} />
      {inLivingRoom && <RoomDoorway palette={palette} />}
      {/* 방에서 문간으로 떨어지는 빛: 현관 쪽 빛과 같은 문법, 방향만 반대다. 문간 얼굴과 달리
          늘 세워 두고 세기만 끈다. 광원이 생겼다 사라지면 재질이 통째로 재컴파일된다 (SpaceLight) */}
      <SpaceLight
        position={[SHARED_WALL_X - 0.6, 2.2, ROOM_DOOR_POSITION[2]]}
        color={palette.memory}
        intensity={inLivingRoom ? 0.55 : 0}
        distance={6}
        decay={2}
      />

      {/* 현관 쪽에서 새어 드는 빛: 방문 밑 금빛 틈의 출처가 여기다 */}
      <SpaceLight
        position={[
          FRONT_DOOR_POSITION[0] + FRONT_DOOR_INWARD[0] * 0.8,
          2.4,
          FRONT_DOOR_POSITION[2] + FRONT_DOOR_INWARD[1] * 0.8,
        ]}
        color={palette.memory}
        intensity={0.5}
        distance={7}
        decay={2}
      />
    </group>
  );
}
