"use client";

import type {} from "@react-three/fiber";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";

/**
 * 거실 가구 (docs/content-design-v2.md 7장). 전부 박스 조합 — 방(RoomFurniture)과
 * 같은 문법이라야 문 하나 건넌 같은 집으로 읽힌다.
 *
 * 거실은 셋이 쓰던 공간이고, 가구가 그 부재를 말한다:
 * 소파의 눌린 자리, 꺼진 TV, 의자 하나가 빠진 식탁, 한 켤레만 남은 신발장.
 * 발자국(콜라이더)은 layout의 LIVING_COLLIDERS — 여기 좌표를 옮기면 거기도 같이.
 *
 * 미궁 문제를 나르는 물건(식탁 위 트럼프, 현관 잠금장치)은 아직 없다 — 이사는
 * 다음 커밋이다 (v2 기획 9장 7번).
 */

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
  // 쿠션 셋 — 가운데(아빠 자리)만 낮고 어둡다
  { size: [0.76, 0.18, 0.82], position: [-10.28, 0.51, -3.08], color: "dusk" },
  { size: [0.76, 0.12, 0.82], position: [-9.5, 0.48, -3.08], color: "storm" },
  { size: [0.76, 0.18, 0.82], position: [-8.72, 0.51, -3.08], color: "dusk" },
] as const satisfies readonly BoxPart[];

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

/** 의자 한 벌 — 좌판·등받이·다리 네 개. 원점이 좌판 중심이라 통째로 옮긴다. */
const CHAIR_PART_TEMPLATE = [
  { size: [0.44, 0.07, 0.44], position: [0, 0.56, 0], color: "slate" },
  { size: [0.44, 0.5, 0.07], position: [0, 0.87, -0.185], color: "slate" },
  { size: [0.06, 0.56, 0.06], position: [-0.17, 0.28, -0.17], color: "ink" },
  { size: [0.06, 0.56, 0.06], position: [0.17, 0.28, -0.17], color: "ink" },
  { size: [0.06, 0.56, 0.06], position: [-0.17, 0.28, 0.17], color: "ink" },
  { size: [0.06, 0.56, 0.06], position: [0.17, 0.28, 0.17], color: "ink" },
] as const satisfies readonly BoxPart[];

function Chair({
  palette,
  position,
  rotationY = 0,
}: {
  palette: RoomPalette;
  position: Vec3Tuple;
  rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Boxes parts={CHAIR_PART_TEMPLATE} palette={palette} />
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

export function LivingRoomFurniture({ palette }: { palette: RoomPalette }) {
  return (
    <group name="living-room-furniture">
      <Boxes parts={SOFA_PARTS} palette={palette} />
      <Boxes parts={TV_PARTS} palette={palette} />
      <Boxes parts={TABLE_PARTS} palette={palette} />
      {/* 의자 셋 — 둘은 제자리, 하나(도해 자리)는 빠져 나와 비스듬하다 */}
      <Chair palette={palette} position={[-14.35, 0, 3.35]} rotationY={Math.PI / 2} />
      <Chair palette={palette} position={[-13.25, 0, 4.25]} rotationY={-Math.PI / 2} />
      <Chair palette={palette} position={[-13.35, 0, 2.95]} rotationY={Math.PI + 0.5} />
      <Boxes parts={SHOE_CABINET_PARTS} palette={palette} />
    </group>
  );
}
