"use client";

import { useGLTF } from "@react-three/drei";
import type {} from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { ASSETS } from "@/lib/assets";
import type { SeatId } from "@/types/seat";
import { FurnitureModel } from "./FurnitureModel";
import { MemoryGlowSelection } from "./MemoryOutlineGlow";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";
import { useSeat, useSeatPull } from "./use-seat";

/**
 * 거실 가구 (docs/content-design.md 3-1). 전부 박스 조합 — 방(RoomFurniture)과
 * 같은 문법이라야 문 하나 건넌 같은 집으로 읽힌다.
 *
 * 거실은 셋이 쓰던 공간이고, 가구가 그 부재를 말한다:
 * 소파의 눌린 자리, 꺼진 TV, 의자 하나가 빠진 식탁, 한 켤레만 남은 신발장.
 * 발자국(콜라이더)은 layout의 LIVING_COLLIDERS — 여기 좌표를 옮기면 거기도 같이.
 *
 * 조사할 수 있는 것은 여기 없다. 2막에 조사하는 거실 물건(냉장고 문·아래칸,
 * 신발장 문, 식탁 트럼프)은 기억이라 MemoryObjects가 이 위에 얹는다 — 가구는
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

function Boxes({ parts, palette }: { parts: readonly BoxPart[]; palette: RoomPalette }) {
  return parts.map((part) => (
    <mesh key={part.position.join(":")} position={part.position} castShadow receiveShadow>
      <boxGeometry args={part.size} />
      <meshStandardMaterial color={palette[part.color]} roughness={0.78} />
    </mesh>
  ));
}

/*
 * z-fighting 방지 원칙은 방과 같다 — 맞닿는 부품은 서로 파고들거나 간격을 둔다
 * (RoomFurniture 상단 주석 참고).
 */

/**
 * 3인용 소파 — 뒷벽(z=-4)에 붙어 TV를 본다.
 *
 * 가운데가 아빠 자리다. 쿠션이 낮고 어둡다 — 오래 눌린 자리는 색도 바랜다.
 * 지금은 아무도 앉지 않는데 눌림만 남아 있다는 게 이 가구가 하는 말의 전부다.
 */
const SOFA_PARTS = [
  // 몸통·등받이·팔걸이
  { size: [2.8, 0.42, 1.0], position: [-9.5, 0.21, -3.15], color: "ink" },
  { size: [2.8, 0.85, 0.24], position: [-9.5, 0.72, -3.62], color: "slate" },
  { size: [0.26, 0.62, 1.0], position: [-10.77, 0.63, -3.15], color: "slate" },
  { size: [0.26, 0.62, 1.0], position: [-8.23, 0.63, -3.15], color: "slate" },
] as const satisfies readonly BoxPart[];

/** 쿠션 셋 — 가운데(아빠 자리)만 낮고 어둡다. 하나가 곧 앉는 자리 하나다 (seats.ts). */
const SOFA_CUSHIONS = [
  { seat: "sofa-left", size: [0.76, 0.18, 0.82], position: [-10.28, 0.51, -3.08], color: "dusk" },
  { seat: "sofa-center", size: [0.76, 0.12, 0.82], position: [-9.5, 0.48, -3.08], color: "storm" },
  { seat: "sofa-right", size: [0.76, 0.18, 0.82], position: [-8.72, 0.51, -3.08], color: "dusk" },
] as const satisfies readonly (BoxPart & { seat: SeatId })[];

/**
 * TV와 받침장 — 앞벽(z=6.5) 쪽. 화면은 void — 이 방에서 가장 어두운 색이다.
 * 마지막에 보던 채널이 꺼진 채 그대로라는 설정이라 아무것도 비추지 않는다.
 */
const TV_PARTS = [
  { size: [2.4, 0.5, 0.5], position: [-9.5, 0.25, 6.2], color: "dusk" },
  // 다리 없는 평판 TV. 받침장 위에 얹혀 화면이 소파를 본다
  { size: [1.9, 1.08, 0.09], position: [-9.5, 1.12, 6.28], color: "void" },
  { size: [0.5, 0.06, 0.3], position: [-9.5, 0.53, 6.25], color: "ink" },
] as const satisfies readonly BoxPart[];

