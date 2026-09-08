import type { Aabb2 } from "./types";

/*
 * 침대 glb(room-bed)의 실측과 방 안 배치.
 *
 * 침대는 프레임·매트리스·베개·이불이 한 파일에 들어 있는 사용자 제작 모델이다. 몸이
 * 눕는 자리(seats), 침대 위에 던져둔 폰(layout), 걷지 못하는 발자국(layout)이 전부 이
 * 모델의 치수에서 나오므로 여기 한 곳에서 월드 좌표로 바꿔 준다 — 모델을 다시 내보내면
 * BED_MODEL만 실측으로 고친다.
 *
 * 모델 규약: 밑면 y=0, **긴 축이 x**, 머리판이 -x 끝. 방에서는 y축 -90°로 돌려 긴 축을
 * +z에 눕힌다 (머리판이 창가 쪽 낮은 z). 그래서 모델 x → 월드 z, 모델 z → 월드 -x다.
 * 부품은 노드 이름으로 구분한다 (BedModel이 재질을 입힐 때 본다):
 * frame · mattress · headboard · base · footboard · pillow · blanket.
 * 이불(blanket)에는 shape key `folded` 하나 — 0이면 펼쳐 덮여 있고 1이면 발치로 접혀 뭉친다.
 */

/** 모델 실측 (모델 단위, 밑면 y=0). 굽은 파일을 GLTFLoader로 읽어 잰 값. */
export const BED_MODEL = {
  /** 바깥 발자국 — 머리판 뒷면에서 발판 앞면까지, 머리판·발판의 반폭. */
  footprint: { minX: -3.154, maxX: 3.154, halfWidth: 1.647 },
  /** 침대 전체 높이 = 머리판 꼭대기. */
  headboard: { frontX: -2.762, topY: 2.1 },
  mattress: { minX: -2.604, maxX: 2.667, halfWidth: 1.517, topY: 1.159 },
  pillow: { minX: -2.382, maxX: -1.025, halfWidth: 0.88, topY: 1.7 },
  /**
   * 이불. 펼치면 베개 발치(spreadMinX)부터 발판까지 덮고 매트리스 위로 0.05쯤 도톰하다.
   * 접으면 foldedMinX 너머 발치 쪽에 뭉치는데(높이 1.03까지), 뭉치는 foldedFlatMinX에서
   * 끝나고 거기서 발판까지는 펼쳤을 때와 같은 두께로 평평하다 — 위에 물건을 둘 수 있다.
   */
  blanket: { spreadMinX: -1.903, foldedMinX: 0.647, foldedFlatMinX: 1.85, maxX: 2.736, topY: 1.21 },
} as const;

/**
 * 배율. 매트리스 윗면이 예전 상자 침대와 같은 0.81에 오는 값 — 이 방의 가구는 캐릭터
 * (키 1.55)에 비해 큰데, 매트리스가 이보다 높으면 식탁 상판(0.975)에 닿아 침대로 안 읽힌다.
 * 앉고 눕는 높이(player-rig)와 폰 배치가 전부 이 윗면에서 파생된다.
 */
export const BED_SCALE = 0.7;
/** 모델 원점이 놓이는 월드 x·z. 머리판 뒷면이 z 0.21(예전 상자 침대와 같은 자리)에 온다. */
export const BED_ORIGIN = { x: 4.65, z: 2.42 } as const;
/** 모델 긴 축(x)을 월드 +z로. */
export const BED_ROTATION_Y = -Math.PI / 2;

/** 모델 x(긴 축) → 월드 z. */
function alongZ(modelX: number): number {
  return BED_ORIGIN.z + modelX * BED_SCALE;
}

/** 모델 반폭 → 월드 x 범위. 모델 z가 월드 -x로 가지만 좌우 대칭이라 부호는 상관없다. */
function acrossX(halfWidth: number): { minX: number; maxX: number } {
  return { minX: BED_ORIGIN.x - halfWidth * BED_SCALE, maxX: BED_ORIGIN.x + halfWidth * BED_SCALE };
}

/** 매트리스 — 폰이 놓이고 몸이 눕는 판. */
export const BED_MATTRESS = {
  ...acrossX(BED_MODEL.mattress.halfWidth),
  minZ: alongZ(BED_MODEL.mattress.minX),
  maxZ: alongZ(BED_MODEL.mattress.maxX),
  topY: BED_MODEL.mattress.topY * BED_SCALE,
} as const;

/** 베개 — 누운 머리가 이 안에 와야 한다. */
export const BED_PILLOW = {
  ...acrossX(BED_MODEL.pillow.halfWidth),
  minZ: alongZ(BED_MODEL.pillow.minX),
  maxZ: alongZ(BED_MODEL.pillow.maxX),
  centerZ: alongZ((BED_MODEL.pillow.minX + BED_MODEL.pillow.maxX) / 2),
  topY: BED_MODEL.pillow.topY * BED_SCALE,
} as const;

/** 머리판 앞면 z — 누운 머리 꼭대기가 이보다 발치 쪽에 있어야 한다. */
export const BED_HEADBOARD_FRONT_Z = alongZ(BED_MODEL.headboard.frontX);

/** 펼친 이불 윗면 y. 그 위에 얹는 물건(폰)의 밑면 높이. */
export const BED_BLANKET_TOP_Y = BED_MODEL.blanket.topY * BED_SCALE;
/**
 * 접힌 이불 뭉치가 차지하는 z 범위. 침대 위에 둔 물건은 이 밖(머리 쪽이나 발치 끝의
 * 평평한 자락)에 있어야 접힐 때 뭉치에 파묻히지 않는다.
 */
export const BED_BLANKET_FOLDED_Z = {
  min: alongZ(BED_MODEL.blanket.foldedMinX),
  max: alongZ(BED_MODEL.blanket.foldedFlatMinX),
} as const;

/** 바깥 발자국 (머리판·발판 포함). */
export const BED_FOOTPRINT: Aabb2 = {
  ...acrossX(BED_MODEL.footprint.halfWidth),
  minZ: alongZ(BED_MODEL.footprint.minX),
  maxZ: alongZ(BED_MODEL.footprint.maxX),
};

/** 발자국 둘레에 두는 여유 — 몸이 프레임에 닿기 전에 멈춘다. */
const COLLIDER_MARGIN = 0.1;
/** 걷지 못하는 영역. layout의 ROOM_COLLIDERS와 seats의 다가서는 자리가 같은 수를 본다. */
export const BED_COLLIDER: Aabb2 = {
  minX: BED_FOOTPRINT.minX - COLLIDER_MARGIN,
  maxX: BED_FOOTPRINT.maxX + COLLIDER_MARGIN,
  minZ: BED_FOOTPRINT.minZ - COLLIDER_MARGIN,
  maxZ: BED_FOOTPRINT.maxZ + COLLIDER_MARGIN,
};
