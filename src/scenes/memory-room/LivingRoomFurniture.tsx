"use client";

import type {} from "@react-three/fiber";
import { playSound } from "@/lib/audio";
import { useMemoryRoomStore } from "@/store/memory-room";
import { MemoryGlowSelection } from "./MemoryOutlineGlow";
import type { RoomPalette } from "./palette";
import type { Vec3Tuple } from "./types";
import { useGlowHover } from "./use-glow-hover";
import { useNearPlayer } from "./use-near-player";

/**
 * 거실 가구 (docs/story.md 8장). 전부 박스 조합 — 방(RoomFurniture)과
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
    { position: [-14.5, 0, 3.8], rotationY: Math.PI / 2 },
    { position: [-13.1, 0, 3.8], rotationY: -Math.PI / 2 },
    { position: [-13.4, 0, 2.62], rotationY: Math.PI + 0.5 },
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
  // 의자 — 반쯤 빼놓은 채다. 좌판 밑으로 다리가 1cm 파고든다
  { size: [0.56, 0.1, 0.34], position: [-14.95, 0.52, 5.38], color: "ink" },
  { size: [0.07, 0.48, 0.07], position: [-15.15, 0.24, 5.28], color: "slate" },
  { size: [0.07, 0.48, 0.07], position: [-14.75, 0.24, 5.28], color: "slate" },
  { size: [0.07, 0.48, 0.07], position: [-15.15, 0.24, 5.48], color: "slate" },
  { size: [0.07, 0.48, 0.07], position: [-14.75, 0.24, 5.48], color: "slate" },
] as const satisfies readonly BoxPart[];

/**
 * 커다란 곰인형 — 소파 옆 구석에 앉아 있다. 이 거실에서 유일하게 부드러운 물건.
 * 누구 것이었는지 말하지 않는다 — 셋이 살던 집에 남은, 아무도 안 치운 것 하나.
 *
 * 로컬 원점이 엉덩이 중심이고 +z를 본다. 살짝 틀어 앉혀야 진열이 아니라
 * 놓아둔 것으로 읽힌다. 발자국은 layout의 LIVING_COLLIDERS(plush).
 */
const PLUSH_BEAR_PARTS = [
  // 몸통과 배 — 배는 몸통 앞면을 물고 반 치수 나온다
  { size: [0.6, 0.62, 0.42], position: [0, 0.31, 0], color: "bone" },
  { size: [0.34, 0.3, 0.04], position: [0, 0.3, 0.215], color: "dusk" },
  // 머리 — 몸통 위로 2cm 파고들어 얹힌다
  { size: [0.46, 0.4, 0.38], position: [0, 0.8, 0], color: "bone" },
  { size: [0.13, 0.13, 0.1], position: [-0.17, 1.02, 0], color: "bone" },
  { size: [0.13, 0.13, 0.1], position: [0.17, 1.02, 0], color: "bone" },
  // 주둥이 — 머리 앞면(0.19)에 5mm 파고들어 붙는다
  { size: [0.18, 0.13, 0.05], position: [0, 0.76, 0.21], color: "dusk" },
  // 팔 — 몸통 옆면을 2cm 물고 늘어져 있다
  { size: [0.16, 0.42, 0.16], position: [-0.36, 0.32, 0], color: "bone" },
  { size: [0.16, 0.42, 0.16], position: [0.36, 0.32, 0], color: "bone" },
  // 다리 — 앉은 자세라 앞으로 뻗는다
  { size: [0.18, 0.16, 0.4], position: [-0.17, 0.08, 0.3], color: "bone" },
  { size: [0.18, 0.16, 0.4], position: [0.17, 0.08, 0.3], color: "bone" },
] as const satisfies readonly BoxPart[];

/** 곰인형의 자리 — 소파 왼쪽, 뒷벽 구석. 살짝 방 쪽으로 튼다. */
const PLUSH_BEAR_PLACEMENT = { position: [-11.75, 0, -3.3], rotationY: 0.35 } as const;