/**
 * 식탁 — 셋이 쓰던 4인 식탁. 의자는 셋뿐이고 그중 하나가 빠져 나와 있다.
 * 빠진 의자가 도해 자리다 — 마지막으로 일어난 사람이 안 밀어 넣었다.
 */
const TABLE_PARTS = [
  { size: [1.6, 0.09, 1.6], position: [-13.8, 0.93, 3.8], color: "dusk" },
  { size: [0.14, 0.9, 0.14], position: [-14.5, 0.45, 3.1], color: "ink" },
  { size: [0.14, 0.9, 0.14], position: [-13.1, 0.45, 3.1], color: "ink" },
  { size: [0.14, 0.9, 0.14], position: [-14.5, 0.45, 4.5], color: "ink" },
  { size: [0.14, 0.9, 0.14], position: [-13.1, 0.45, 4.5], color: "ink" },
] as const satisfies readonly BoxPart[];

/**
 * 식탁 상판의 발자국과 의자 배치 — 겹침 검사가 보는 값 (LivingRoomFurniture.test.ts).
 *
 * 의자 등받이(y 0.62~1.12)는 상판 슬래브(y 0.885~0.975)와 높이가 겹치므로, 등받이
 * 발자국이 상판 발자국 안에 들어오면 그대로 관통한다. 실제로 세 의자 전부 등받이가
 * 상판을 뚫고 좌판이 식탁 다리와 물린 채 출시 직전까지 갔다 — 눈으로는 식탁 아래라
 * 잘 안 보인다. 그래서 배치를 데이터로 빼고 테스트가 기하로 지킨다.
 */
export const DINING_SET = {
  /** 상판 슬래브의 XZ 발자국 (TABLE_PARTS 첫 항목에서 파생) */
  tableTop: { minX: -14.6, maxX: -13.0, minZ: 3.0, maxZ: 4.6 },
  /** 등받이의 로컬 기하 — CHAIR_PART_TEMPLATE 두 번째 항목에서 파생 */
  backrest: { halfWidth: 0.22, halfThickness: 0.035, offsetZ: -0.21 },
  /** 의자 셋 — 둘은 제자리, 하나(도해 자리)는 빠져 나와 비스듬하다 */
  chairs: [
    { seat: "dining-window", position: [-14.5, 0, 3.8], rotationY: Math.PI / 2 },
    { seat: "dining-door", position: [-13.1, 0, 3.8], rotationY: -Math.PI / 2 },
    { seat: "dining-pulled", position: [-13.4, 0, 2.62], rotationY: Math.PI + 0.5 },
  ],
} as const;

/** 의자 한 벌 — 좌판·등받이·다리 네 개. 원점이 좌판 중심이라 통째로 옮긴다. */
const CHAIR_PART_TEMPLATE = [
  { size: [0.44, 0.07, 0.44], position: [0, 0.56, 0], color: "slate" },
  // 등받이 뒷면(-0.245)을 좌판 모서리(-0.22) 뒤로 뺀다 — 같은 평면이면 깜빡인다
  { size: [0.44, 0.5, 0.07], position: [0, 0.87, -0.21], color: "slate" },
  { size: [0.06, 0.56, 0.06], position: [-0.17, 0.28, -0.17], color: "ink" },
  { size: [0.06, 0.56, 0.06], position: [0.17, 0.28, -0.17], color: "ink" },
  { size: [0.06, 0.56, 0.06], position: [-0.17, 0.28, 0.17], color: "ink" },
  { size: [0.06, 0.56, 0.06], position: [0.17, 0.28, 0.17], color: "ink" },
] as const satisfies readonly BoxPart[];

/**
 * 식탁 의자 한 벌. 누르면 다가간 사람이 앉는다 — 상판 밑으로 밀어 넣은 둘은 앉는 김에
 * 뒤로 빠진다 (seats.ts의 pull). 상판 윗면이 캐릭터 가슴 높이라, 안 빼면 몸이 상판을
 * 뚫고 앉는다.
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
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]} {...handlers}>
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
        <Boxes parts={[cushion]} palette={palette} />
      </MemoryGlowSelection>
    </group>
  );
}

/** 피아노 걸상 — 반쯤 빼놓은 그대로 앉는다. 무릎은 건반 뚜껑 아래로 들어간다. */
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
 * 신발장 — 현관문 옆. 문이 닫힌 낮은 장이고, 앞에 신발이 **한 켤레만** 남아 있다.
 * 부모님 신발이 없다는 게 "여행 갔다"의 물증이다 (v2 기획 7장). 물증이 되려면
 * 빈 자리가 보여야 해서, 남은 한 켤레를 한쪽에 몰아 둔다.
 */
