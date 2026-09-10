import type { SeatId } from "@/types/seat";
import { BED_COLLIDER, BED_MATTRESS, BED_ORIGIN, BED_PILLOW } from "./bed";
import {
  CHAIR_POSITION,
  CHAIR_PULL,
  CHAIR_SEAT,
  LIVING_ANCHORS,
  LIVING_DINING_CHAIRS,
  LIVING_FURNITURE_SCALE,
  scaleLivingHeight,
  scaleLivingPoint,
} from "./layout";
import { LIE_HEAD, LIE_TILT, SIT_CONTACT_Y, SIT_LEG_Z } from "./player-rig";
import type { Vec2 } from "./spatial";

/**
 * 앉을 수 있는 자리 (방 책상 의자 · 소파 쿠션 셋 · 식탁 의자 셋 · 피아노 의자), 그리고
 * 누울 수 있는 자리 하나 (방 침대).
 *
 * 가구는 저마다 제 파일에서 그린다. 여기 모으는 건 "몸이 어디에 어떻게 놓이는가"뿐이다.
 * 좌표는 그 가구 부품에서 파생되므로, 가구를 옮기면 여기 center/near도 같이 옮긴다.
 *
 * 앉는 자세는 하나(Sit 클립)뿐이고 가구마다 좌면 높이만 다르다. 몸은 `좌면 - SIT_CONTACT_Y`
 * 에 얹히고, 앞뒤 위치는 좌면 앞턱에서 역산한다 (seatAnchor). 눕는 자세는 Idle을 통째로
 * 눕힌 것이라(player-rig의 LIE_TILT) 앞턱 계산이 없다. 대신 침대 옆에 먼저 서는 자리
 * (`approach`)가 있다. 한가운데까지 걸어 들어가면 매트리스를 뚫고 걷는다.
 */

export type { SeatId };

export interface Seat {
  id: SeatId;
  /** 어느 공간의 가구인가: 한 번에 한 방만 보인다 (MemoryRoomScene). */
  space: "room" | "living";
  /** 앉는가 눕는가. 눕는 자리는 좌면 앞턱 규칙을 타지 않는다. 생략하면 앉는다. */
  pose?: "sit" | "lie";
  /** 앉으면 몸(리그 루트)이 놓이는 자리. */
  anchor: Vec2;
  /**
   * 앉기 전에 걸어가서 서는 자리. 생략하면 anchor까지 걸어간다 (의자는 앉는 자리로
   * 곧장 들어가도 된다). 침대는 옆에 섰다가 눕는 동작 중에 anchor로 올라간다.
   */
  approach?: Vec2;
  /**
   * 눕기 전에 걸터앉는 자리 (눕는 자리에만). 가장자리에 앉았다가 발을 올리며 anchor로
   * 눕는다. 서서 곧장 뒤로 넘어가면 사람이 눕는 걸로 안 읽힌다 (sit-motion의 liePhasesOf).
   * 앉는 자리이므로 좌면 앞턱 규칙을 탄다.
   */
  perch?: { x: number; z: number; bodyY: number; facing: number };
  /** 앉으면 몸이 놓이는 높이 = 좌면 - SIT_CONTACT_Y. */
  bodyY: number;
  /** 앉으면 바라보는 방향(rad). 모델 정면이 +Z라 (sin, cos)가 곧 정면 벡터다. */
  facing: number;
  /** 다가갔는지 재는 기준점: 의자가 빠지기 전, 제자리에 있을 때의 좌면 중심. */
  near: Vec2;
  /** 이 거리 안에 서 있어야 앉을 수 있다. */
  reach: number;
  /**
   * 앉는 동안 의자가 빠져 나가는 양 (월드 x·z와 회전). 책상·식탁 밑으로 들어가 있는
   * 의자는 빼지 않으면 앉은 몸이 상판을 뚫는다.
   */
  pull?: { x: number; z: number; turn: number };
}

/**
 * 좌면 앞턱과 정강이 사이에 두는 여유. 0이면 정강이 뒷면이 앞턱과 같은 평면에 놓여
 * 프레임마다 앞뒤가 뒤집힌다 (가구 부품끼리 지키는 z-fighting 원칙과 같은 이유).
 */
const EDGE_CLEARANCE = 0.013;

