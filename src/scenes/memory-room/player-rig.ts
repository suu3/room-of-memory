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

/*
 * 눕는 자세 (침대). 눕는 클립은 없다 — Idle을 발 원점 기준으로 통째로 뒤로 눕힌다.
 *
 * 완전히 눕히지 않고 LIE_TILT만큼 세워 둔다: 이 캐릭터는 머리가 몸통보다 0.2쯤 더 뒤로
 * 나와 있어(등 -0.17, 뒤통수 -0.37), 평평하게 눕히면 뒤통수가 베개 속으로 꺼진다.
 * 발을 매트리스에 두고 이만큼 세우면 뒤통수가 베개 윗면 근처(0.9)로 올라온다 — 큰
 * 베개에 기대 누운 그림이다. 몸통은 매트리스에서 0.1쯤 뜨지만 이불 두께로 읽힌다.
 */
export const LIE_TILT = 0.4;
/** 눕힌 몸의 등이 닿는 깊이 (Idle 몸통 뒷면, 로컬 z). 매트리스 윗면 계산에 쓴다. */
export const LIE_BACK_Z = -0.17;
/** 뒤통수 깊이 (로컬 z)와 머리 중심 높이 (로컬 y). 베개 위에 오는지 재는 데 쓴다. */
export const LIE_HEAD = { backZ: -0.37, centerY: 1.2, topY: 1.55 } as const;