const SHOE_CABINET_PARTS = [
  { size: [0.5, 1.06, 1.9], position: [-16.16, 0.53, -0.68], color: "dusk" },
  { size: [0.56, 0.05, 1.96], position: [-16.16, 1.08, -0.68], color: "slate" },
  // 문짝 자국 — 통짜 상자로는 장이 아니라 궤짝으로 읽혀서 세로줄 하나를 긋는다
  { size: [0.03, 0.86, 0.02], position: [-15.9, 0.5, -0.68], color: "ink" },
  // 남은 운동화 한 켤레 (도해 것). 나란하지 않고 살짝 어긋나 있다
  { size: [0.13, 0.09, 0.32], position: [-15.62, 0.05, 0.12], color: "ember" },
  { size: [0.13, 0.09, 0.32], position: [-15.46, 0.05, 0.04], color: "ember" },
] as const satisfies readonly BoxPart[];

/**
 * 냉장고 — 소파 쪽 뒷벽(-z)의 -x 구석. 원래 식탁 옆 +z 벽에 있었는데, 그 자리는
 * 피아노에게 내주고 반대편 벽으로 건너왔다. 거실에서 유일하게 흰 물건이라
 * 여기가 부엌 몫의 구석이라는 걸 색 하나로 말한다. 문에 자석으로 눌러 둔 메모
 * 한 장 — 내용은 없다. 셋이 살던 집에 남은 살림의 흔적이면 된다.
 *
 * 발자국은 layout의 LIVING_COLLIDERS — 좌표를 옮기면 거기도 같이.
 */
const FRIDGE_PARTS = [
  // 받침 — 몸통보다 물려 있어 바닥에서 살짝 뜬 것처럼 보인다
  { size: [0.8, 0.18, 0.56], position: [-15.32, 0.09, -3.58], color: "ink" },
  { size: [0.92, 1.84, 0.68], position: [-15.32, 1.09, -3.58], color: "paper" },
  // 냉동칸 경계 — 몸통보다 사방 한 치수 커서 어두운 줄로 드러난다
  { size: [0.94, 0.035, 0.7], position: [-15.32, 1.45, -3.58], color: "dusk" },
  // 손잡이 둘 — 문 앞면(z -3.24)에 5mm 파고들어 붙는다 (맞닿는 면 공유 금지)
  { size: [0.05, 0.3, 0.05], position: [-14.98, 1.0, -3.22], color: "slate" },
  { size: [0.05, 0.22, 0.05], position: [-14.98, 1.72, -3.22], color: "slate" },
  // 메모와 자석 — 종이는 문에, 자석은 종이 위에 겹쳐 물린다
  { size: [0.18, 0.22, 0.02], position: [-15.45, 1.05, -3.235], color: "bone" },
  { size: [0.055, 0.055, 0.025], position: [-15.45, 1.185, -3.215], color: "ember" },
] as const satisfies readonly BoxPart[];

/**
 * 업라이트 피아노 — 냉장고가 떠난 +z 벽, 식탁 옆 자리. 뚜껑이 닫혀 있다 —
 * 이 집의 다른 물건들처럼 어느 날 멈춘 채로 있다. 치던 사람이 누구였는지는
 * 말하지 않는다. 의자만 반쯤 빼놓아 앉던 흔적으로 남긴다.
 *
 * 발자국은 layout의 LIVING_COLLIDERS(piano) — 좌표를 옮기면 거기도 같이.
 */
