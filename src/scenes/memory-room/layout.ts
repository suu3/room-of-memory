import type { MemoryId } from "@/data/memory-room";
import type { SeatId } from "@/types/seat";
import { BED_COLLIDER } from "./bed";
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

/**
 * 방문 문짝. 경첩은 문틀 왼기둥 안쪽(문 로컬 -x로 hingeOffset)이고, 열리면 openAngle만큼
 * 방 안쪽(+x)으로 꺾여 선다. RoomShell이 이대로 그리고, 아래 OPEN_DOOR_LEAF_COLLIDERS가
 * 같은 판을 막는다. 현관문도 같은 각도로 연다 (LivingRoomShell).
 *
 * 90°까지 여는 이유: 66°(1.15)로 비스듬히 두면 판이 문간 통로로 1/3쯤 들어와서, 콜라이더를
 * 두는 순간 문 한가운데를 향해 걷는 몸이 판에 걸려 선다. 83°에서도 판이 방 안쪽으로 갈수록
 * 통로 쪽으로 기울어 문틀과 판 사이에 쐐기가 생겼고, 비스듬히 밀고 들어가는 몸이 거기 꼈다
 * (2026-09-28). 앞벽과 나란히 열어 두면 몸 중심이 지나는 통로가 z 5.08~5.62로 곧게 남는다.
 * 그래도 좁아서 손으로 미는 이동은 doorway-funnel.ts가 가운데로 당긴다.
 */
export const ROOM_DOOR_LEAF = {
  width: 1.45,
  height: 3.4,
  thickness: 0.12,
  hingeOffset: 0.73,
  openAngle: Math.PI / 2,
} as const;

/**
 * 열린 문짝의 발자국: 문이 열려 있을 때만 콜라이더에 든다 (Player). 없으면 문간을
 * 지나는 몸이 문짝을 뚫는다.
 *
 * 문은 y축 +90°로 서 있어(ROOM_DOOR_ROTATION) 문 로컬 x가 월드 -z다: 경첩은 문 중심에서
 * +z로 hingeOffset, 열린 판은 경첩에서 (sin a, -cos a) 방향으로 width만큼 뻗는다.
 * 살짝 기운 판이라 AABB 하나로 감싸면 판보다 두꺼운 벽이 된다. 판을 따라 상자 둘로 잇는다.
 */
function openDoorLeafColliders(): readonly Aabb2[] {
  const { width, thickness, hingeOffset, openAngle } = ROOM_DOOR_LEAF;
  const hinge = { x: ROOM_DOOR_POSITION[0], z: ROOM_DOOR_POSITION[2] + hingeOffset };
  const direction = { x: Math.sin(openAngle), z: -Math.cos(openAngle) };
  /** 판 두께의 절반에 판정 여유를 더한 값. */
  const pad = thickness / 2 + 0.02;
  const segments = 2;
  const boxes: Aabb2[] = [];
  for (let index = 0; index < segments; index += 1) {
    const from = (width * index) / segments;
    const to = (width * (index + 1)) / segments;
    const x0 = hinge.x + direction.x * from;
    const x1 = hinge.x + direction.x * to;
    const z0 = hinge.z + direction.z * from;
    const z1 = hinge.z + direction.z * to;
    boxes.push({
      minX: Math.min(x0, x1) - pad,
      maxX: Math.max(x0, x1) + pad,
      minZ: Math.min(z0, z1) - pad,
      maxZ: Math.max(z0, z1) + pad,
    });
  }
  return boxes;
}
export const OPEN_DOOR_LEAF_COLLIDERS = openDoorLeafColliders();

/*
 * ---------------------------------------------------------------- 거실 (v2)
 *
 * 방문(-x 벽) 너머의 두 번째 공간 (docs/content-design.md 3-1). 방과 벽 하나
 * (x = ROOM_SHELL_BOUNDS.minX)를 공유하고, 그 벽의 문이 둘을 잇는다.
 *
 * 깊이(z)로 두 구역이다. 앞쪽(+z)은 소파가 TV를 보는 거실, 뒤쪽(-z)은 ㄱ자 부엌과
 * 그 앞 식탁이다. 소파 등받이가 두 구역을 가른다. 부엌은 뒷벽의 -x 구석, 현관은 그 옆
 * 뒷벽의 +x 끝에서 바깥으로 파인 홈(LIVING_ENTRY_SHELL)이다. 엔딩은 거기서 난다.
 */
export const LIVING_SHELL_BOUNDS: Aabb2 = {
  minX: -16.5,
  maxX: ROOM_SHELL_BOUNDS.minX,
  // 냉장고 쪽으로 거실을 세 유닛 반 넓혀 문 없는 오픈 키친을 품는다.
  minZ: -7.5,
  maxZ: ROOM_SHELL_BOUNDS.maxZ,
};
/** 침실과 거실이 실제로 벽을 공유하는 구간의 뒷끝. 이보다 뒤는 확장된 부엌의 외벽이다. */
export const LIVING_SHARED_WALL_MIN_Z = ROOM_SHELL_BOUNDS.minZ;
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
 * 현관: 거실 뒷벽의 +x 구석에서 바깥(-z)으로 한 칸 들어간 홈.
 *
 * 거실이 반듯한 직사각형 하나면 집이 아니라 상자로 읽힌다. 실제 집의 평면은 현관·욕실·
 * 기둥이 파고들어 윤곽이 꺾인다. 그중 현관을 홈으로 판다: 뒷벽이 이 폭만큼 뚫려 있고, 그
 * 너머에 타일 바닥과 현관문이 있다. 문이나 문턱은 없다. 같은 거실의 한 구역이다
 * (SPACES.living.nooks).
 *
 * 홈이 +x 끝이어야 하는 이유: 카메라는 +x·+z에서 비스듬히 보므로, 홈 오른쪽에 거실 뒷벽이
 * 이어지면 그 벽 끝이 홈 안(현관문)을 가린다. +x 끝에 파면 그 자리는 걷히는 오른벽이라 홈이
 * 통째로 보인다. 홈의 -x 벽은 카메라를 마주 보고 신발장이 기댄다.
 */
export const LIVING_ENTRY_SHELL: Aabb2 = {
  minX: -10,
  maxX: LIVING_SHELL_BOUNDS.maxX,
  minZ: LIVING_SHELL_BOUNDS.minZ - 2,
  maxZ: LIVING_SHELL_BOUNDS.minZ,
};
/**
 * 현관의 걷는 범위. 벽 쪽 세 변은 거실과 같은 여유로 물리고, 열린 변(+z)은 거실 걷기
 * 범위 안으로 1만큼 겹쳐 둘을 잇는다. 플레이어 지름(0.76)보다 덜 겹치면 홈 입구에서 몸이
 * 어느 영역에도 못 들어가 끼인다 (DOORWAY_ZONE과 같은 이유).
 */
export const LIVING_ENTRY_BOUNDS: Aabb2 = {
  minX: LIVING_ENTRY_SHELL.minX + 0.45,
  maxX: LIVING_ENTRY_SHELL.maxX - 0.45,
  minZ: LIVING_ENTRY_SHELL.minZ + 0.45,
  maxZ: LIVING_BOUNDS.minZ + 1,
};

/**
 * 문간 판정 구간: 방과 거실을 잇는 세 번째 걷기 영역 (v2 기획 5장).
 *
 * 벽에 난 구멍이 아니라 두 공간의 걷기 범위를 겹쳐 잇는 다리다. x 양끝은 각
 * 공간의 걷기 범위와 **플레이어 지름(0.76) 이상** 겹쳐야 한다. 덜 겹치면 중심이
 * 어느 영역에도 못 들어가는 틈이 생겨 문턱에서 몸이 끼인다 (layout.test가 지킨다).
 * z 범위는 문 개구부(DOOR_OPENING_Z, 5.35±0.91) 안쪽: 몸 반지름을 더해도
 * 벽 단면을 스치지 않는 폭이다.
 */