/**
 * 식탁 위에 펼쳐진 트럼프 — 카드 미궁(card-odd)의 진입점.
 *
 * 넷이서 치다 만 판이 그대로 남아 있다는 설정이라 덱 하나와 흩어진 카드 몇 장이다.
 * 규칙(문양의 색·대칭)은 방의 선반 놀이책이 들고 있다 (src/data/room-clues.ts) —
 * 여기서 문제를 만나고, 방으로 돌아가 규칙을 찾는 왕복이 설계다.
 */
const TABLE_TOP_Y = 0.975;
const DECK_NEAR = [-13.8, 3.8] as const;
const DECK_RADIUS = 1.9;

/** 흩어진 카드들 — [x, z, y회전]. 식탁 상판(1.6×1.6, 중심 -13.8/3.8) 안이다. */
const SPREAD_CARDS = [
  [-14.1, 3.55, 0.3],
  [-13.9, 4.1, -0.5],
  [-13.55, 3.95, 0.9],
  [-13.5, 3.5, -0.15],
] as const;

function TableCards({ palette }: { palette: RoomPalette }) {
  const solved = useMemoryRoomStore((state) => state.solvedPuzzles.includes("card-odd"));
  const openPuzzle = useMemoryRoomStore((state) => state.openPuzzle);
  const clickable = !solved;
  const { hovered, handlers } = useGlowHover(clickable);
  const near = useNearPlayer(DECK_NEAR[0], DECK_NEAR[1], DECK_RADIUS);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F group은 DOM이 아니라 Canvas 안의 포인터 대상이다.
    <group
      name="table-cards"
      {...handlers}
      onClick={(event) => {
        if (!clickable) return;
        event.stopPropagation();
        playSound("select");
        openPuzzle("card-odd");
      }}
    >
      <MemoryGlowSelection
        selectionKey="table-cards"
        tier="prop"
        enabled={clickable && (hovered || near)}
      >
        {/* 덱 — 반쯤 남은 더미 */}
        <mesh position={[-13.95, TABLE_TOP_Y + 0.025, 3.78]} castShadow>
          <boxGeometry args={[0.2, 0.05, 0.28]} />
          <meshStandardMaterial color={palette.bone} roughness={0.7} />
        </mesh>
        {SPREAD_CARDS.map(([x, z, turn]) => (
          <mesh
            key={`${x}:${z}`}
            position={[x, TABLE_TOP_Y + 0.004, z]}
            rotation={[0, turn, 0]}
            castShadow
          >
            <boxGeometry args={[0.18, 0.008, 0.26]} />
            <meshStandardMaterial color={palette.paper} roughness={0.7} />
          </mesh>
        ))}
      </MemoryGlowSelection>
    </group>
  );
}

export function LivingRoomFurniture({ palette }: { palette: RoomPalette }) {
  return (
    <group name="living-room-furniture">
      <Boxes parts={SOFA_PARTS} palette={palette} />
      <Boxes parts={TV_PARTS} palette={palette} />
      <Boxes parts={TABLE_PARTS} palette={palette} />
      <TableCards palette={palette} />
      {/* 배치는 DINING_SET.chairs — 상판·다리와의 간격을 테스트가 지키는 값이다 */}
      {DINING_SET.chairs.map((chair) => (
        <Chair
          key={chair.position.join(":")}
          palette={palette}
          position={chair.position}
          rotationY={chair.rotationY}
        />
      ))}
      <Boxes parts={SHOE_CABINET_PARTS} palette={palette} />
      <Boxes parts={FRIDGE_PARTS} palette={palette} />
      <Boxes parts={PIANO_PARTS} palette={palette} />
      <group
        position={PLUSH_BEAR_PLACEMENT.position}
        rotation={[0, PLUSH_BEAR_PLACEMENT.rotationY, 0]}
      >
        <Boxes parts={PLUSH_BEAR_PARTS} palette={palette} />
      </group>
    </group>
  );
}