const PIANO_PARTS = [
  // 본체 — 뒷면(6.42)이 벽 안쪽 면(6.41)에 1cm 파고든다 (냉장고와 같은 규칙)
  { size: [1.5, 1.32, 0.42], position: [-14.95, 0.66, 6.21], color: "ink" },
  // 윗판 — 본체보다 살짝 넓어 어두운 실루엣에 모서리 한 줄을 만든다
  { size: [1.54, 0.06, 0.46], position: [-14.95, 1.34, 6.2], color: "slate" },
  // 닫힌 건반 뚜껑 — 본체 앞면(6.00)을 물고 앞으로 나온다
  { size: [1.5, 0.14, 0.26], position: [-14.95, 0.92, 5.93], color: "slate" },
  // 뚜껑을 받치는 앞다리 둘 — 위로 5mm 파고들어 뚜껑에 붙는다
  { size: [0.1, 0.85, 0.1], position: [-15.6, 0.43, 5.95], color: "ink" },
  { size: [0.1, 0.85, 0.1], position: [-14.3, 0.43, 5.95], color: "ink" },
  // 페달 한 쌍 — 본체 앞면 아래
  { size: [0.09, 0.05, 0.14], position: [-15.05, 0.03, 5.96], color: "bone" },
  { size: [0.09, 0.05, 0.14], position: [-14.85, 0.03, 5.96], color: "bone" },
  // 보면대 홈 — 본체 앞면에 가로줄 하나
  { size: [0.95, 0.05, 0.03], position: [-14.95, 1.13, 6.005], color: "slate" },
] as const satisfies readonly BoxPart[];

/** 걸상 — 반쯤 빼놓은 채다. 좌판 밑으로 다리가 1cm 파고든다. 앉는 자리라 따로 뗀다. */
const PIANO_BENCH_PARTS = [
  { size: [0.56, 0.1, 0.34], position: [-14.95, 0.52, 5.38], color: "ink" },
  { size: [0.07, 0.48, 0.07], position: [-15.15, 0.24, 5.28], color: "slate" },
  { size: [0.07, 0.48, 0.07], position: [-14.75, 0.24, 5.28], color: "slate" },
  { size: [0.07, 0.48, 0.07], position: [-15.15, 0.24, 5.48], color: "slate" },
  { size: [0.07, 0.48, 0.07], position: [-14.75, 0.24, 5.48], color: "slate" },
] as const satisfies readonly BoxPart[];

/**
 * 소파 옆 구석에 앉은 토끼 인형 (사용자 제공 glb). 이 거실에서 유일하게 부드러운 물건 —
 * 누구 것이었는지 말하지 않는다. 셋이 살던 집에 남은, 아무도 안 치운 것 하나다.
 *
 * 원래는 박스로 짜맞춘 곰인형이었다. 방의 다른 소품처럼 모델이 들어오면서 갈아끼웠고,
 * 자리·발자국(LIVING_COLLIDERS의 plush)은 그대로 물려받았다.
 *
 * 배율은 인형 키(모델 3.32)를 1.5로 맞춘 값이다 — 캐릭터(1.55)와 눈높이가 맞아야
 * "커다란 인형"으로 읽힌다. 발자국(LIVING_COLLIDERS의 plush, 1.1×1.1)은 이 크기에서도
 * 인형을 다 덮는다. 살짝 튼 것은 진열이 아니라 놓아둔 것으로 보이게 하는 몫.
 */
const PLUSH_PLACEMENT = { position: [-11.75, 0, -3.3] as Vec3Tuple, rotationY: 0.35, scale: 0.45 };

export function LivingRoomFurniture({ palette }: { palette: RoomPalette }) {
  return (
    <group name="living-room-furniture">
      <Boxes parts={SOFA_PARTS} palette={palette} />
      {SOFA_CUSHIONS.map((cushion) => (
        <SofaCushion key={cushion.seat} palette={palette} cushion={cushion} />
      ))}
      <Boxes parts={TV_PARTS} palette={palette} />
      <Boxes parts={TABLE_PARTS} palette={palette} />
      {/* 배치는 DINING_SET.chairs — 상판·다리와의 간격을 테스트가 지키는 값이다 */}
      {DINING_SET.chairs.map((chair) => (
        <Chair
          key={chair.seat}
          palette={palette}
          seat={chair.seat}
          position={chair.position}
          rotationY={chair.rotationY}
        />
      ))}
      <Boxes parts={SHOE_CABINET_PARTS} palette={palette} />
      <Boxes parts={FRIDGE_PARTS} palette={palette} />
      <Boxes parts={PIANO_PARTS} palette={palette} />
      <PianoBench palette={palette} />
      <FurnitureModel
        path={ASSETS.models.rabbitDoll}
        position={PLUSH_PLACEMENT.position}
        rotation={[0, PLUSH_PLACEMENT.rotationY, 0]}
        scale={PLUSH_PLACEMENT.scale}
      />
    </group>
  );
}