export const DOORWAY_ZONE: Aabb2 = { minX: -7.4, maxX: -4.6, minZ: 4.7, maxZ: 6.0 };

/**
 * 거실 가구의 발자국 (v2 기획 7장). 배치 원칙 둘:
 * 문간(DOORWAY_ZONE)에서 나오는 길과 현관문 앞(FRONT_DOOR_INTERACTION 반경)은
 * 비워 둔다. 나오자마자 소파에 끼거나, 엔딩 문 앞에 가구가 서 있으면 안 된다.
 * layout.test가 이 둘을 지킨다.
 */
/**
 * 거실 가구 배율. 실측 비율로 짠 가구(소파 2.8m, 냉장고 1.8m)가 10.5m 거실에서는
 * 미니어처처럼 작아 보여 통째로 키운다. 배트(BAT_PLACEMENT)·문·TV는 제외
 * (TV는 1배가 소파와의 비율이 맞아 원래 크기로 둔다).
 *
 * 부품 좌표는 LivingRoomFurniture에 1배 기준으로 남겨 두고, 그리는 쪽이 가구마다
 * 정한 **바닥 기준점**(벽에 붙은 가구는 벽 면)을 축으로 키운다. 발자국·좌석·기억
 * 좌표도 같은 기준점으로 같은 식(scaleLivingPoint)을 태워야 셋이 어긋나지 않는다.
 */
export const LIVING_FURNITURE_SCALE = 1.3;

/**
 * 가구별 바닥 기준점 [x, z]. 벽에 붙은 가구는 벽 면이라 키워도 벽에서 안 뜬다.
 * 신발장은 현관문 쪽(+z) 끝을 잡는다. 가운데를 잡으면 커진 장이 문틀을 문다.
 */
export const LIVING_ANCHORS = {
  sofa: [-9.5, -4],
  dining: [-13.8, 3.8],
  shoeCabinet: [-16.5, 0.27],
  fridge: [-15.32, -4],
  piano: [-14.95, 6.5],
} as const satisfies Record<string, readonly [number, number]>;

/**
 * 냉장고가 서는 자리: 뒷벽의 -x 구석, ㄱ자 부엌의 왼쪽 끝. 1배 부품 좌표는 기존 anchor를
 * 유지한다. x는 키운 몸통(기준점에서 -0.69)이 -x 벽 안쪽 면(-16.41)에서 5cm 떨어지는 자리다.
 */
export const LIVING_FRIDGE_AT = [-15.67, LIVING_SHELL_BOUNDS.minZ] as const;

/**
 * ㄱ자 부엌 (living-kitchen.glb, scripts/create-living-kitchen.mjs).
 *
 * 냉장고 오른쪽에서 뒷벽을 따라 조리대가 달리다가, 끝에서 거실 쪽으로 꺾인 반도형 조리대가
 * 부엌을 닫는다. 반도의 끝이 식탁을 보고, 그 너머가 현관이다.
 *
 * `KITCHEN_ORIGIN`은 glb 바운딩 박스의 -x·-z 모서리(냉장고 쪽 끝, 뒷벽 안쪽 면)가 서는
 * 월드 자리다. glb는 바운딩 박스 중심이 원점이라(prepare-model 규약) 그리는 쪽은 거기에
 * 박스 반폭(1.97, 1.3)을 더한 자리에 놓는다. 발자국 둘은 스크립트의 RUN·RETURN 치수다.
 * 왼쪽 끝이 냉장고(x -14.98까지)에서 13cm 떨어진다.
 */
const KITCHEN_ORIGIN = [-14.85, LIVING_SHELL_BOUNDS.minZ + 0.09] as const;
export const LIVING_KITCHEN = {
  position: [KITCHEN_ORIGIN[0] + 1.97, 0, KITCHEN_ORIGIN[1] + 1.3] as Vec3Tuple,
  /** 뒷벽 조리대 (RUN 3.9, 상판 깊이 0.76) */
  run: {
    minX: KITCHEN_ORIGIN[0],
    maxX: KITCHEN_ORIGIN[0] + 3.94,
    minZ: LIVING_SHELL_BOUNDS.minZ,
    maxZ: KITCHEN_ORIGIN[1] + 0.76,
  },
  /** 반도형 조리대 (RETURN x 3.1~3.94, z ~2.6) */
  peninsula: {
    minX: KITCHEN_ORIGIN[0] + 3.1,
    maxX: KITCHEN_ORIGIN[0] + 3.94,
    minZ: KITCHEN_ORIGIN[1] + 0.76,
    maxZ: KITCHEN_ORIGIN[1] + 2.6,
  },
} as const satisfies { position: Vec3Tuple; run: Aabb2; peninsula: Aabb2 };

/**
 * 소파가 키운 뒤 서는 자리: 거실과 부엌의 **경계**. 등받이가 식탁을 등지고 앞벽의 TV를 본다.
 *
 * 원래는 뒷벽(z -4)에 붙어 있었는데, 오픈 키친으로 거실이 뒤로 늘어나자 방 한가운데에
 * 뜬 채 등을 부엌에 돌린 꼴이 됐다. 벽에 다시 붙이는 대신 칸막이로 쓴다: 앞은 쉬는 곳,
 * 뒤는 먹는 곳.
 *
 * x는 공유벽의 피아노(LIVING_PIANO_CENTER, x -7.76부터) 옆을 사람이 지날 수 있게 물린
 * 자리다. 소파 오른팔(-8.72)과 피아노 사이가 플레이어 지름(0.76)을 넘어, 방문에서 현관까지
 * 소파를 돌아가지 않고 오른쪽으로 곧장 걸어간다.
 *
 * z는 등받이(발자국 뒷면)와 식탁 사이가 두 걸음(1.86) 벌어지는 자리다. 처음에는 앞턱이 피아노
 * 발자국(z 1.26부터) 앞에서 끝나게 뒤로 물렸는데, 그러면 등받이 바로 뒤에 식탁 의자가 붙어
 * 두 구역이 한 덩어리로 읽혔다. 앞턱(z 1.94)이 피아노와 z로 반 걸음 겹치지만 사이 통로는
 * 위의 x 간격 그대로다. 식탁을 부엌 쪽으로 미는 길은 없다: 의자에 앉으러 서는 자리가 반도형
 * 조리대에 막힌다 (seat-route.test).
 */
export const LIVING_SOFA_AT = [-10.6, -0.4] as const;

/**
 * TV 받침장 세트(TV·화분·책·리모컨)를 1배 좌표에서 x로 옮기는 양. 소파가 경계로 옮겨 서며
 * 왼쪽으로 물린 만큼 따라가 정면을 맞춘다. 화장실 문틀(x -11.34까지)은 물지 않는다.
 */
export const LIVING_TV_OFFSET_X = -0.5;

/**
 * 신발장이 키운 뒤 서는 자리: 현관(LIVING_ENTRY_SHELL)의 -x 벽. 집에 들어서면 오른쪽이다.
 *
 * 기준점이 장의 +z 끝이고 몸통(상판)은 거기서 -z로 1.81 뻗는다. z는 그 -z 끝이 현관 뒷벽
 * 안쪽 면(-9.41)에 닿는 자리다. 장 길이를 홈 벽에 맞춰 두어 발자국까지 입구(-7.5) 안에 든다.
 */
export const LIVING_SHOE_CABINET_AT = [LIVING_ENTRY_SHELL.minX, -7.61] as const;

