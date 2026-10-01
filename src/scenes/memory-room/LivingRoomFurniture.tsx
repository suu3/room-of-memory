"use client";

import { RoundedBox, useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { type ReactNode, useRef } from "react";
import type { Group } from "three";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import type { SeatId } from "@/types/seat";
import { FurnitureModel } from "./FurnitureModel";
import { KitchenFurniture } from "./KitchenFurniture";
import { DiningDetails, LivingRoomDetails, LivingShoes, SofaDetails } from "./LivingRoomDetails";
import {
  LIVING_ANCHORS,
  LIVING_DINING_CENTER,
  LIVING_DINING_CHAIRS,
  LIVING_FRIDGE_AT,
  LIVING_FURNITURE_SCALE,
  LIVING_PIANO_CENTER,
  LIVING_PIANO_ROTATION,
  LIVING_SHOE_CABINET_AT,
  LIVING_SOFA_AT,
  LIVING_TV_OFFSET_X,
  PIANO_STAND,
  scaleLivingPoint,
} from "./layout";
import { MemoryBeacon } from "./MemoryBeacon";
import { MemoryGlowSelection } from "./MemoryOutlineGlow";
import { PianoCabinet } from "./PianoCabinet";
import { PianoSheet } from "./PianoSheet";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";
import { useGlowHover } from "./use-glow-hover";
import { useNearPlayer } from "./use-near-player";
import { useSeat, useSeatPull } from "./use-seat";

/**
 * 거실 가구 (docs/content-design.md 3-1). 전부 박스 조합: 방(RoomFurniture)과
 * 같은 문법이라야 문 하나 건넌 같은 집으로 읽힌다.
 *
 * 부품 좌표는 전부 **1배** 기준이다. 그리는 쪽이 가구마다 바닥 기준점(layout의
 * LIVING_ANCHORS)을 축으로 LIVING_FURNITURE_SCALE만큼 키운다 (LivingPiece).
 * 발자국·좌석·기억 좌표도 같은 기준점으로 키우므로 여기 수를 옮기면 거기도 같이.
 *
 * 거실은 셋이 쓰던 공간이고, 가구가 그 부재를 말한다:
 * 소파의 눌린 자리, 꺼진 TV, 의자 하나가 빠진 식탁, 한 켤레만 남은 신발장.
 * 발자국(콜라이더)은 layout의 LIVING_COLLIDERS: 여기 좌표를 옮기면 거기도 같이.
 *
 * 조사할 수 있는 것은 여기 없다. 2막에 조사하는 거실 물건(냉장고 문·아래칸,
 * 신발장 문, 식탁 트럼프)은 기억이라 MemoryObjects가 이 위에 얹는다. 가구는
 * 가구만 그리고, 여는 면의 테두리는 기억 쪽이 긋는다
 * (docs/content-design.md 4장).
 *
 * 예외는 **앉는 자리**다 (소파 쿠션 셋 · 식탁 의자 셋 · 피아노 걸상). 앉는 건 조사가
 * 아니라 그냥 몸을 두는 일이라 기억으로 올릴 게 없고, 앉는 자리는 가구 그 자체다.
 * 몸이 어디에 어떻게 놓이는지는 seats.ts가 갖는다.
 */

useGLTF.preload(ASSETS.models.rabbitDoll, true, true);

interface BoxPart {
  size: Vec3Tuple;
  position: Vec3Tuple;
  color: keyof RoomPalette;
}

/**
 * 가구 하나를 바닥 기준점을 축으로 키운다. 바깥 그룹이 기준점에 서서 배율을 걸고,
 * 안쪽 그룹이 1배 좌표계를 기준점 원점으로 끌어온다. `at`을 주면 키운 가구가 그
 * 자리로 옮겨 선다 (식탁). `rotationY`는 그 자리에서 y축으로 돌린다 (피아노).
 *
 * 도는 차례는 layout의 scaleLivingPoint와 같아야 한다. 발자국(LIVING_COLLIDERS)과
 * 좌석(seats)이 그 식으로 나오므로, 여기만 순서를 바꾸면 보이는 가구와 막는 상자가
 * 어긋난다.
 */
/**
 * 거실 가구 한 덩어리를 제자리에 세운다. 부품 좌표는 1배 시절의 값 그대로 두고,
 * 옮긴 자리·각도·배율만 여기서 건다. 피아노 건반 퍼즐도 같은 프레임을 써야 몸통과
 * 건반이 한 물건으로 붙으므로 내보낸다 (src/minigames/piano-melody).
 */
export function LivingPiece({
  anchor,
  at = anchor,
  rotationY = 0,
  children,
}: {
  anchor: readonly [number, number];
  at?: readonly [number, number];
  rotationY?: number;
  children: ReactNode;
}) {
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, rotationY, 0]} scale={LIVING_FURNITURE_SCALE}>
      <group position={[-anchor[0], 0, -anchor[1]]}>{children}</group>
    </group>
  );
}