/** 좌면 중심에서 몸까지의 거리: 무릎 아래가 앞턱 밖으로 나가는 가장 뒤쪽 자리다. */
export function seatOffsetFromCenter(halfDepth: number): number {
  return halfDepth - SIT_LEG_Z.back + EDGE_CLEARANCE;
}

/** 좌면 중심에서 정면으로 `seatOffsetFromCenter`만큼 나간 자리. */
function seatAnchor(center: Vec2, facing: number, halfDepth: number): Vec2 {
  const distance = seatOffsetFromCenter(halfDepth);
  return { x: center.x + Math.sin(facing) * distance, z: center.z + Math.cos(facing) * distance };
}

/** 다가가야 앉을 수 있는 거리. 서랍·커튼과 같은 값이라 방의 손 닿는 거리가 하나로 읽힌다. */
const SEAT_REACH = 2.1;

/*
 * ── 방: 책상 의자 ────────────────────────────────────────────────
 *
 * 앉으면 의자가 먼저 빠진다 (CHAIR_PULL). 밀어 넣은 채로 앉으면 상판(x -3.8부터) 아래로
 * 몸이 들어가고, 일어설 자리도 없다. 사람도 의자를 빼고 앉는다.
 * 좌면 치수는 layout의 CHAIR_SEAT: 의자를 그리는 쪽과 같은 수를 본다.
 */
const DESK_CHAIR_HALF_DEPTH = CHAIR_SEAT.half;
const DESK_CHAIR_SEAT_Y = CHAIR_SEAT.topY;
/** 등받이가 +x를 보고 서 있으므로(CHAIR_ROTATION) 정면은 -x, 빠진 만큼 틀어진다. */
const DESK_CHAIR_FACING = -Math.PI / 2 + CHAIR_PULL.turn;
const DESK_CHAIR_CENTER: Vec2 = {
  x: CHAIR_POSITION[0] + CHAIR_PULL.distance,
  z: CHAIR_POSITION[2],
};

/*
 * ── 방: 침대 ────────────────────────────────────────────────────
 *
 * 유일하게 눕는 자리. 치수는 전부 bed.ts(침대 glb 실측 × 배치)에서 온다. 매트리스
 * 한가운데에 등을 대고 머리는 베개 위에 온다. 발 원점이 `anchor`에 오고 몸은 거기서
 * -z로 눕는다 (facing 0 = 정면 +z를 위로).
 */
const BED_MATTRESS_TOP_Y = BED_MATTRESS.topY;
/** 발 원점 z: 눕힌 머리 중심(로컬 y 1.2)이 베개 한가운데에 오는 자리. */
const BED_LIE_Z = BED_PILLOW.centerZ + LIE_HEAD.centerY * Math.cos(LIE_TILT);
/** 다가서는 자리와 침대 발자국 사이에 두는 거리: 플레이어 반지름(0.38)에 여유를 더한 값. */
const BED_STAND_OFF = 0.45;
/** 침대 옆에서 올라서는 자리: 침대 발자국(BED_COLLIDER)에서 플레이어 반지름만큼 물러선 곳. */
const BED_APPROACH: Vec2 = { x: BED_COLLIDER.minX - BED_STAND_OFF, z: BED_LIE_Z };
/**
 * 침대는 의자와 달리 길다. 다가갔는지를 옆면 한 점에서 재면 발치 쪽에 서 있는 사람은
 * 베개 옆까지 붙어야 눌린다. 발자국 한가운데에서 재고, 반경은 발자국의 먼 모서리(약 2.6)에
 * 한 걸음을 더한 값으로 잡아 어느 면에서든 한 걸음 안에서 켜지게 한다.
 */
const BED_NEAR: Vec2 = { x: BED_ORIGIN.x, z: (BED_COLLIDER.minZ + BED_COLLIDER.maxZ) / 2 };
const BED_REACH = 3.5;
/**
 * 눕기 전에 걸터앉는 자리. 매트리스 왼쪽 변(방 쪽)에 정강이를 걸치고 방 쪽(-x)을 보고
 * 앉는다. 의자와 같은 앞턱 규칙이라 엉덩이는 매트리스 위, 무릎 아래는 밖이다. 발은
 * 바닥에서 뜬다 (다른 좌면과 같다).
 */
const BED_PERCH = {
  x: BED_MATTRESS.minX - seatOffsetFromCenter(0),
  z: BED_LIE_Z,
  bodyY: BED_MATTRESS_TOP_Y - SIT_CONTACT_Y,
  facing: -Math.PI / 2,
} as const;

