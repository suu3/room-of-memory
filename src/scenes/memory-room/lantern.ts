/**
 * 등: 1막 후반, 방이 바닥 가까이 어두워졌을 때 손(커서)이나 몸 가까이만 비추는 점광원의
 * 수치 (docs/visual-experiments.md 6장 "커서 손전등").
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