function Boxes({
  parts,
  palette,
  soft = false,
}: {
  parts: readonly BoxPart[];
  palette: RoomPalette;
  soft?: boolean;
}) {
  if (soft)
    return parts.map((part) => (
      <RoundedBox
        key={part.position.join(":")}
        args={[...part.size]}
        position={part.position}
        radius={Math.min(...part.size) * 0.28}
        smoothness={2}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={palette[part.color]} roughness={0.95} />
      </RoundedBox>
    ));
  return parts.map((part) => (
    <mesh key={part.position.join(":")} position={part.position} castShadow receiveShadow>
      <boxGeometry args={part.size} />
      <meshStandardMaterial color={palette[part.color]} roughness={0.78} />
    </mesh>
  ));
}

/*
 * z-fighting 방지 원칙은 방과 같다. 맞닿는 부품은 서로 파고들거나 간격을 둔다
 * (RoomFurniture 상단 주석 참고).
 */

/**
 * 3인용 소파: 거실과 부엌의 경계(LIVING_SOFA_AT)에 서서 TV를 본다. 등 뒤가 식탁이다.
 *
 * 가운데가 아빠 자리다. 쿠션이 낮고 어둡다. 오래 눌린 자리는 색도 바랜다.
 * 지금은 아무도 앉지 않는데 눌림만 남아 있다는 게 이 가구가 하는 말의 전부다.
 */
const SOFA_PARTS = [
  // 몸통·등받이·팔걸이
  { size: [2.8, 0.42, 1.0], position: [-9.5, 0.21, -3.15], color: "frame" },
  { size: [2.8, 0.85, 0.24], position: [-9.5, 0.72, -3.62], color: "fabric" },
  { size: [0.26, 0.62, 1.0], position: [-10.77, 0.63, -3.15], color: "fabric" },
  { size: [0.26, 0.62, 1.0], position: [-8.23, 0.63, -3.15], color: "fabric" },
] as const satisfies readonly BoxPart[];

/** 쿠션 셋: 가운데(아빠 자리)만 낮고 어둡다. 하나가 곧 앉는 자리 하나다 (seats.ts). */
const SOFA_CUSHIONS = [
  { seat: "sofa-left", size: [0.76, 0.18, 0.82], position: [-10.28, 0.51, -3.08], color: "fabric" },
  { seat: "sofa-center", size: [0.76, 0.12, 0.82], position: [-9.5, 0.48, -3.08], color: "frame" },
  { seat: "sofa-right", size: [0.76, 0.18, 0.82], position: [-8.72, 0.51, -3.08], color: "fabric" },
] as const satisfies readonly (BoxPart & { seat: SeatId })[];

/**
 * TV와 받침장: 앞벽(z=6.5) 쪽. 화면은 void, 이 방에서 가장 어두운 색이다.
 * 마지막에 보던 채널이 꺼진 채 그대로라는 설정이라 아무것도 비추지 않는다.
 * 화면은 소파를 보고 카메라는 그 뒤에 있어서, 플레이 중에는 TV의 뒷면만 보인다.
 * 꺼진 유리의 도트 반사는 그래서 방의 모니터에 있다 (DotReflection).
 */