/*
 * 거실 가구는 1배 좌표를 적고 layout의 LIVING_FURNITURE_SCALE로 키운다 (LIVING_ANCHORS 주석).
 * 여기도 1배 값을 적고 같은 기준점으로 키운다. 좌면 높이는 바닥을 축으로 배율만 곱한다.
 */

/*
 * ── 거실: 소파 ──────────────────────────────────────────────────
 *
 * 쿠션 셋 (LivingRoomFurniture의 SOFA_PARTS). 가운데는 눌린 자리라 좌면이 낮다.
 * 앞턱은 쿠션(-2.67)이 아니라 **몸통 앞면(-2.65)** 이다. 늘어진 다리가 스치는 건 몸통이다.
 */
const [, SOFA_CUSHION_Z] = scaleLivingPoint(LIVING_ANCHORS.sofa, -9.5, -3.08);
const [, SOFA_FRONT_Z] = scaleLivingPoint(LIVING_ANCHORS.sofa, -9.5, -2.65);
const SOFA_HALF_DEPTH = SOFA_FRONT_Z - SOFA_CUSHION_Z;
const SOFA_SIDE_SEAT_Y = scaleLivingHeight(0.6);
/** 아빠 자리. 오래 눌린 쿠션이라 6cm 낮다. 앉으면 그만큼 내려앉는다. */
const SOFA_CENTER_SEAT_Y = scaleLivingHeight(0.54);
/** 쿠션 셋의 x: 1배 좌표를 소파 기준점으로 키운다. */
const sofaCushionX = (x: number) => scaleLivingPoint(LIVING_ANCHORS.sofa, x, -3.08)[0];

/*
 * ── 거실: 식탁 의자 ──────────────────────────────────────────────
 *
 * 배치는 layout의 LIVING_DINING_CHAIRS, 좌면은 CHAIR_PART_TEMPLATE 첫 항목(0.56 + 0.035, 0.44×0.44).
 * 상판 윗면이 0.975라 캐릭터 가슴 높이다. 밀어 넣은 두 개는 빼지 않으면 상판이 몸을 가른다.
 */
const DINING_HALF_DEPTH = 0.22 * LIVING_FURNITURE_SCALE;
const DINING_SEAT_Y = scaleLivingHeight(0.595);
/** 상판 모서리(중심에서 0.8) 밖으로 몸통이 나가는 거리: 어깨 반폭 뒤로 0.18 여유. */
const DINING_PULL = 0.8 * LIVING_FURNITURE_SCALE;
function diningChairCenter(seat: (typeof LIVING_DINING_CHAIRS)[number]["seat"]): Vec2 {
  const chair = LIVING_DINING_CHAIRS.find((entry) => entry.seat === seat);
  if (!chair) throw new Error(`no dining chair for seat ${seat}`);
  return { x: chair.position[0], z: chair.position[2] };
}

/*
 * ── 거실: 피아노 의자 ────────────────────────────────────────────
 *
 * PIANO_PARTS의 걸상(0.52 + 0.05, 앞뒤 0.34). 얕아서 엉덩이가 뒤로 조금 나가지만,
 * 무릎은 건반 뚜껑(y 0.85~0.99) 아래로 들어간다. 피아노 앞에 앉은 그림 그대로다.
 */
const [PIANO_BENCH_X, PIANO_BENCH_Z] = scaleLivingPoint(LIVING_ANCHORS.piano, -14.95, 5.38);
const PIANO_BENCH_CENTER: Vec2 = { x: PIANO_BENCH_X, z: PIANO_BENCH_Z };
const PIANO_BENCH_HALF_DEPTH = 0.17 * LIVING_FURNITURE_SCALE;
const PIANO_BENCH_SEAT_Y = scaleLivingHeight(0.57);

function sofaSeat(id: SeatId, x: number, seatY: number): Seat {
  const center: Vec2 = { x, z: SOFA_CUSHION_Z };
  return {
    id,
    space: "living",
    anchor: seatAnchor(center, 0, SOFA_HALF_DEPTH),
    bodyY: seatY - SIT_CONTACT_Y,
    facing: 0,
    near: center,
    reach: SEAT_REACH,
  };
}

