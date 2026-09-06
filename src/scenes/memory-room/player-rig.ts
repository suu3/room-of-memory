/** The supplied skinned GLB is exported at room scale, with feet at Y=0 and front at +Z. */
export const PLAYER_TARGET_HEIGHT = 1.55;

/** Procedural walk phase follows traveled distance, in radians per world unit. */
export const STEP_RATE = 3.2;

/*
 * Sit 포즈의 실측값 (player-model.test가 실제 GLB에서 지킨다).
 *
 * 이 방의 가구는 캐릭터에 비해 크다 — 좌면이 0.57~0.75인데 캐릭터의 다리는 0.46뿐이라,
 * 앉으면 발이 바닥에 안 닿고 무릎 아래가 앞으로 늘어진다. 그래서 몸은 좌면 **앞턱**에
 * 걸쳐 앉힌다: 조금이라도 뒤로 물리면 정강이가 좌면 판을 뚫고 들어간다 (seats.ts).
 */

/** 좌면에 닿는 높이 (허벅지 밑면). 리그 루트를 `좌면 - 이 값`에 두면 몸이 좌면에 앉는다. */
export const SIT_CONTACT_Y = 0.211;

/** 좌면에 얹히는 외곽의 앞뒤 범위 — 둥근 니트 뒷밑단을 포함한 실측값. */
export const SIT_CONTACT_Z = { back: -0.269, front: 0.099 } as const;

/** 무릎 아래(정강이·발)가 차지하는 앞뒤 범위. 전부 좌면 앞턱보다 앞에 있어야 한다. */
export const SIT_LEG_Z = { back: -0.047, front: 0.223 } as const;

/**
 * 머리를 뺀 몸통의 좌우 반폭 (y 0.7 아래). 식탁·책상 상판을 피해 앉히는 데 쓴다 —
 * 머리(0.41)는 어느 상판보다도 위에 있어 겹칠 일이 없다.
 */
export const SIT_TORSO_HALF_WIDTH = 0.25;