const TV_PARTS = [
  { size: [2.4, 0.05, 0.5], position: [-9.5, 0.475, 6.2], color: "wood" },
  { size: [2.4, 0.05, 0.5], position: [-9.5, 0.13, 6.2], color: "wood" },
  { size: [0.06, 0.34, 0.5], position: [-10.67, 0.3, 6.2], color: "wood" },
  { size: [0.06, 0.34, 0.5], position: [-8.33, 0.3, 6.2], color: "wood" },
  { size: [2.3, 0.3, 0.035], position: [-9.5, 0.3, 6.43], color: "frame" },
  { size: [0.05, 0.31, 0.46], position: [-9.9, 0.3, 6.2], color: "wood" },
  { size: [0.05, 0.31, 0.46], position: [-9.1, 0.3, 6.2], color: "wood" },
  { size: [0.68, 0.24, 0.33], position: [-10.27, 0.28, 6.16], color: "sage" },
  { size: [0.68, 0.24, 0.33], position: [-8.73, 0.28, 6.16], color: "fabric" },
  { size: [0.12, 0.025, 0.01], position: [-10.27, 0.32, 5.988], color: "linen" },
  { size: [0.12, 0.025, 0.01], position: [-8.73, 0.32, 5.988], color: "linen" },
  { size: [0.1, 0.12, 0.34], position: [-10.53, 0.06, 6.2], color: "frame" },
  { size: [0.1, 0.12, 0.34], position: [-8.47, 0.06, 6.2], color: "frame" },
  // 다리 없는 평판 TV. 받침장 위에 얹혀 화면이 소파를 본다
  { size: [1.9, 1.08, 0.09], position: [-9.5, 1.12, 6.28], color: "void" },
  { size: [0.5, 0.06, 0.3], position: [-9.5, 0.53, 6.25], color: "frame" },
  { size: [0.12, 0.08, 0.08], position: [-9.5, 0.575, 6.28], color: "frame" },
] as const satisfies readonly BoxPart[];

/**
 * 식탁: 셋이 쓰던 4인 식탁. 의자는 셋뿐이고 그중 하나가 빠져 나와 있다.
 * 빠진 의자가 도해 자리다. 마지막으로 일어난 사람이 안 밀어 넣었다.
 */
const TABLE_PARTS = [
  { size: [1.6, 0.09, 1.6], position: [-13.8, 0.93, 3.8], color: "wood" },
  { size: [0.14, 0.9, 0.14], position: [-14.5, 0.45, 3.1], color: "frame" },
  { size: [0.14, 0.9, 0.14], position: [-13.1, 0.45, 3.1], color: "frame" },
  { size: [0.14, 0.9, 0.14], position: [-14.5, 0.45, 4.5], color: "frame" },
  { size: [0.14, 0.9, 0.14], position: [-13.1, 0.45, 4.5], color: "frame" },
] as const satisfies readonly BoxPart[];

/** 식탁 세트 안의 1배 XZ를 키운 세트의 월드 좌표로. */
function diningWorld(x: number, z: number): [number, number] {
  return scaleLivingPoint(LIVING_ANCHORS.dining, x, z, LIVING_DINING_CENTER);
}
const [DINING_TOP_MIN_X, DINING_TOP_MIN_Z] = diningWorld(-14.6, 3.0);
const [DINING_TOP_MAX_X, DINING_TOP_MAX_Z] = diningWorld(-13.0, 4.6);

/**
 * 식탁 상판의 발자국과 의자 배치: 겹침 검사가 보는 값 (LivingRoomFurniture.test.ts).
 * 전부 키운 뒤의 월드 좌표다.
 *
 * 의자 등받이(y 0.62~1.12)는 상판 슬래브(y 0.885~0.975)와 높이가 겹치므로, 등받이
 * 발자국이 상판 발자국 안에 들어오면 그대로 관통한다. 실제로 세 의자 전부 등받이가
 * 상판을 뚫고 좌판이 식탁 다리와 물린 채 출시 직전까지 갔다. 눈으로는 식탁 아래라
 * 잘 안 보인다. 그래서 배치를 데이터로 빼고 테스트가 기하로 지킨다.
 */
