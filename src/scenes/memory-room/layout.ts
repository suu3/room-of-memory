import type { MemoryId } from "@/data/memory-room";
import type { Aabb2, CameraPreset, EulerTuple, MemoryPlacement, Vec3Tuple } from "./types";

export const ROOM_SHELL_BOUNDS: Aabb2 = { minX: -6, maxX: 8, minZ: -4, maxZ: 6.5 };
export const ROOM_SHELL_CENTER = [
  (ROOM_SHELL_BOUNDS.minX + ROOM_SHELL_BOUNDS.maxX) / 2,
  (ROOM_SHELL_BOUNDS.minZ + ROOM_SHELL_BOUNDS.maxZ) / 2,
] as const;
export const REFERENCE_ROOM_LAYOUT = {
  openEdge: "front",
  hasVisibleWallDoor: true,
  doorSide: "left",
  deskSide: "left",
  bedSide: "right",
} as const;
export const ROOM_DOOR_POSITION = [ROOM_SHELL_BOUNDS.minX + 0.14, 1.7, 5.35] as const;
export const ROOM_DOOR_ROTATION = [0, Math.PI / 2, 0] as const;

/*
 * ---------------------------------------------------------------- 거실 (v2)
 *
 * 방문(-x 벽) 너머의 두 번째 공간 (docs/content-design-v2.md 2장). 방과 벽 하나
 * (x = ROOM_SHELL_BOUNDS.minX)를 공유하고, 그 벽의 문이 둘을 잇는다.
 * 반대쪽 끝(-x)에 현관문이 있다 — 엔딩은 이제 거기서 난다.
 */
export const LIVING_SHELL_BOUNDS: Aabb2 = {
  minX: -16.5,
  maxX: ROOM_SHELL_BOUNDS.minX,
  minZ: ROOM_SHELL_BOUNDS.minZ,
  maxZ: ROOM_SHELL_BOUNDS.maxZ,
};
export const LIVING_SHELL_CENTER = [
  (LIVING_SHELL_BOUNDS.minX + LIVING_SHELL_BOUNDS.maxX) / 2,
  (LIVING_SHELL_BOUNDS.minZ + LIVING_SHELL_BOUNDS.maxZ) / 2,
] as const;

/** 거실의 걷는 범위. 방(ROOM_BOUNDS)과 같은 여유(0.45)로 벽에서 물린다. */
export const LIVING_BOUNDS: Aabb2 = {
  minX: LIVING_SHELL_BOUNDS.minX + 0.45,
  maxX: LIVING_SHELL_BOUNDS.maxX - 0.45,
  minZ: LIVING_SHELL_BOUNDS.minZ + 0.45,
  maxZ: LIVING_SHELL_BOUNDS.maxZ - 0.45,
};

/**
 * 문간 판정 구간 — 방과 거실을 잇는 세 번째 걷기 영역 (v2 기획 5장).
 *
 * 벽에 난 구멍이 아니라 두 공간의 걷기 범위를 겹쳐 잇는 다리다. x 양끝은 각
 * 공간의 걷기 범위와 **플레이어 지름(0.76) 이상** 겹쳐야 한다 — 덜 겹치면 중심이
 * 어느 영역에도 못 들어가는 틈이 생겨 문턱에서 몸이 끼인다 (layout.test가 지킨다).
 * z 범위는 문 개구부(DOOR_OPENING_Z, 5.35±0.91) 안쪽 — 몸 반지름을 더해도
 * 벽 단면을 스치지 않는 폭이다.
 */
export const DOORWAY_ZONE: Aabb2 = { minX: -7.4, maxX: -4.6, minZ: 4.7, maxZ: 6.0 };

/**
 * 거실 가구의 발자국 (v2 기획 7장). 배치 원칙 둘:
 * 문간(DOORWAY_ZONE)에서 나오는 길과 현관문 앞(FRONT_DOOR_INTERACTION 반경)은
 * 비워 둔다 — 나오자마자 소파에 끼거나, 엔딩 문 앞에 가구가 서 있으면 안 된다.
 * layout.test가 이 둘을 지킨다.
 */