function diningSeat(id: SeatId, center: Vec2, facing: number, pulled: boolean): Seat {
  // 빠져 나가는 방향은 정면의 반대다. 상판 밑에서 몸을 빼내는 몫이라 회전은 붙이지 않는다.
  const pull = pulled
    ? { x: -Math.sin(facing) * DINING_PULL, z: -Math.cos(facing) * DINING_PULL, turn: 0 }
    : undefined;
  const seatCenter: Vec2 = { x: center.x + (pull?.x ?? 0), z: center.z + (pull?.z ?? 0) };
  return {
    id,
    space: "living",
    anchor: seatAnchor(seatCenter, facing, DINING_HALF_DEPTH),
    bodyY: DINING_SEAT_Y - SIT_CONTACT_Y,
    facing,
    near: center,
    reach: SEAT_REACH,
    pull,
  };
}

export const SEATS: Record<SeatId, Seat> = {
  "desk-chair": {
    id: "desk-chair",
    space: "room",
    anchor: seatAnchor(DESK_CHAIR_CENTER, DESK_CHAIR_FACING, DESK_CHAIR_HALF_DEPTH),
    bodyY: DESK_CHAIR_SEAT_Y - SIT_CONTACT_Y,
    facing: DESK_CHAIR_FACING,
    near: { x: CHAIR_POSITION[0], z: CHAIR_POSITION[2] },
    reach: SEAT_REACH,
    pull: { x: CHAIR_PULL.distance, z: 0, turn: CHAIR_PULL.turn },
  },
  bed: {
    id: "bed",
    space: "room",
    pose: "lie",
    anchor: { x: BED_ORIGIN.x, z: BED_LIE_Z },
    approach: BED_APPROACH,
    perch: BED_PERCH,
    bodyY: BED_MATTRESS_TOP_Y,
    facing: 0,
    near: BED_NEAR,
    reach: BED_REACH,
  },
  "sofa-left": sofaSeat("sofa-left", sofaCushionX(-10.28), SOFA_SIDE_SEAT_Y),
  "sofa-center": sofaSeat("sofa-center", sofaCushionX(-9.5), SOFA_CENTER_SEAT_Y),
  "sofa-right": sofaSeat("sofa-right", sofaCushionX(-8.72), SOFA_SIDE_SEAT_Y),
  // 창 쪽·문 쪽 둘은 상판 밑에 들어가 있고, 셋째는 이미 빠져 나와 등을 돌린 채다.
  "dining-window": diningSeat(
    "dining-window",
    diningChairCenter("dining-window"),
    Math.PI / 2,
    true,
  ),
  "dining-door": diningSeat("dining-door", diningChairCenter("dining-door"), -Math.PI / 2, true),
  "dining-pulled": diningSeat(
    "dining-pulled",
    diningChairCenter("dining-pulled"),
    Math.PI + 0.5,
    false,
  ),
  "piano-bench": {
    id: "piano-bench",
    space: "living",
    anchor: seatAnchor(PIANO_BENCH_CENTER, 0, PIANO_BENCH_HALF_DEPTH),
    bodyY: PIANO_BENCH_SEAT_Y - SIT_CONTACT_Y,
    facing: 0,
    near: PIANO_BENCH_CENTER,
    reach: SEAT_REACH,
  },
};

export const SEAT_IDS = Object.keys(SEATS) as readonly SeatId[];
/** 앉는 자리만: 좌면 앞턱 규칙은 이쪽에만 적용된다. */
export const SIT_SEAT_IDS = SEAT_IDS.filter((id) => SEATS[id].pose !== "lie");

/** 각 좌석의 좌면 앞뒤 반폭: 몸이 얼마나 걸쳐 앉는지 재는 테스트가 본다. 눕는 자리는 없다. */
export const SEAT_HALF_DEPTH = {
  "desk-chair": DESK_CHAIR_HALF_DEPTH,
  "sofa-left": SOFA_HALF_DEPTH,
  "sofa-center": SOFA_HALF_DEPTH,
  "sofa-right": SOFA_HALF_DEPTH,
  "dining-window": DINING_HALF_DEPTH,
  "dining-door": DINING_HALF_DEPTH,
  "dining-pulled": DINING_HALF_DEPTH,
  "piano-bench": PIANO_BENCH_HALF_DEPTH,
} as const satisfies Record<Exclude<SeatId, "bed">, number>;