export const DINING_SET = {
  /** 상판 슬래브의 XZ 발자국 (TABLE_PARTS 첫 항목에서 파생) */
  tableTop: {
    minX: DINING_TOP_MIN_X,
    maxX: DINING_TOP_MAX_X,
    minZ: DINING_TOP_MIN_Z,
    maxZ: DINING_TOP_MAX_Z,
  },
  /** 등받이의 로컬 기하: CHAIR_PART_TEMPLATE 두 번째 항목에서 파생, 의자 배율을 곱한 값 */
  backrest: {
    halfWidth: 0.22 * LIVING_FURNITURE_SCALE,
    halfThickness: 0.035 * LIVING_FURNITURE_SCALE,
    offsetZ: -0.21 * LIVING_FURNITURE_SCALE,
  },
  /** 의자 셋: 둘은 제자리, 하나(도해 자리)는 빠져 나와 비스듬하다 (layout) */
  chairs: LIVING_DINING_CHAIRS,
} as const;

/** 의자 한 벌: 좌판·등받이·다리 네 개. 원점이 좌판 중심이라 통째로 옮긴다. */
const CHAIR_PART_TEMPLATE = [
  { size: [0.44, 0.07, 0.44], position: [0, 0.56, 0], color: "wood" },
  // 등받이 뒷면(-0.245)을 좌판 모서리(-0.22) 뒤로 뺀다. 같은 평면이면 깜빡인다
  { size: [0.44, 0.5, 0.07], position: [0, 0.87, -0.21], color: "wood" },
  { size: [0.06, 0.56, 0.06], position: [-0.17, 0.28, -0.17], color: "frame" },
  { size: [0.06, 0.56, 0.06], position: [0.17, 0.28, -0.17], color: "frame" },
  { size: [0.06, 0.56, 0.06], position: [-0.17, 0.28, 0.17], color: "frame" },
  { size: [0.06, 0.56, 0.06], position: [0.17, 0.28, 0.17], color: "frame" },
] as const satisfies readonly BoxPart[];

/**
 * 식탁 의자 한 벌. 누르면 다가간 사람이 앉는다. 상판 밑으로 밀어 넣은 둘은 앉는 김에
 * 뒤로 빠진다 (seats.ts의 pull). 상판 윗면이 캐릭터 가슴 높이라, 안 빼면 몸이 상판을
 * 뚫고 앉는다.
 *
 * 자리(position)는 이미 키운 월드 좌표라 LivingPiece 밖에 선다. 빠지는 양(pull)이
 * 월드 단위라 배율 그룹 안에 두면 그만큼 더 빠진다. 배율은 의자 원점(좌판 중심의 바닥)에 건다.
 */
function Chair({
  palette,
  seat,
  position,
  rotationY = 0,
}: {
  palette: RoomPalette;
  seat: SeatId;
  position: Vec3Tuple;
  rotationY?: number;
}) {
  const groupRef = useRef<Group>(null);
  const { glowing, handlers } = useSeat(seat);
  useSeatPull(groupRef, seat, { x: position[0], z: position[2], rotationY });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[0, rotationY, 0]}
      scale={LIVING_FURNITURE_SCALE}
      {...handlers}
    >
      <MemoryGlowSelection selectionKey={seat} tier="prop" enabled={glowing}>
        <Boxes parts={CHAIR_PART_TEMPLATE} palette={palette} />
      </MemoryGlowSelection>
    </group>
  );
}

/** 소파 쿠션 한 장 = 앉는 자리 하나. 소파 몸통은 그대로 배경으로 남는다. */
function SofaCushion({
  palette,
  cushion,
}: {
  palette: RoomPalette;
  cushion: BoxPart & { seat: SeatId };
}) {
  const { glowing, handlers } = useSeat(cushion.seat);
  return (
    <group {...handlers}>
      <MemoryGlowSelection selectionKey={cushion.seat} tier="prop" enabled={glowing}>
        <Boxes parts={[cushion]} palette={palette} soft />
      </MemoryGlowSelection>
    </group>
  );
}