export const LIVING_COLLIDERS = [
  { minX: -10.95, maxX: -8.05, minZ: -4, maxZ: -2.2 }, // sofa
  { minX: -10.75, maxX: -8.25, minZ: 5.9, maxZ: 6.5 }, // tv stand
  { minX: -14.75, maxX: -12.85, minZ: 2.3, maxZ: 4.75 }, // dining table + chairs (빠진 의자 포함)
  { minX: -16.5, maxX: -15.85, minZ: -1.7, maxZ: 0.35 }, // shoe cabinet
  { minX: -15.85, maxX: -14.8, minZ: -4, maxZ: -3.2 }, // fridge (피아노에게 +z 벽을 내주고 -z 구석으로)
  { minX: -15.75, maxX: -14.15, minZ: 5.15, maxZ: 6.5 }, // piano + 반쯤 빼놓은 의자
  { minX: -12.3, maxX: -11.2, minZ: -3.9, maxZ: -2.8 }, // plush bear (소파 옆)
] as const satisfies readonly Aabb2[];

/**
 * 현관문 — 거실 -x 끝 벽. 배트가 방문을 열게 되면서 엔딩 트리거가 여기로 왔다
 * (docs/content-design-v2.md 3장). 회전은 방문과 반대 — 문이 벽 안쪽을 본다.
 */
export const FRONT_DOOR_POSITION = [LIVING_SHELL_BOUNDS.minX + 0.14, 1.7, 1.25] as const;
export const FRONT_DOOR_ROTATION = [0, Math.PI / 2, 0] as const;
export const FRONT_DOOR_INTERACTION = {
  near: [FRONT_DOOR_POSITION[0], FRONT_DOOR_POSITION[2]] as readonly [number, number],
  interactionRadius: 2.2,
} as const;
export const DESK_POSITION = [-4.6, 0, -1.2] as const;
export const DESK_ROTATION = [0, Math.PI / 2, 0] as const;
// 책상이 커지면서 다리가 x=-4.0까지 나온다 — 의자를 그만큼 안쪽으로 물린다.
export const CHAIR_POSITION = [-3.3, 0, -1.2] as const;
export const CHAIR_ROTATION = [0, Math.PI / 2, 0] as const;

/**
 * 의자를 책상에서 끌어낸 양. 책상은 의자의 -x 쪽에 있으므로 +x로 물러난다.
 *
 * 거리를 크게 잡지 않는 이유: ROOM_COLLIDERS의 의자 박스는 고정이라 의자만 움직이면
 * 충돌 판정이 제자리에 남는다. 밀려난 좌석 끝(중심 +거리 +반폭 0.525)이 플레이어가
 * 설 수 있는 가장 안쪽 선(콜라이더 maxX -2.82 + 반지름 0.38 = -2.44)을 넘지 않아야
 * 의자를 뚫고 지나가는 장면이 안 나온다 — 그 한계가 0.335이고, layout.test가 지킨다.
 */
export const CHAIR_PULL = { distance: 0.33, turn: 0.12 } as const;

/**
 * 서랍이 밀려 나오는 거리. 둘 다 몸통 앞면이 +z를 보고 있어 +z로 나온다.
 * 콜라이더가 몸통보다 조금 앞까지 잡혀 있어(캐비닛 0.28, 협탁 0.04) 그 여유 안에서 멈춘다.
 */
export const DRAWER_TRAVEL = { cabinet: 0.34, nightstand: 0.24 } as const;

/**
 * 캐비닛 몸통. 액자·스마트폰이 놓이는 면이라 RoomFurniture와 MEMORY_PLACEMENTS가
 * 같은 수치를 봐야 한다 — 따로 들고 있다가 어긋나면 오브젝트가 상판을 뚫거나
 * 앞으로 떠 버린다.
 */
export const CABINET_BODY = {
  size: [4.4, 1.15, 0.72],
  position: [2.35, 0.58, -2.89],
} as const satisfies { size: Vec3Tuple; position: Vec3Tuple };
/** 캐비닛 상판 윗면 높이. 위에 얹는 물건의 밑면은 여기보다 조금 아래여야 안 깜빡인다. */
export const CABINET_TOP_Y = CABINET_BODY.position[1] + CABINET_BODY.size[1] / 2;
/**
 * 캐비닛 상판을 이미 차지하고 있는 소품들의 x 구간. 기억 오브젝트를 이 위에 겹쳐
 * 놓으면 안 된다 (액자가 수납상자 속에 파묻혔던 원인). x는 RoomFurniture가 그대로
 * 가져다 쓰고, halfWidth는 거기서 그리는 도형 크기와 맞춰 둔다.
 */
