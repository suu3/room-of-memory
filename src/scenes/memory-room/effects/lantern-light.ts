/**
 * 등: 1막 후반, 방이 바닥 가까이 어두워졌을 때 손(커서)이나 몸 가까이만 비추는 점광원의
 * 수치 (docs/direction/visual-experiments.md 6장 "커서 손전등").
 *
 * 화면 위에 마스크를 씌워 어둡게 만드는 방식은 쓰지 않는다. 어둠은 씬 조명이 만든다
 * (DESIGN.md > Texture). 대신 진짜 광원 하나를 커서 자리에 세운다. 마우스가 없는
 * 기기에서는 몸에 붙는다: 커서는 없어도 손은 있다.
 *
 * 켜지는 문턱은 라디오 직전, 조사할 것이 두어 개 남았을 때다. 진입 밝기(0.62) 바로
 * 밑에서 켜면 첫 조사 직후부터 방이 등 하나에 기대게 된다.
 */

/** 이 밝기 아래에서만 켜진다. 1막 진입(0.62)과 바닥(0) 사이의 아래쪽 절반쯤. */
export const LANTERN_THRESHOLD = 0.35;
/** 가장 어두울 때의 세기. 전등(lamp 램프 바닥 4)과 견주어 손 주위만 밝히는 양. */
export const LANTERN_MAX_INTENSITY = 6;
/** 닿는 거리: 어두울수록 좁다. 문턱에서 켜질 때는 넓고 흐리게, 바닥에서는 좁고 또렷하게. */
export const LANTERN_REACH: readonly [number, number] = [2.2, 4.4];
/** 광원의 높이. 손 높이보다 조금 위: 바닥에 둥근 빛이 앉고 물건의 옆면이 잡힌다. */
export const LANTERN_HEIGHT = 1.35;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isNaN(value) ? 0 : value));
}

/** 밝기(0~1) → 등이 켜진 정도 (0 = 꺼짐, 1 = 바닥에서의 최대). 문턱에서 부드럽게 든다. */
export function lanternAmount(level: number): number {
  const clamped = clamp01(level);
  if (clamped >= LANTERN_THRESHOLD) return 0;
  const t = 1 - clamped / LANTERN_THRESHOLD;
  return t * t * (3 - 2 * t);
}

/** 밝기(0~1) → 세기. */
export function lanternIntensity(level: number): number {
  return LANTERN_MAX_INTENSITY * lanternAmount(level);
}

/** 밝기(0~1) → 닿는 거리. 어두울수록 좁아진다. 꺼져 있을 때의 값은 뜻이 없다. */
export function lanternReach(level: number): number {
  const amount = lanternAmount(level);
  return LANTERN_REACH[1] + (LANTERN_REACH[0] - LANTERN_REACH[1]) * amount;
}

/**
 * 등이 몸에서 떨어져 있어야 하는 수평 거리. LANTERN_HEIGHT(1.35)는 머리 높이(중심 1.24,
 * 정수리 1.51)라, 등을 몸의 자리에 그대로 세우면 광원이 머리 **속**에 든다. 손가락 기기는
 * 늘 그 자리였다. 머리카락은 양면 재질이라 틈 사이로 안쪽 면이 비치는데, 거기에 세기 6이
 * 0.1 거리에서 닿아(거리 제곱으로 수백 배) 검은 머리 위에 흰 점이 반짝였다. 등이 가장
 * 밝아지는 순간이 라디오 뒤(밝기 0)라 그때부터 보였다. 머리 반경(뒤통수 0.31)에 여유를
 * 두고 이만큼은 밖에 둔다.
 */
export const LANTERN_BODY_CLEARANCE = 0.9;

/**
 * 등이 설 자리(x, z)를 몸 밖으로 민다. 몸에서 CLEARANCE 안이면 몸→목표 방향으로 밀어내고,
 * 목표가 몸 자리 그 자체(손가락 기기)면 몸→카메라 방향으로 민다: 보이는 쪽 몸을 비추는
 * 손에 든 등이 된다. 결과는 out에 쓴다 (프레임마다 부르므로 새 객체를 만들지 않는다).
 */
export function lanternClearOfBody(
  target: { x: number; z: number },
  body: { x: number; z: number },
  camera: { x: number; z: number },
  out: { x: number; z: number },
): { x: number; z: number } {
  let dx = target.x - body.x;
  let dz = target.z - body.z;
  let length = Math.hypot(dx, dz);
  if (length >= LANTERN_BODY_CLEARANCE) {
    out.x = target.x;
    out.z = target.z;
    return out;
  }
  if (length < 1e-3) {
    dx = camera.x - body.x;
    dz = camera.z - body.z;
    length = Math.hypot(dx, dz);
    // 카메라가 바로 위에 있으면 방향이 없다. 아무 쪽(+z, 화면 앞)으로나 민다
    if (length < 1e-3) {
      dx = 0;
      dz = 1;
      length = 1;
    }
  }
  out.x = body.x + (dx / length) * LANTERN_BODY_CLEARANCE;
  out.z = body.z + (dz / length) * LANTERN_BODY_CLEARANCE;
  return out;
}