/**
 * 피아노 본체: 눌러서 여는 미궁 문제 (piano-melody).
 *
 * 걸상은 앉는 물건이고 본체는 **치는 물건**이라 둘을 갈라 둔다. 앉지 않고도 칠 수
 * 있게 한 건 접근성이다: 앉기는 곁가지 인터랙션이라 거기에 퍼즐을 걸면 앉는 법을
 * 모르는 사람이 문제 앞에 못 선다.
 *
 * 다 친 뒤에는 더 안 켜진다. 푼 문제를 계속 부르면 방이 아직 할 일이 남았다고 말한다.
 *
 * 악보 조각을 손에 넣은 뒤부터 풀 때까지 금빛 표식이 선다 (MemoryBeacon의 BeaconId 주석).
 * 안방에서 돌아오는 길에 어디로 가야 하는지가 보여야 한다.
 */
/** 피아노 표식 자리 (피아노 부품과 같은 좌표계): 윗판(PIANO_CABINET_PARTS의 top) 위. */
const PIANO_BEACON: Vec3Tuple = [-14.95, 1.4, 6.0];

function PianoBody({ palette }: { palette: RoomPalette }) {
  const solved = useMemoryRoomStore((state) => state.solvedPuzzles.includes("piano-melody"));
  const hasScrap = useMemoryRoomStore((state) => state.inventory.includes("piano-sheet"));
  const openPuzzle = useMemoryRoomStore((state) => state.openPuzzle);
  /*
   * 판이 도는 동안 닫힌 뚜껑은 내린다. 그 자리에 열린 뚜껑과 건반을 세우는 건
   * 미니게임 쪽이다 (canvas 모드: 씬의 그 물건 자체가 판이다).
   */
  const playing = useMemoryRoomStore((state) => state.activePuzzle === "piano-melody");
  const { hovered, handlers } = useGlowHover(!solved);
  // 걸상 앞(PIANO_BENCH_PARTS의 좌판 z)에 서면 닿는다. 거실 배율은 LivingPiece가 건다
  const near = useNearPlayer(PIANO_STAND.x, PIANO_STAND.z, PIANO_STAND.radius);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      onClick={(event) => {
        if (solved) return;
        event.stopPropagation();
        playSound("select");
        openPuzzle("piano-melody");
      }}
      {...handlers}
    >
      {/* 표식은 윗판 위에 선다. 바닥 고리는 groundOffset만큼 내려가 바닥에 눕는다 */}
      <group position={PIANO_BEACON}>
        <MemoryBeacon
          id="piano"
          color={palette.memory}
          active={hasScrap && !solved && !playing}
          near={near}
          groundOffset={PIANO_BEACON[1]}
        />
      </group>
      <MemoryGlowSelection
        selectionKey="piano-body"
        tier="prop"
        enabled={!solved && (hovered || near)}
      >
        <PianoCabinet palette={palette} open={playing} />
      </MemoryGlowSelection>
    </group>
  );
}

/** 피아노 걸상: 반쯤 빼놓은 그대로 앉는다. 무릎은 건반 뚜껑 아래로 들어간다. */
function PianoBench({ palette }: { palette: RoomPalette }) {
  const { glowing, handlers } = useSeat("piano-bench");
  return (
    <group {...handlers}>
      <MemoryGlowSelection selectionKey="piano-bench" tier="prop" enabled={glowing}>
        <Boxes parts={PIANO_BENCH_PARTS} palette={palette} />
      </MemoryGlowSelection>
    </group>
  );
}

/**
 * 신발장: 현관문 옆 -x 벽 (LIVING_SHOE_CABINET_AT). 문이 닫힌 낮은 장이고, 앞에 신발이 **한 켤레만** 남아 있다.
 * 부모님 신발이 없다는 게 "여행 갔다"의 물증이다 (v2 기획 7장). 물증이 되려면
 * 빈 자리가 보여야 해서, 남은 한 켤레를 한쪽에 몰아 둔다.
 */
