import type { MemoryId } from "@/data/memory-room";
import type { Aabb2, CameraPreset, MemoryPlacement, Vec3Tuple } from "./types";

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
export const DESK_POSITION = [-4.6, 0, -1.2] as const;
export const DESK_ROTATION = [0, Math.PI / 2, 0] as const;
// 책상이 커지면서 다리가 x=-4.0까지 나온다 — 의자를 그만큼 안쪽으로 물린다.
export const CHAIR_POSITION = [-3.3, 0, -1.2] as const;
export const CHAIR_ROTATION = [0, Math.PI / 2, 0] as const;

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
  /** 엔딩 — 문 옆 배트를 잡을 때. */
  ending: { position: [-1.4, 3.0, 6.7], target: [-5.25, 0.8, 4.15] },
  console: { position: [4.4, 2.4, 6.9], target: [1.05, 0.35, 4.05] },
  window: { position: [4.7, 4.2, 2.1], target: [1.15, 2.4, -3.7] },
  frame: { position: [4.05, 2.6, 0.75], target: [1.42, 1.4, -2.7] },
  radio: { position: [-1.1, 2.5, 2.1], target: [-4.05, 1.31, 0.1] },
  phone: { position: [6.75, 2.65, 6.25], target: [3.55, 0.95, 2.75] },
  calendar: { position: [-1.1, 3.6, 3.2], target: [-5.75, 2.5, 0.9] },
  ball: { position: [-1.4, 2.1, 6.6], target: [-5.1, 0.19, 3.75] },
} as const satisfies Record<"room" | "ending" | MemoryId, CameraPreset>;