export const CABINET_TOP_PROPS = {
  plant: { x: 0.65, halfWidth: 0.29 },
  storageBox: { x: 2.25, halfWidth: 0.36 },
  clock: { x: 3.92, halfWidth: 0.28 },
} as const;

/** 캐비닛 상판의 x·z 범위. */
export const CABINET_TOP_BOUNDS: Aabb2 = {
  minX: CABINET_BODY.position[0] - CABINET_BODY.size[0] / 2,
  maxX: CABINET_BODY.position[0] + CABINET_BODY.size[0] / 2,
  minZ: CABINET_BODY.position[2] - CABINET_BODY.size[2] / 2,
  maxZ: CABINET_BODY.position[2] + CABINET_BODY.size[2] / 2,
};

export const ROOM_BOUNDS: Aabb2 = { minX: -5.55, maxX: 7.55, minZ: -3.55, maxZ: 6.05 };

export const ROOM_COLLIDERS = [
  { minX: -5.48, maxX: -3.72, minZ: -3.35, maxZ: 0.95 }, // desk
  { minX: 3, maxX: 6.3, minZ: 0.1, maxZ: 5.6 }, // bed
  { minX: 0.15, maxX: 4.7, minZ: -3.35, maxZ: -2.25 }, // cabinet
  { minX: 6.3, maxX: 7.25, minZ: 0.3, maxZ: 1.2 }, // nightstand
  // 의자 — CHAIR_POSITION의 좌석/등받이 발자국(±0.525)에서 살짝 안쪽으로 잡는다
  { minX: -3.78, maxX: -2.82, minZ: -1.68, maxZ: -0.72 }, // chair
] as const satisfies readonly Aabb2[];

/**
 * 문 옆에 세워둔 배트. 수집 대상이 아니라 2바퀴를 다 돌면 켜지는 엔딩 트리거라
 * MEMORY_PLACEMENTS와 따로 둔다.
 */
export const BAT_PLACEMENT = {
  position: [-5.25, 1.48, 4.15],
  rotation: [0, 0, Math.PI - 0.22],
  scale: 1.6,
  interactionRadius: 1.35,
} as const satisfies Omit<MemoryPlacement, "id">;

/**
 * 문 쪽 왼벽에 붙은 조명 스위치. 기억도 트리거도 아닌 배경 오브젝트다 —
 * 진행에는 아무 영향이 없고 방의 불만 끄고 켠다 (docs/content-design.md 4-2).
 *
 * 좌표는 RoomDecor가 장식으로 그리던 자리를 그대로 물려받았다 (왼벽 안쪽 면
 * x=-5.91 + 판 두께의 절반). 장식과 실물을 둘 다 두면 스위치가 두 개로 보인다.
 */
export const LIGHT_SWITCH_PLACEMENT = {
  position: [-5.885, 1.72, 4.15],
  rotation: [0, Math.PI / 2, 0],
  /** 판/토글 크기도 장식이 쓰던 값 그대로 — [폭(z), 높이(y), 두께(x)]. */
  plateSize: [0.2, 0.3, 0.05],
  rockerSize: [0.1, 0.14, 0.03],
  /**
   * 다가가면 빛나기 시작하는 거리. 표식이 없는 물건이라 이 반경이 곧 "여기 뭔가
   * 있다"는 유일한 신호다 — 옆에 선 배트(1.35)와 같이 잡아 둘이 함께 켜지게 한다.
   */
  interactionRadius: 1.35,
} as const;

/*
 * 컴퓨터 비밀번호 단서를 든 배경 오브젝트.
 *
 * 기억이 아니라 방의 소품이라 MEMORY_PLACEMENTS와 따로 둔다 — 수집 카운터에도
 * 해금 규칙에도 끼지 않고, 만져도 진행에는 아무 일이 없다 (전등 스위치와 같은
 * 성격). 무엇이 적혀 있는지는 src/data/room-clues.ts에 있다.
 */