const SHOE_CABINET_PARTS = [
  { size: [0.5, 1.06, 1.9], position: [-16.16, 0.53, -0.68], color: "wood" },
  { size: [0.56, 0.05, 1.96], position: [-16.16, 1.08, -0.68], color: "linen" },
  // 문짝 자국: 통짜 상자로는 장이 아니라 궤짝으로 읽혀서 세로줄 하나를 긋는다
  { size: [0.03, 0.86, 0.02], position: [-15.9, 0.5, -0.68], color: "frame" },
  // 남은 운동화 한 켤레는 LivingShoes에서 밑창·발등·끈이 보이게 그린다.
] as const satisfies readonly BoxPart[];

/**
 * 냉장고: 뒷벽(-z)의 +x 구석, ㄱ자 부엌(KitchenFurniture)의 오른쪽 끝. 원래 식탁 옆 +z
 * 벽에 있었는데, 그 자리는 피아노에게 내주고 반대편 벽으로 건너왔다. 문에 자석으로 눌러 둔 메모
 * 한 장: 내용은 없다. 셋이 살던 집에 남은 살림의 흔적이면 된다.
 *
 * 발자국은 layout의 LIVING_COLLIDERS: 좌표를 옮기면 거기도 같이.
 */
const FRIDGE_PARTS = [
  // 받침: 몸통보다 물려 있어 바닥에서 살짝 뜬 것처럼 보인다
  { size: [0.8, 0.18, 0.56], position: [-15.32, 0.09, -3.58], color: "frame" },
  { size: [0.92, 1.84, 0.68], position: [-15.32, 1.09, -3.58], color: "trim" },
  // 냉동칸 경계: 몸통보다 사방 한 치수 커서 어두운 줄로 드러난다
  { size: [0.94, 0.035, 0.7], position: [-15.32, 1.45, -3.58], color: "frame" },
  // 손잡이 둘: 문 앞면(z -3.24)에 5mm 파고들어 붙는다 (맞닿는 면 공유 금지)
  { size: [0.05, 0.3, 0.05], position: [-14.98, 1.0, -3.22], color: "frame" },
  { size: [0.05, 0.22, 0.05], position: [-14.98, 1.72, -3.22], color: "frame" },
  // 메모와 자석: 종이는 문에, 자석은 종이 위에 겹쳐 물린다
  { size: [0.18, 0.22, 0.02], position: [-15.45, 1.05, -3.235], color: "linen" },
  { size: [0.055, 0.055, 0.025], position: [-15.45, 1.185, -3.215], color: "clay" },
] as const satisfies readonly BoxPart[];

/** 걸상: 반쯤 빼놓은 채다. 좌판 밑으로 다리가 1cm 파고든다. 앉는 자리라 따로 뗀다. */
const PIANO_BENCH_PARTS = [
  { size: [0.56, 0.065, 0.34], position: [-14.95, 0.5025, 5.38], color: "wood" },
  { size: [0.53, 0.045, 0.31], position: [-14.95, 0.5475, 5.38], color: "frame" },
  { size: [0.07, 0.48, 0.07], position: [-15.15, 0.24, 5.28], color: "frame" },
  { size: [0.07, 0.48, 0.07], position: [-14.75, 0.24, 5.28], color: "frame" },
  { size: [0.07, 0.48, 0.07], position: [-15.15, 0.24, 5.48], color: "frame" },
  { size: [0.07, 0.48, 0.07], position: [-14.75, 0.24, 5.48], color: "frame" },
] as const satisfies readonly BoxPart[];