/**
 * 식탁 세트가 키운 뒤 서는 자리: **부엌 앞**.
 *
 * 원래는 소파 앞(-10, 2)이었다. 부엌이 생기면서 식탁이 TV 앞에 남아 있으면 밥은 거실
 * 끝에서 먹고 조리는 반대편 끝에서 하는 집이 된다. 조리대 앞으로 옮겨 부엌·식탁이 한 구역이
 * 된다.
 *
 * 조리대 앞면(z -6.65)과 식탁 발자국(z -5.45부터) 사이가 플레이어 지름(0.76)을 넘고,
 * 식탁 왼쪽(x -14.44부터)과 -x 벽 사이도 트여 있어 부엌 안쪽으로 걸어 들어간다. 빠진
 * 의자(도해 자리)는 부엌 쪽을 본다.
 */
export const LIVING_DINING_CENTER = [-13.2, -3.5] as const;

/**
 * 피아노가 옮겨 선 자리와 각도: **방문이 난 공유벽(+x)**.
 *
 * 원래는 앞벽(+z)의 -x 구석이었는데, 거기는 안방문(-x 벽 z 3.7)과 화장실문(+z 벽
 * x -12.25)이 만나는 모서리다. 문 둘 사이에 악기가 낀 평면이라 어느 쪽 문도 제 벽을
 * 못 가졌다. 공유벽은 굽도리와 방문뿐이라 2m 넘게 비어 있는 유일한 벽이다.
 *
 * 부품 좌표(PianoCabinet)는 1배 그대로 두고 y로 +90° 돌려 세운다: 뒷면이 공유벽을 보고
 * 건반이 거실(-x)을 본다. 문간(DOORWAY_ZONE z 4.7~6.0)에서 1.3m 남긴 자리다.
 */
export const LIVING_PIANO_CENTER = [LIVING_SHELL_BOUNDS.maxX, 2.3] as const;

/**
 * 피아노 앞에 서는 자리. 본체를 눌러 멜로디 문제를 여는 반경이다 (PianoBody).
 *
 * x는 피아노 발자국(-7.75)과 식탁 발자국(-8.76) 사이의 빈 바닥 한가운데다. 양쪽에서
 * 0.5씩 떨어져 있어 사람(반지름 0.38)이 끼지 않는다.
 */
export const PIANO_STAND = { x: -8.3, z: 2.3, radius: 1.8 } as const;
export const LIVING_PIANO_ROTATION = Math.PI / 2;

/**
 * 기준점을 축으로 1배 좌표를 키운 값. `at`을 주면 키운 가구를 그 자리로 옮기고,
 * `rotationY`를 주면 그 자리에서 y축으로 돌린다 (피아노). 도는 차례는 그리는 쪽
 * (LivingPiece)과 같다: 1배 좌표를 기준점 원점으로 끌어와 → 키우고 → 돌리고 → `at`에 놓는다.
 * three의 y회전과 같은 식이라 부품·발자국·좌석이 한 값에서 같이 나온다.
 */
export function scaleLivingPoint(
  anchor: readonly [number, number],
  x: number,
  z: number,
  at: readonly [number, number] = anchor,
  rotationY = 0,
): [number, number] {
  const dx = (x - anchor[0]) * LIVING_FURNITURE_SCALE;
  const dz = (z - anchor[1]) * LIVING_FURNITURE_SCALE;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return [at[0] + dx * cos + dz * sin, at[1] - dx * sin + dz * cos];
}

/** 높이는 바닥(y=0)을 축으로 키운다. */
export function scaleLivingHeight(y: number): number {
  return y * LIVING_FURNITURE_SCALE;
}

/**
 * 발자국도 부품과 같은 식을 탄다. 돌린 가구는 두 모서리만 옮겨서는 상자가 뒤집히므로
 * 네 모서리를 다 옮기고 외접 상자를 잡는다 (직각이면 원래 상자 그대로다).
 */