/**
 * 협탁 서랍 속 접힌 쪽지. 서랍 부품과 같은 월드 프레임(닫힌 상태)이고, 서랍
 * 그룹이 통째로 +z로 밀려 나갈 때 같이 나온다.
 *
 * y는 서랍판 윗변(0.86)보다 높고 협탁 몸통 윗면(0.955)보다 낮다 — 닫혀 있으면
 * 몸통 안에 잠겨 안 보이고, 열리면 서랍판 너머로 위에서 내려다보인다.
 */
export const DRAWER_NOTE = {
  position: [6.8, 0.89, 1.05] as Vec3Tuple,
  /**
   * 아무렇게나 던져둔 각도. 크게 틀면 돌아간 만큼 z로 두꺼워져서, 서랍이 다 나와도
   * (0.24) 몸통 앞을 못 벗어난다 — layout.test가 그 여유를 지킨다.
   */
  rotation: [0, 0.12, 0] as EulerTuple,
  /** [가로, 두께, 세로]. 서랍 안쪽 폭(0.72)에 한참 못 미쳐야 쪽지로 읽힌다. */
  size: [0.26, 0.012, 0.14] as Vec3Tuple,
  near: [6.8, 1.16] as readonly [number, number],
  interactionRadius: 2.1,
} as const;

/**
 * 들여다볼 수 있는 곁가지 물건들의 다가감 판정. 3D는 각자 제 자리(RoomDecor·
 * RoomFurniture)에서 그리고, 여기엔 기준점과 반경만 모은다 — 서랍 속 쪽지와 달리
 * 이 둘은 원래 있던 장식을 그대로 쓰므로 좌표를 새로 잡을 게 없다.
 */
export const CLUE_PROPS = {
  /** 뒷벽 선반에 꽂힌 책들 중 한 권 (RoomDecor의 SHELF_BOOKS). */
  shelfBook: { near: [4.86, -3.66] as readonly [number, number], interactionRadius: 2.2 },
  /** 캐비닛 상판의 탁상시계 (RoomFurniture의 DeskClock). */
  deskClock: {
    near: [CABINET_TOP_PROPS.clock.x, -2.82] as readonly [number, number],
    interactionRadius: 2.1,
  },
} as const;