/**
 * 소파 옆 구석에 앉은 토끼 인형 (사용자 제공 glb). 이 거실에서 유일하게 부드러운 물건:
 * 누구 것이었는지 말하지 않는다. 셋이 살던 집에 남은, 아무도 안 치운 것 하나다.
 *
 * 원래는 박스로 짜맞춘 곰인형이었다. 방의 다른 소품처럼 모델이 들어오면서 갈아끼웠고,
 * 자리·발자국(LIVING_COLLIDERS의 plush)은 그대로 물려받았다.
 *
 * 배율은 인형 키(모델 3.17)를 1.5로 맞춘 0.474에 거실 배율을 곱한 값이다. 캐릭터(1.55)보다
 * 커야 다른 가구와 같은 비율로 "커다란 인형"으로 읽힌다. 그 크기에서 발자국은 1.22×1.04이고,
 * 살짝 튼 각(0.35)까지 치면 1.5×1.4이라 LIVING_COLLIDERS의 plush 칸이 그걸 덮는다. 튼 것은
 * 진열이 아니라 놓아둔 것으로 보이게 하는 몫이다. 자리는 키운 소파의 왼팔(x -12.29) 옆.
 */
const PLUSH_PLACEMENT = {
  position: [-13.05, 0, -0.35] as Vec3Tuple,
  rotationY: 0.35,
  scale: 0.474 * LIVING_FURNITURE_SCALE,
};

export function LivingRoomFurniture({ palette }: { palette: RoomPalette }) {
  /** 찢어진 악보 조각을 손에 들었는가. 들었으면 보면대의 지워진 마디가 드러난다 */
  const hasSheetScrap = useMemoryRoomStore((state) => state.inventory.includes("piano-sheet"));
  return (
    <group name="living-room-furniture">
      <KitchenFurniture palette={palette} />
      <LivingPiece anchor={LIVING_ANCHORS.sofa} at={LIVING_SOFA_AT}>
        <Boxes parts={SOFA_PARTS} palette={palette} soft />
        {SOFA_CUSHIONS.map((cushion) => (
          <SofaCushion key={cushion.seat} palette={palette} cushion={cushion} />
        ))}
        <SofaDetails palette={palette} />
      </LivingPiece>
      {/* TV는 1배 그대로: 키운 소파와 마주 보는 비율이 이쪽이 맞다. 소파 정면으로 x만 옮긴다 */}
      <group position={[LIVING_TV_OFFSET_X, 0, 0]}>
        <Boxes parts={TV_PARTS} palette={palette} />
      </group>
      <LivingPiece anchor={LIVING_ANCHORS.dining} at={LIVING_DINING_CENTER}>
        <Boxes parts={TABLE_PARTS} palette={palette} />
        <DiningDetails palette={palette} />
      </LivingPiece>
      {/* 배치는 DINING_SET.chairs: 상판·다리와의 간격을 테스트가 지키는 값이다 */}
      {DINING_SET.chairs.map((chair) => (
        <Chair
          key={chair.seat}
          palette={palette}
          seat={chair.seat}
          position={chair.position}
          rotationY={chair.rotationY}
        />
      ))}
      <LivingPiece anchor={LIVING_ANCHORS.shoeCabinet} at={LIVING_SHOE_CABINET_AT}>
        <Boxes parts={SHOE_CABINET_PARTS} palette={palette} />
        <LivingShoes palette={palette} />
      </LivingPiece>
      <LivingPiece anchor={LIVING_ANCHORS.fridge} at={LIVING_FRIDGE_AT}>
        <Boxes parts={FRIDGE_PARTS} palette={palette} />
      </LivingPiece>
      <LivingPiece
        anchor={LIVING_ANCHORS.piano}
        at={LIVING_PIANO_CENTER}
        rotationY={LIVING_PIANO_ROTATION}
      >
        <PianoBody palette={palette} />
        <PianoBench palette={palette} />
        {/* 보면대의 악보: 문제를 말하는 것은 화면의 지시가 아니라 이 종이다 */}
        <PianoSheet palette={palette} hasScrap={hasSheetScrap} />
      </LivingPiece>
      <FurnitureModel
        path={ASSETS.models.rabbitDoll}
        position={PLUSH_PLACEMENT.position}
        rotation={[0, PLUSH_PLACEMENT.rotationY, 0]}
        scale={PLUSH_PLACEMENT.scale}
      />
      <LivingRoomDetails palette={palette} />
    </group>
  );
}