function scaleLivingAabb(
  anchor: readonly [number, number],
  box: Aabb2,
  at: readonly [number, number] = anchor,
  rotationY = 0,
): Aabb2 {
  const corners = [
    scaleLivingPoint(anchor, box.minX, box.minZ, at, rotationY),
    scaleLivingPoint(anchor, box.maxX, box.minZ, at, rotationY),
    scaleLivingPoint(anchor, box.minX, box.maxZ, at, rotationY),
    scaleLivingPoint(anchor, box.maxX, box.maxZ, at, rotationY),
  ];
  const xs = corners.map(([x]) => x);
  const zs = corners.map(([, z]) => z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

/** 식탁 세트 안의 1배 자리를 키운 세트의 자리로. */
function diningSpot(x: number, z: number): Vec3Tuple {
  const [sx, sz] = scaleLivingPoint(LIVING_ANCHORS.dining, x, z, LIVING_DINING_CENTER);
  return [sx, 0, sz];
}

/** 식탁 의자 셋의 자리. 둘은 제자리, 하나(도해 자리)는 빠져 나와 비스듬하다. */
export const LIVING_DINING_CHAIRS = [
  { seat: "dining-window", position: diningSpot(-14.5, 3.8), rotationY: Math.PI / 2 },
  { seat: "dining-door", position: diningSpot(-13.1, 3.8), rotationY: -Math.PI / 2 },
  { seat: "dining-pulled", position: diningSpot(-13.4, 2.62), rotationY: Math.PI + 0.5 },
] as const satisfies readonly { seat: SeatId; position: Vec3Tuple; rotationY: number }[];

/** 발자국은 1배 값을 적고 가구와 같은 기준점으로 키운다. 인형만 키운 소파 옆으로 손수 옮겼다. */
export const LIVING_COLLIDERS = [
  scaleLivingAabb(
    LIVING_ANCHORS.sofa,
    { minX: -10.95, maxX: -8.05, minZ: -4, maxZ: -2.2 },
    LIVING_SOFA_AT,
  ), // sofa (거실·부엌 경계)
  {
    minX: -10.75 + LIVING_TV_OFFSET_X,
    maxX: -8.25 + LIVING_TV_OFFSET_X,
    minZ: 5.9,
    maxZ: 6.5,
  }, // tv stand (1배 그대로, 소파 정면으로 옮김)
  scaleLivingAabb(
    LIVING_ANCHORS.dining,
    { minX: -14.75, maxX: -12.85, minZ: 2.3, maxZ: 4.75 },
    LIVING_DINING_CENTER,
  ), // dining table + chairs (빠진 의자 포함)
  scaleLivingAabb(
    LIVING_ANCHORS.shoeCabinet,
    { minX: -16.5, maxX: -15.85, minZ: -1.16, maxZ: 0.35 },
    LIVING_SHOE_CABINET_AT,
  ), // shoe cabinet (현관 홈의 -x 벽)
  scaleLivingAabb(
    LIVING_ANCHORS.fridge,
    { minX: -15.85, maxX: -14.8, minZ: -4, maxZ: -3.2 },
    LIVING_FRIDGE_AT,
  ), // fridge (뒷벽 -x 구석)
  LIVING_KITCHEN.run, // 뒷벽 조리대: 싱크·레인지
  LIVING_KITCHEN.peninsula, // 반도형 조리대
  scaleLivingAabb(
    LIVING_ANCHORS.piano,
    { minX: -15.75, maxX: -14.15, minZ: 5.15, maxZ: 6.5 },
    LIVING_PIANO_CENTER,
    LIVING_PIANO_ROTATION,
  ), // piano + 반쯤 빼놓은 의자 (공유벽으로 옮겨 90° 섰다)
  { minX: -16.3, maxX: -14.7, minZ: -0.6, maxZ: 1.0 }, // plush doll (-x 벽, 안방문 오른편)
] as const satisfies readonly Aabb2[];

/**
 * 현관문: 현관 홈(LIVING_ENTRY_SHELL)의 뒷벽. 배트가 방문을 열게 되면서 엔딩 트리거가
 * 여기로 왔다 (docs/content-design.md 3-2). 문이 벽 안쪽(+z)을 보고, 밖은 -z다.
 *
 * 원래는 -x 벽의 냉장고 옆이었다. 그 벽은 안방문과 나란히 서서 현관이 옆방 문처럼
 * 읽혔고, 뒤로 늘어난 거실에서는 방 한가운데 옆구리로 열렸다. 뒷벽 쪽은 카메라를 마주
 * 보는 면이라 거실 어디서든 현관이 정면에 보인다. 문틀(±0.91) 왼쪽은 신발장(앞면
 * x -9.15), 오른쪽은 배트가 기대는 틈과 +x 벽(-6.09)이다.
 */
export const FRONT_DOOR_POSITION = [-7.9, 1.7, LIVING_ENTRY_SHELL.minZ + 0.14] as const;
export const FRONT_DOOR_ROTATION = [0, 0, 0] as const;
/** 현관문에서 거실 안쪽을 가리키는 단위 벡터 [x, z]. 엔딩의 문턱 넘기가 이 축을 따라 걷는다. */
export const FRONT_DOOR_INWARD = [0, 1] as const;
export const FRONT_DOOR_INTERACTION = {
  near: [FRONT_DOOR_POSITION[0], FRONT_DOOR_POSITION[2]] as readonly [number, number],
  interactionRadius: 2.2,
} as const;
export const DESK_POSITION = [-4.6, 0, -1.2] as const;
export const DESK_ROTATION = [0, Math.PI / 2, 0] as const;
// 책상이 커지면서 다리가 x=-4.0까지 나온다. 의자를 그만큼 안쪽으로 물린다.
export const CHAIR_POSITION = [-3.3, 0, -1.2] as const;
export const CHAIR_ROTATION = [0, Math.PI / 2, 0] as const;

/**
 * 책상 의자의 좌면. 의자를 그리는 쪽(RoomFurniture), 앉는 자리(seats), 발자국(아래
 * ROOM_COLLIDERS)이 같은 수를 봐야 해서 여기 둔다.
 *
 * 원래 1.05×1.05에 높이 0.75였는데, 그 위에 앉히면 캐릭터가 좌면 앞턱에 걸터앉는
 * 그림밖에 안 나왔다. 이 리그는 엉덩이에서 무릎까지가 0.27뿐이라 좌면 절반도 못
 * 채운다. 앉은 몸에 맞춰 줄였다: 이제 엉덩이가 좌면 가운데 언저리에 온다.
 */
export const CHAIR_SEAT = { half: 0.43, topY: 0.68, thickness: 0.14 } as const;

/**
 * 의자를 책상에서 끌어낸 양. 책상은 의자의 -x 쪽에 있으므로 +x로 물러난다.
 *
 * 거리를 크게 잡지 않는 이유: ROOM_COLLIDERS의 의자 박스는 고정이라 의자만 움직이면
 * 충돌 판정이 제자리에 남는다. 밀려난 좌석 끝(중심 +거리 +반폭 0.525)이 플레이어가
 * 설 수 있는 가장 안쪽 선(콜라이더 maxX -2.82 + 반지름 0.38 = -2.44)을 넘지 않아야
 * 의자를 뚫고 지나가는 장면이 안 나온다. 그 한계가 0.335이고, layout.test가 지킨다.
 */
export const CHAIR_PULL = { distance: 0.33, turn: 0.12 } as const;

/**
 * 서랍이 밀려 나오는 거리. 둘 다 몸통 앞면이 +z를 보고 있어 +z로 나온다.
 * 콜라이더가 몸통보다 조금 앞까지 잡혀 있어(캐비닛 0.28, 협탁 0.04) 그 여유 안에서 멈춘다.
 */
export const DRAWER_TRAVEL = { cabinet: 0.34, nightstand: 0.24 } as const;

/**
 * 캐비닛 몸통. 액자·스마트폰이 놓이는 면이라 RoomFurniture와 MEMORY_PLACEMENTS가
 * 같은 수치를 봐야 한다. 따로 들고 있다가 어긋나면 오브젝트가 상판을 뚫거나
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

/**
 * 커튼을 잡으면 몸이 가서 서는 자리: 창 한가운데(x는 window 기억과 같다), 캐비닛
 * 바로 앞. 벽(-z)을 보고 서서 캐비닛 너머로 팔을 뻗는다. z는 캐비닛 발자국(maxZ -2.25)에
 * 플레이어 반지름(0.38)과 여유를 더한 값이다.
 */
export const CURTAIN_STAND = { x: 1.15, z: -1.8, facing: Math.PI } as const;

/** 뒷벽 빈자리의 책장. GLB 실측 1.6 × 2.35 × 0.72, 바닥 원점. */
export const STUDENT_BOOKSHELF = {
  position: [6.4, 0, -3.42] as Vec3Tuple,
  size: [1.6, 2.35, 0.72] as Vec3Tuple,
} as const;
const [bookcaseX, , bookcaseZ] = STUDENT_BOOKSHELF.position;
export const STUDENT_BOOKSHELF_COLLIDER: Aabb2 = {
  minX: bookcaseX - STUDENT_BOOKSHELF.size[0] / 2,
  maxX: bookcaseX + STUDENT_BOOKSHELF.size[0] / 2,
  minZ: bookcaseZ - STUDENT_BOOKSHELF.size[2] / 2,
  maxZ: bookcaseZ + STUDENT_BOOKSHELF.size[2] / 2,
};

export const ROOM_COLLIDERS = [
  { minX: -5.48, maxX: -3.72, minZ: -3.35, maxZ: 0.95 }, // desk
  BED_COLLIDER, // 침대: 발자국은 bed.ts가 glb 실측에서 낸다
  { minX: 0.15, maxX: 4.7, minZ: -3.35, maxZ: -2.25 }, // cabinet
  { minX: 6.3, maxX: 7.25, minZ: 0.3, maxZ: 1.2 }, // nightstand
  // 의자: CHAIR_POSITION의 좌석/등받이 발자국(±CHAIR_SEAT.half)에서 살짝 안쪽으로 잡는다
  { minX: -3.685, maxX: -2.915, minZ: -1.585, maxZ: -0.815 }, // chair
  STUDENT_BOOKSHELF_COLLIDER,
] as const satisfies readonly Aabb2[];

/**
 * 현관문 옆에 세워둔 배트. 수집 대상이 아니라 2막을 다 돌면(앰플) 켜지는 3막
 * 트리거라 MEMORY_PLACEMENTS와 따로 둔다 (docs/content-design.md 3-2).
 *
 * 방문 옆이 아니라 여기 서 있는 이유: 3막이 현관에서 나기 때문이다. 방에 두면
 * 마지막 장면을 위해 방까지 되돌아가야 하고, "현관에서 배트와 앰플을 쥐고 문을
 * 연다"는 그림이 흩어진다. 흙 묻은 야구 장비를 현관에 세워 두는 건 생활에서도
 * 자연스럽다.
 */
export const BAT_PLACEMENT = {
  // 현관문 +x 옆, 문틀과 +x 벽 사이. 문짝이 열리는 자리(문 중심 ±0.82)는 비운다.
  // y로 -90° 돌려 기울기가 현관 뒷벽(-z) 쪽을 향한다
  position: [-6.55, 1.48, -8.95],
  rotation: [0, -Math.PI / 2, Math.PI - 0.22],
  scale: 1.6,
  interactionRadius: 1.35,
} as const satisfies Omit<MemoryPlacement, "id">;

/**
 * 문 쪽 왼벽에 붙은 조명 스위치. 기억도 트리거도 아닌 배경 오브젝트다.
 * 진행에는 아무 영향이 없고 방의 불만 끄고 켠다 (docs/content-design.md 6-3).
 *
 * 좌표는 RoomDecor가 장식으로 그리던 자리를 그대로 물려받았다 (왼벽 안쪽 면
 * x=-5.91 + 판 두께의 절반). 장식과 실물을 둘 다 두면 스위치가 두 개로 보인다.
 */
export const LIGHT_SWITCH_PLACEMENT = {
  position: [-5.885, 1.72, 4.15],
  rotation: [0, Math.PI / 2, 0],
  /** 판/토글 크기도 장식이 쓰던 값 그대로: [폭(z), 높이(y), 두께(x)]. */
  plateSize: [0.2, 0.3, 0.05],
  rockerSize: [0.1, 0.14, 0.03],
  /** 판 아래쪽의 표시등. 불이 꺼져 있을 때 켜진다 (인트로에서 스위치를 찾는 단서). */
  pilotSize: [0.03, 0.012, 0.008],
  /**
   * 다가가면 빛나기 시작하는 거리. 표식이 없는 물건이라 이 반경이 곧 "여기 뭔가
   * 있다"는 유일한 신호다. 옆에 선 배트(1.35)와 같이 잡아 둘이 함께 켜지게 한다.
   */
  interactionRadius: 1.35,
} as const;

/**
 * 문 쪽 왼벽의 전신거울: 스위치와 달력 사이. 기억도 트리거도 아닌 배경 오브젝트다. 누르면 거울 모달이 뜨고 거기서 캐릭터 모델을 돌려본다
 * (ClueOverlay의 mirror). 수첩에 있던 3D 뷰어가 방 안 물건으로 옮겨온 자리다.
 *
 * **바닥에 세워 벽에 기대 놓는다** (2026-09-16). 전에는 액자처럼 벽에 걸려 있었는데,
 * 전신거울이 허공에 떠 있는 꼴이라 어색했다. `position`은 이제 거울이 선 자리, 즉
 * 밑동의 좌표다(y=0, 바닥). 거기서 `lean`만큼 뒤로 누워 윗변이 벽에 닿는다.
 *
 * x는 밑동이 벽 안쪽 면(-5.91)에서 0.19만큼 나온 자리다. 그만큼 나와 있어야 기울인
 * 윗변이 벽을 뚫지 않는다 (높이 1.74 × sin(lean) ≈ 0.16). 걷기 범위는 x=-5.55에서
 * 멈추므로(ROOM_BOUNDS) 밑동은 사람이 밟는 바닥 바깥이다.
 *
 * z는 달력(0.9)과 바닥의 야구공(3.75) 사이의 빈 벽 한가운데다.
 */
export const MIRROR_PLACEMENT = {
  /** 거울이 선 자리 (밑동). y는 바닥이다. */
  position: [-5.72, 0, 2.65],
  rotation: [0, Math.PI / 2, 0],
  /** 벽에 기댄 각(rad). 밑동을 축으로 윗변이 벽 쪽으로 눕는다. */
  lean: 0.09,
  /** 틀 [폭(z), 높이(y), 두께(x)]와 그 안의 유리. */
  frameSize: [0.62, 1.74, 0.07],
  glassSize: [0.52, 1.6, 0.014],
  near: [-5.25, 2.65] as readonly [number, number],
  interactionRadius: 1.6,
} as const;

/*
 * 컴퓨터 비밀번호 단서를 든 배경 오브젝트.
 *
 * 기억이 아니라 방의 소품이라 MEMORY_PLACEMENTS와 따로 둔다. 수집 카운터에도
 * 해금 규칙에도 끼지 않고, 만져도 진행에는 아무 일이 없다 (전등 스위치와 같은
 * 성격). 무엇이 적혀 있는지는 src/data/room-clues.ts에 있다.
 */

/**
 * 협탁 서랍 속 접힌 쪽지. 서랍 부품과 같은 월드 프레임(닫힌 상태)이고, 서랍
 * 그룹이 통째로 +z로 밀려 나갈 때 같이 나온다.
 *
 * y는 서랍판 윗변(0.86)보다 높고 협탁 몸통 윗면(0.955)보다 낮다. 닫혀 있으면
 * 몸통 안에 잠겨 안 보이고, 열리면 서랍판 너머로 위에서 내려다보인다.
 */
export const DRAWER_NOTE = {
  position: [6.8, 0.89, 1.05] as Vec3Tuple,
  /**
   * 아무렇게나 던져둔 각도. 크게 틀면 돌아간 만큼 z로 두꺼워져서, 서랍이 다 나와도
   * (0.24) 몸통 앞을 못 벗어난다. layout.test가 그 여유를 지킨다.
   */
  rotation: [0, 0.12, 0] as EulerTuple,
  /** [가로, 두께, 세로]. 서랍 안쪽 폭(0.72)에 한참 못 미쳐야 쪽지로 읽힌다. */
  size: [0.26, 0.012, 0.14] as Vec3Tuple,
  near: [6.8, 1.16] as readonly [number, number],
  interactionRadius: 2.1,
} as const;

/**
 * 들여다볼 수 있는 곁가지 물건들의 다가감 판정. 3D는 각자 제 자리(RoomDecor·
 * RoomFurniture)에서 그리고, 여기엔 기준점과 반경만 모은다. 서랍 속 쪽지와 달리
 * 이 둘은 원래 있던 장식을 그대로 쓰므로 좌표를 새로 잡을 게 없다.
 */
export const CLUE_PROPS = {
  /** 뒷벽 선반에 꽂힌 책들 중 한 권 (RoomDecor의 SHELF_BOOKS). */
  shelfBook: { near: [4.86, -3.66] as readonly [number, number], interactionRadius: 2.2 },
  /** 캐비닛 상판의 탁상시계 (RoomFurniture의 DeskClock). 단서가 아니라 누르면 한 줄 흘리는 물건이다. */
  deskClock: {
    near: [CABINET_TOP_PROPS.clock.x, -2.82] as readonly [number, number],
    interactionRadius: 2.1,
  },
  /**
   * 책상 램프 아래 문제집 더미 (StudentProps의 StudentDeskProps). 좌표는 책상 로컬
   * [1.25, 1.11, 0.32]를 DESK_POSITION·DESK_ROTATION(y 90°)으로 돌려 월드에 놓은 값.
   */
  workbook: { near: [-4.28, -2.45] as readonly [number, number], interactionRadius: 2.1 },
} as const;

/** 소파 앞 책가방의 배율. 가구(1.3)보다 크게 잡아야 바닥에서 눈에 든다. */
const BACKPACK_SCALE = 1.6;
/** 책가방 몸통 두께(0.2)의 절반. */
const BACKPACK_HALF_THICKNESS = 0.1;

/** 거실 가구 위에 얹는 기억의 자리: 1배 좌표를 가구와 같은 기준점으로 키운다. */
function livingSpot(
  anchor: readonly [number, number],
  x: number,
  y: number,
  z: number,
  at: readonly [number, number] = anchor,
): Vec3Tuple {
  const [sx, sz] = scaleLivingPoint(anchor, x, z, at);
  return [sx, scaleLivingHeight(y), sz];
}

export const MEMORY_PLACEMENTS = {
  /*
   * 라디오 뒤(벽 쪽, -x) 책상 끝자락에 놓인 성적표 한 장. 예전에는 의자와 문제집 더미
   * 사이(z -1.95)였는데, 더미의 종이 뭉치(z -2.1~-3.0)와 화면에서 포개졌다. 모니터(z -0.37까지)와
   * 라디오(x -4.14~-3.96) 어느 쪽에도 닿지 않는 자리다. 플레이어는 라디오 앞 통로에서 닿는다.
   * y는 책상 상판 윗면(1.11)에서 살짝 띄운 값: 딱 맞추면 종이 밑면이 상판과 겹쳐 깜빡인다.
   * glb(ch1-report-card)는 밑면이 원점이라 그대로 얹힌다.
   */
  "report-card": {
    id: "report-card",
    position: [-4.75, 1.112, 0.35],
    rotation: [0, 0.35, 0],
    scale: 1,
    interactionRadius: 1.4,
    // 종이(0.30×0.42) 모양의 납작한 상자. 사방으로 조금 넉넉히 잡아 누르기 쉽게 하되,
    // 구처럼 솟아 앞의 라디오를 덮지 않는다 (types.ts의 hitBox)
    hitBox: [0.38, 0.05, 0.5],
  },
  console: {
    id: "console",
    // 러그 위에 던져둔 게임패드. 사방이 트여 있어 다가가기 쉽다.
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
    // 아랫변이 살짝 파고들도록 y를 잡는다. 딱 맞추면 면이 겹쳐 깜빡인다.
    position: [1.42, 1.355, -2.85],
    rotation: [0, -0.3, 0],
    scale: 1,
    interactionRadius: 1.05,
  },
  computer: {
    id: "computer",
    /*
     * 책상 위 컴퓨터 세트(모니터·키보드·마우스). 예전 DeskAccessories가 그리던
     * 월드 좌표를 그대로 물려받되, 앵커는 세트의 무게중심쯤(키보드 언저리)에 둔다.
     * 모니터에 앵커를 두면 책상 안쪽이라 상호작용 반경이 통로까지 안 닿는다.
     * 부품별 오프셋은 MemoryObjects의 ComputerMemory가 이 앵커 기준으로 갖고 있다.
     *
     * 반경 1.5: 의자 콜라이더(z -1.68~-0.72)가 정면을 막아서, 플레이어는 의자
     * 옆(z≈-0.34 또는 z≈-2.06)의 통로에서 닿는다. 그 거리가 약 1.33이다.
     * 클릭 구(hitRadius)는 세트(모니터·키보드·마우스)만 덮는 0.9로 둔다. 1.5면 책상
     * 의자까지 덮어, 컴퓨터가 잠긴 1바퀴 내내 의자를 눌러도 앉지 못한다.
     */
    position: [-4.5, 1.11, -1.0],
    rotation: [0, Math.PI / 2, 0],
    scale: 1,
    interactionRadius: 1.5,
    hitRadius: 0.9,
  },
  radio: {
    id: "radio",
    // y는 책상 상판 윗면(1.11): 라디오 로컬 원점이 밑면이라 그대로 얹힌다.
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
     * 침대 발치에 던져둔 폰. 이불 위에 놓인다. 이불 윗면은 y=0.847(bed.ts의
     * BED_BLANKET_TOP_Y)이고, 눕히면 두께의 절반(0.04)만큼 떠야 하므로 원점은 0.885다.
     * 발치 끝 자락은 이불이 접혀도(BED_BLANKET_FOLDED_Z.max 너머) 같은 두께로 평평해서
     * 폰이 뭉치에 파묻히지도, 허공에 뜨지도 않는다.
     *
     * x는 매트리스 가운데(4.65) 쪽으로 붙인다. 변에 두면 이불 자락에 묻혀 잘 안 보였다.
     * 침대는 통째로 콜라이더라 위로 올라갈 수 없으므로, 옆(x≈3.0)과 발치(z≈5.1)에서
     * 닿도록 상호작용 반경을 1.6으로 넓혔다. 클릭 구(hitRadius)는 그만큼 넓히지 않는다.
     * 기억 오브젝트는 보이지 않는 구로 클릭을 받는데(MemoryObjects의 memory-hit), 1.6이면
     * 매트리스 발치 절반을 덮어 침대를 눌러도 폰이 눌리고, 폰이 잠긴 동안은 그 클릭이
     * 그냥 사라져 눕지도 못한다. 폰 자체보다 조금 큰 0.55면 손으로 짚기에 충분하다.
     *
     * 회전의 X는 -π/2 + 0.18: 뒤쪽 0.18은 PhoneMemory가 세워 든 자세로 갖고 있는
     * 기울기를 상쇄하는 몫이라, 합치면 정확히 화면이 천장을 보고 눕는다. glb(ch1-smartphone)는
     * MemoryObjects의 MODEL_POSE가 같은 기울기와 두께 차이를 맞춘다.
     */
    position: [4.3, 0.885, 3.9],
    rotation: [-Math.PI / 2 + 0.18, 0, 0.42],
    // 손에 쥐는 물건 치고 너무 컸다. 게임기(가로 0.46)보다 작아야 폰으로 읽힌다
    scale: 0.5,
    interactionRadius: 1.6,
    hitRadius: 0.55,
  },
  calendar: {
    id: "calendar",
    /*
     * z는 포스터(z 1.21~2.23)를 비켜선 자리다. 벽에 걸린 판이 둘이라 서로 물리면
     * 한 장이 다른 장을 파고든 것처럼 보인다. 판 폭이 0.82라 이 중심에서
     * 0.21~1.03을 차지하고, 포스터와 0.18만큼 떨어진다.
     */
    position: [-5.88, 2.55, 0.62],
    rotation: [0, Math.PI / 2, 0],
    scale: 1,
    interactionRadius: 1.25,
  },
  ball: {
    id: "ball",
    // glb는 반지름 1 구: scale이 곧 반지름이라 y도 같은 값이어야 바닥에 닿는다
    position: [-5.1, 0.19, 3.75],
    rotation: [0, 0, 0],
    scale: 0.19,
    interactionRadius: 1.05,
  },

  /*
   * ── 거실의 기억 (2막) ──────────────────────────────────────────
   *
   * 넷은 이미 서 있는 가구 위에 얹힌다 (냉장고 문·아래칸, 신발장 문, 식탁 트럼프).
   * 가구를 복제하지 않고 **만지는 면만** 얇은 판으로 덮어 아웃라인이 붙을 형태를
   * 준다. 판의 색은 밑에 깔린 가구와 같아서 눈에는 안 보이고, 빛날 때만 그 면이
   * 드러난다 (MemoryObjects의 FridgeDoor·CabinetDoor).
   *
   * 좌표는 LivingRoomFurniture의 부품에서 파생된다. 1배 값을 적고 가구와 같은
   * 기준점(LIVING_ANCHORS)으로 키운다. 거기 가구를 옮기면 여기도 같이 옮겨야 한다.
   */
  fridge: {
    id: "fridge",
    // 냉장고 문 앞면(z -3.24)에서 5mm 앞. 냉동칸 경계(y 1.45) 아래 = 냉장실 문
    position: livingSpot(LIVING_ANCHORS.fridge, -15.32, 1.07, -3.235, LIVING_FRIDGE_AT),
    rotation: [0, 0, 0],
    scale: LIVING_FURNITURE_SCALE,
    interactionRadius: 1.5,
  },
  duffel: {
    id: "duffel",
    // 소파 앞 바닥에 던져둔 책가방. 사방이 트여 있어 다가가기 쉽다. 키운 소파의
    // 발자국 앞면(소파 자리에서 +2.34)에서 한 걸음 앞: 붙이면 클릭 구가 가운데 쿠션의 앉는 자리를 문다.
    // 가구 배율보다 더 키운다: 바닥에 홀로 놓인 물건이라 같은 배율로는 작아 보인다.
    // 몸통 두께의 절반만큼 띄워 바닥에 얹는다.
    // 클릭 구는 가방(길이 1.0)만 덮는 0.8: 더 크면 소파 쿠션의 앉는 자리까지 덮어 앉지 못한다
    position: [
      LIVING_SOFA_AT[0],
      BACKPACK_HALF_THICKNESS * BACKPACK_SCALE + 0.01,
      LIVING_SOFA_AT[1] + 2.85,
    ],
    rotation: [0, 0.42, 0],
    scale: BACKPACK_SCALE,
    interactionRadius: 1.3,
    hitRadius: 0.8,
  },
  shoes: {
    id: "shoes",
    // 신발장 문 앞면(x -15.91)에서 5mm 앞
    position: livingSpot(LIVING_ANCHORS.shoeCabinet, -15.905, 0.55, -0.41, LIVING_SHOE_CABINET_AT),
    rotation: [0, Math.PI / 2, 0],
    scale: LIVING_FURNITURE_SCALE,
    interactionRadius: 1.45,
  },
  cards: {
    id: "cards",
    // 식탁 상판 윗면(0.975) 위의 쪽지. 상판 중심과 같은 자리다.
    // 클릭 구는 상판 가운데만 덮는 0.6: 1.9면 양끝 의자까지 덮어 앉으려는 클릭이 쪽지로 간다
    position: [LIVING_DINING_CENTER[0], scaleLivingHeight(0.975), LIVING_DINING_CENTER[1]],
    rotation: [0, 0, 0],
    scale: LIVING_FURNITURE_SCALE,
    interactionRadius: 1.9,
    hitRadius: 0.6,
  },
  ampoule: {
    id: "ampoule",
    // 냉장고 아래칸. "손대지 마"라던 그 칸이다. 냉장실 문 테두리(y 0.72~1.42) 아래
    position: livingSpot(LIVING_ANCHORS.fridge, -15.32, 0.43, -3.235, LIVING_FRIDGE_AT),
    rotation: [0, 0, 0],
    scale: LIVING_FURNITURE_SCALE,
    interactionRadius: 1.5,
  },

  /*
   * ── 안방의 기억 (4페이즈) ──────────────────────────────────────
   *
   * 책상(PARENTS_COLLIDERS의 desk: x -19.6~-17.4, z 5.7~6.5, 상판 윗면 1.13) 위에
   * 서류 뭉치와 출입증, 침대 발치에 소집 공지 봉투. 책상 좌표는 PARENTS_COLLIDERS가
   * 아래에 선언돼 있어 숫자로 옮겨 적는다 (layout.test가 두 값의 짝을 지킨다).
   * 플레이어는 책상 앞 통로(z ≈ 5.1)에서 닿는다.
   */
  "research-note": {
    id: "research-note",
    // 예전 단서(ClueOverlay의 research-note) 서류 뭉치 자리 그대로
    position: [-18.94, 1.13, 6.06],
    rotation: [0, 0.08, 0],
    scale: 1,
    interactionRadius: 1.8,
    hitRadius: 0.45,
  },
  "id-card": {
    id: "id-card",
    // 악보 조각(-18.28) 오른쪽, 책상 끝
    position: [-17.78, 1.13, 6.1],
    rotation: [0, -0.35, 0],
    scale: 1,
    interactionRadius: 1.8,
    hitRadius: 0.32,
  },
} as const satisfies Record<MemoryId, MemoryPlacement>;

/**
 * 기억이 어느 공간에 서 있는가. 한 번에 한 방만 보이므로(MemoryRoomScene) 씬이
 * 이 표를 보고 갈라 그린다. 거실 물건이 방 안에 같이 렌더되면 벽 너머에 떠 있는
 * 유령이 된다.
 */
/**
 * 클릭을 받는 자리가 바닥에서 닿는 가장 먼 거리. 따로 정하지 않은 물건은 상호작용
 * 반경 그대로다. 상자(hitBox)면 바닥 평면 대각선의 절반: 어느 쪽으로 돌려 놓아도 그 안이다.
 */
export function hitRadiusOf(placement: MemoryPlacement): number {
  if (placement.hitBox) return Math.hypot(placement.hitBox[0], placement.hitBox[2]) / 2;
  return placement.hitRadius ?? placement.interactionRadius;
}

export const MEMORY_SPACE = {
  "report-card": "room",
  console: "room",
  window: "room",
  frame: "room",
  fridge: "living",
  duffel: "living",
  computer: "room",
  radio: "room",
  phone: "room",
  calendar: "room",
  ball: "room",
  shoes: "living",
  cards: "living",
  ampoule: "living",
  "research-note": "parents",
  "id-card": "parents",
} as const satisfies Record<MemoryId, "room" | "living" | "parents">;

export type MemorySpace = (typeof MEMORY_SPACE)[MemoryId];

export const CAMERA_PRESETS = {
  // room.target.y를 올리면 시선 중심이 위로 가면서 방이 화면 아래쪽으로 내려온다
  room: { position: [14.2, 10.4, 15.4], target: [0.8, 2.35, 1.2] },
  /** 엔딩: 거실 끝 현관문을 열 때 (v2에서 배트 → 현관문으로 옮겨왔다). */
  ending: { position: [-6.0, 3.1, -5.9], target: [-7.9, 0.9, -9.2] },
  // 라디오와 같은 통로(+x·+z)에서 라디오 너머의 성적표를 비스듬히 내려다본다.
  // 예전 자리(z -1.95)에서 옮긴 만큼 카메라도 같이 밀었다
  "report-card": { position: [-1.63, 2.9, 2.7], target: [-4.75, 1.1, 0.35] },
  console: { position: [4.4, 2.4, 6.9], target: [1.05, 0.35, 4.05] },
  window: { position: [4.7, 4.2, 2.1], target: [1.15, 2.4, -3.7] },
  frame: { position: [4.05, 2.6, 0.75], target: [1.42, 1.4, -2.7] },
  radio: { position: [-1.1, 2.5, 2.1], target: [-4.05, 1.31, 0.1] },
  // 라디오와 같은 통로에서 책상 안쪽(모니터)을 비스듬히 본다
  computer: { position: [-0.9, 2.7, 1.1], target: [-4.6, 1.5, -0.95] },
  phone: { position: [6.75, 2.65, 6.25], target: [4.3, 0.95, 3.6] },
  // 달력이 z로 옮겨간 만큼 카메라도 같이 옮긴다. 둘을 같은 값만큼 밀어야 보는 각이 그대로다
  calendar: { position: [-1.1, 3.6, 2.92], target: [-5.75, 2.5, 0.62] },
  ball: { position: [-1.4, 2.1, 6.6], target: [-5.1, 0.19, 3.75] },
  /*
   * 거실 물건들. 방과 같은 방향(+x·+z)에서 본다. 공간이 바뀔 때 카메라가 반대편으로
   * 돌아가면 "옆 방으로 걸어갔다"가 아니라 "다른 씬으로 잘렸다"로 읽힌다.
   */
  // 거실 기억의 시선은 키운 가구의 자리(MEMORY_PLACEMENTS)를 본다
  fridge: { position: [-13.05, 3.2, -3.8], target: [-15.67, 1.5, -6.5] },
  duffel: { position: [-8.0, 2.2, 4.15], target: [-10.6, 0.35, 1.6] },
  // 카메라가 +x 벽(-6) 밖에 서야 그 벽이 걷힌다. 안쪽이면 벽이 현관문을 가린다
  shoes: { position: [-5.4, 2.6, -5.4], target: [-9.23, 0.75, -8.48] },
  cards: { position: [-10.6, 2.8, -0.9], target: [-13.2, 1.3, -3.5] },
  // 열린 아래칸 안이 보이게 높이 내려다본다. 낮으면 서랍 앞판이 앰플을 가리고, 앞에 선
  // 캐릭터가 앰플과 겹쳐 글로우(xRay)가 얼굴 위로 그려진다
  ampoule: { position: [-13.25, 3.6, -3.7], target: [-15.67, 0.6, -6.5] },
  // 안방 기억: 방과 같은 사분면(+x·+z)에서 내려다본다. 책상은 +z 벽에 붙어 있지만
  // 그 벽은 카메라 쪽이라 걷힌다 (CulledWall). 다른 사분면에서 보면 벽이 열렸다 닫힌다
  "research-note": { position: [-16.3, 3.4, 8.6], target: [-18.94, 1.1, 6.0] },
  "id-card": { position: [-15.4, 3.3, 8.4], target: [-17.8, 1.1, 6.05] },
  /*
   * 화장실 세면대 하부장: 열쇠가 나오는 순간의 크레인 샷 (crane-shot.ts). 타깃은 하부장
   * 상자의 중심(BathroomShell의 CABINET)이고, 방향은 거실 물건들과 같은 +x·+z다. 하부장은
   * 안쪽 벽(+z)에 붙어 있어 이 방향에서는 윗면과 벌어진 문짝이 보인다. 문 안을 들여다보는
   * 각도가 아니라 "저 작은 칸"으로 밀고 들어가는 각도다.
   */
  "sink-cabinet": { position: [-9.63, 2.1, 12.19], target: [-12.25, 0.4, 9.69] },
} as const satisfies Record<"room" | "ending" | "sink-cabinet" | MemoryId, CameraPreset>;

/*
 * ---------------------------------------------------------------- 화장실 · 안방 (v3)
 *
 * 2막부터 집이 한 공간씩 열린다 (docs/content-design.md 3-1). 둘 다 거실에서 문으로
 * 이어진다: 화장실은 거실 앞벽(+z) 너머, 안방은 거실 -x 벽(현관 쪽) 너머.
 *
 * 문 자리는 거실 가구 발자국 사이의 빈 벽이다. 앞벽은 TV장(x ≥ -10.75)과 피아노
 * (x ≤ -13.9) 사이. spaces.test가 문간 구간과 가구가 안 겹치는지 지킨다.
 */
/** 문은 앞벽의 빈 틈(x -12.25)에 맞추되, 방 자체는 벽 너머라 그 틈보다 넓게 잡는다. 좁으면 굴뚝이 된다. */
export const BATHROOM_SHELL_BOUNDS: Aabb2 = { minX: -14.6, maxX: -10.2, minZ: 6.5, maxZ: 10 };
export const BATHROOM_BOUNDS: Aabb2 = {
  minX: BATHROOM_SHELL_BOUNDS.minX + 0.45,
  maxX: BATHROOM_SHELL_BOUNDS.maxX - 0.45,
  minZ: BATHROOM_SHELL_BOUNDS.minZ + 0.45,
  maxZ: BATHROOM_SHELL_BOUNDS.maxZ - 0.45,
};
/** 화장실 문: 거실 앞벽(z = 6.5) 위, 문틀은 벽 안쪽(거실 쪽)에 붙는다. */
export const BATHROOM_DOOR_POSITION = [-12.25, 1.7, BATHROOM_SHELL_BOUNDS.minZ - 0.14] as const;
export const BATHROOM_DOOR_ROTATION = [0, 0, 0] as const;
/**
 * 화장실 가구 발자국: 왼쪽(-x) 벽에 세면대, 안쪽(+z) 벽 구석에 변기, 오른쪽(+x) 벽에 욕조.
 * 문 앞은 비운다.
 *
 * 세면대는 처음에 안쪽 벽(+z) 가운데 있었다. 그 벽은 카메라 쪽 벽이라(CAMERA_PRESETS는 늘
 * +x·+z 사분면) 거기 붙은 물건은 등만 보인다: 하부장 문과 다이얼, 칫솔컵, 거울이 전부
 * 카메라 반대쪽을 봐서 회전 범위(MAX_ROOM_ORBIT) 어디에서도 안 보였다. 왼쪽 벽은 늘 서
 * 있는 벽이라 거기 붙은 물건은 카메라를 마주 본다. 자리는 문(z ≤ 7.9)과 변기(z ≥ 9.2)
 * 사이: 열린 문짝(x ≈ -13, z ≤ 7.94)이 카메라와 세면대 사이에 서지 않는다.
 */
export const BATHROOM_COLLIDERS = [
  { minX: -14.6, maxX: -13.7, minZ: 9.2, maxZ: 10 }, // toilet (-x, +z 구석)
  { minX: -14.6, maxX: -14.0, minZ: 7.75, maxZ: 8.75 }, // sink (-x 벽, 문과 변기 사이)
  { minX: -10.9, maxX: -10.2, minZ: 7.3, maxZ: 10 }, // bathtub (+x 벽)
] as const satisfies readonly Aabb2[];

/*
 * 안방은 거실 -x 벽 너머다. 거실 뒷벽은 부엌과 현관이 쓴다. 현관문도 한때 이 -x 벽에
 * 안방문과 나란히 있었는데, 옆방 문처럼 읽혀 뒷벽으로 옮겼다 (FRONT_DOOR_POSITION).
 * 이제 이 벽의 문은 안방문 하나다.
 *
 * 처음에는 이 벽 끝을 피아노가, 그 앞을 식탁이 막고 있었다. 둘 다 옮기고 나서야
 * (LIVING_PIANO_CENTER · LIVING_DINING_CENTER) 문 둘이 제 벽을 가졌다.
 */
export const PARENTS_SHELL_BOUNDS: Aabb2 = { minX: -23, maxX: -16.5, minZ: -0.5, maxZ: 6.5 };
export const PARENTS_BOUNDS: Aabb2 = {
  minX: PARENTS_SHELL_BOUNDS.minX + 0.45,
  maxX: PARENTS_SHELL_BOUNDS.maxX - 0.45,
  minZ: PARENTS_SHELL_BOUNDS.minZ + 0.45,
  maxZ: PARENTS_SHELL_BOUNDS.maxZ - 0.45,
};
/** 안방 문: 거실 -x 벽 위. 문틀은 벽 안쪽(거실 쪽)에 붙는다. */
/*
 * 안방 문. 공유벽(z -0.5~6.5)의 가운데 언저리다. 현관문이 같은 -x 벽에 있던 시절에는 두
 * 문이 붙어 서지 않게 앞쪽 끝(z 4.9)까지 밀려 있었는데, 현관이 뒷벽 홈으로 간 뒤로는 그럴
 * 이유가 없다. 거실에서는 인형과 TV 사이 빈 벽에, 안방에서는 침대 정면에 난다. 옷장
 * (z 0.2까지)·책상(z 5.7부터) 어느 쪽에도 문간 판정이 닿지 않는다.
 */
export const PARENTS_DOOR_POSITION = [PARENTS_SHELL_BOUNDS.maxX + 0.14, 1.7, 2.6] as const;
/** -π/2: 문의 앞면(로컬 +z)이 안방(-x)을 본다. 문짝은 앞면 쪽으로 열린다 (SpaceDoor). */
export const PARENTS_DOOR_ROTATION = [0, -Math.PI / 2, 0] as const;
/** 안방 가구 발자국: -x 벽에 침대, -z 벽에 옷장, +z 벽에 책상(연구 자료). 문 앞(+x 벽)은 비운다. */
export const PARENTS_COLLIDERS = [
  { minX: -23, maxX: -20.2, minZ: 1.4, maxZ: 5.4 }, // double bed (-x 벽, 머리맡이 벽)
  { minX: -21.6, maxX: -18.4, minZ: -0.5, maxZ: 0.2 }, // wardrobe (-z 벽)
  { minX: -19.6, maxX: -17.4, minZ: 5.7, maxZ: 6.5 }, // desk (+z 벽)
] as const satisfies readonly Aabb2[];

/**
 * 새 문간 판정 구간. 방문 문간(DOORWAY_ZONE)과 같은 규칙이다: 양쪽 걷기 범위와
 * 플레이어 지름(0.76) 이상 겹치고, 문틀 안쪽 폭보다 좁다. 화장실 문은 z 방향이라
 * z로 잇는다 (spaces.test가 지킨다).
 */
export const BATHROOM_DOORWAY_ZONE: Aabb2 = { minX: -12.9, maxX: -11.6, minZ: 5.1, maxZ: 7.9 };
/** 안방 문간은 x 방향 문이다: 방문 문간과 같은 꼴로 x로 잇는다. z는 문을 따라간다. */
export const PARENTS_DOORWAY_ZONE: Aabb2 = {
  minX: -17.9,
  maxX: -15.1,
  minZ: PARENTS_DOOR_POSITION[2] - 0.65,
  maxZ: PARENTS_DOOR_POSITION[2] + 0.65,
};