export const MEMORY_PLACEMENTS = {
  console: {
    id: "console",
    // 러그 위에 던져둔 휴대용 게임기. 사방이 트여 있어 다가가기 쉽다.
    position: [1.05, 0.03, 4.05],
    rotation: [0, -0.55, 0],
    scale: 1,
    interactionRadius: 1.05,
  },
  window: {
    id: "window",
    position: [1.15, 2.55, -3.88],
    rotation: [0, 0, 0],
    scale: 1,
    interactionRadius: 1.6,
  },
  frame: {
    id: "frame",
    // 예전 좌표(x=2.15)는 캐비닛 위 수납상자(x 1.89~2.61) 속에 액자를 통째로 파묻었다.
    // 화분(x≤0.94)과 수납상자 사이 빈자리로 옮기고, 상판 윗면(y=1.155)에
    // 아랫변이 살짝 파고들도록 y를 잡는다 — 딱 맞추면 면이 겹쳐 깜빡인다.
    position: [1.42, 1.355, -2.85],
    rotation: [0, -0.3, 0],
    scale: 1,
    interactionRadius: 1.05,
  },
  computer: {
    id: "computer",
    /*
     * 책상 위 컴퓨터 세트(모니터·키보드·마우스). 예전 DeskAccessories가 그리던
     * 월드 좌표를 그대로 물려받되, 앵커는 세트의 무게중심쯤(키보드 언저리)에 둔다 —
     * 모니터에 앵커를 두면 책상 안쪽이라 상호작용 반경이 통로까지 안 닿는다.
     * 부품별 오프셋은 MemoryObjects의 ComputerMemory가 이 앵커 기준으로 갖고 있다.
     *
     * 반경 1.5: 의자 콜라이더(z -1.68~-0.72)가 정면을 막아서, 플레이어는 의자
     * 옆(z≈-0.34 또는 z≈-2.06)의 통로에서 닿는다 — 그 거리가 약 1.33이다.
     */
    position: [-4.5, 1.11, -1.0],
    rotation: [0, Math.PI / 2, 0],
    scale: 1,
    interactionRadius: 1.5,
  },
  radio: {
    id: "radio",
    // y는 책상 상판 윗면(1.11) — 라디오 로컬 원점이 밑면이라 그대로 얹힌다.
    // 넓어진 책상 한가운데에 두면 플레이어가 반경 안으로 들어올 수 없다.
    // 통로 쪽(+X) 모서리로, 의자를 피해 앞쪽(+Z)에 얹는다.
    position: [-4.05, 1.11, 0.1],
    rotation: [0, Math.PI / 2 + 0.2, 0],
    // glb 라디오 높이가 0.23이라, 예전 프리미티브와 같은 0.42 높이가 되게 잡는다
    scale: 1.83,
    interactionRadius: 1.05,
  },
  phone: {
    id: "phone",
    /*
     * 침대에 던져둔 폰. 매트리스 윗면은 y=0.81이고, 눕히면 두께의 절반(0.04)만큼
     * 떠야 하므로 원점은 0.86이다.
     *
     * x는 침대 왼쪽 변(3.14)에 붙인다 — 침대는 통째로 콜라이더라 위로 올라갈 수 없고,
     * 안쪽에 두면 콜라이더 밖에서 닿을 수 있는 가장 가까운 자리(x=2.62)에서
     * 상호작용 반경 밖으로 밀려난다. z는 베개(z≤2.13)를 피해 발치 쪽으로.
     *
     * 회전의 X는 -π/2 + 0.18 — 뒤쪽 0.18은 PhoneMemory가 세워 든 자세로 갖고 있는
     * 기울기를 상쇄하는 몫이라, 합치면 정확히 화면이 천장을 보고 눕는다.
     */
    position: [3.55, 0.86, 2.9],
    rotation: [-Math.PI / 2 + 0.18, 0, 0.42],
    // 손에 쥐는 물건 치고 너무 컸다 — 게임기(가로 0.46)보다 작아야 폰으로 읽힌다
    scale: 0.5,
    interactionRadius: 1.25,
  },
  calendar: {
    id: "calendar",
    position: [-5.88, 2.55, 0.9],
    rotation: [0, Math.PI / 2, 0],
    scale: 1,
    interactionRadius: 1.25,
  },
  ball: {
    id: "ball",
    // glb는 반지름 1 구 — scale이 곧 반지름이라 y도 같은 값이어야 바닥에 닿는다
    position: [-5.1, 0.19, 3.75],
    rotation: [0, 0, 0],
    scale: 0.19,
    interactionRadius: 1.05,
  },
} as const satisfies Record<MemoryId, MemoryPlacement>;

export const CAMERA_PRESETS = {
  // room.target.y를 올리면 시선 중심이 위로 가면서 방이 화면 아래쪽으로 내려온다
  room: { position: [14.2, 10.4, 15.4], target: [0.8, 2.35, 1.2] },
  /** 엔딩 — 거실 끝 현관문을 열 때 (v2에서 배트 → 현관문으로 옮겨왔다). */
  ending: { position: [-12.1, 3.1, 3.8], target: [-15.95, 0.9, 1.25] },
  console: { position: [4.4, 2.4, 6.9], target: [1.05, 0.35, 4.05] },
  window: { position: [4.7, 4.2, 2.1], target: [1.15, 2.4, -3.7] },
  frame: { position: [4.05, 2.6, 0.75], target: [1.42, 1.4, -2.7] },
  radio: { position: [-1.1, 2.5, 2.1], target: [-4.05, 1.31, 0.1] },
  // 라디오와 같은 통로에서 책상 안쪽(모니터)을 비스듬히 본다
  computer: { position: [-0.9, 2.7, 1.1], target: [-4.6, 1.5, -0.95] },
  phone: { position: [6.75, 2.65, 6.25], target: [3.55, 0.95, 2.75] },
  calendar: { position: [-1.1, 3.6, 3.2], target: [-5.75, 2.5, 0.9] },
  ball: { position: [-1.4, 2.1, 6.6], target: [-5.1, 0.19, 3.75] },
} as const satisfies Record<"room" | "ending" | MemoryId, CameraPreset>;
