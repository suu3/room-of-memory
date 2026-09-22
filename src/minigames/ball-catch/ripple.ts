import { musicCutoff } from "@/lib/audio";

/**
 * 타점에서 번지는 잉크 파문의 순수 계산 (docs/visual-experiments.md 4장 "사인볼+글러브").
 *
 * 그리는 쪽(ink-ripple.tsx)은 여기 함수를 부르고 Canvas 2D에 링을 긋기만 한다.
 * 곡선은 전부 브라우저 없이 테스트한다 (9장 "바인딩은 순수 함수로").
 *
 * 감쇠는 방의 밝기에 물린다. 밝기 자체가 아니라 BGM 컷오프(`musicCutoff`)를 거쳐
 * 오는 이유는 귀와 눈이 같은 곡선을 타게 하려는 것이다: 곡이 벽 너머로 멀어지는
 * 만큼 파문도 빨리 잔다. 컷오프는 지수 보간이라 로그로 되돌려야 0~1이 고르게 선다.
 */

/** 필드 기준 좌표(0~1). 캔버스 크기가 바뀌어도 파문의 자리는 그대로다 */
export interface Ripple {
  x: number;
  y: number;
  /** performance.now() 기준 태어난 시각(ms) */
  bornAt: number;
}

/** 가장 밝을 때(decay 0)의 수명. 파문이 천천히 퍼져 링 셋이 다 보인다 */
export const RIPPLE_LIFE_SLOW_MS = 1400;
/** 가장 어두울 때(decay 1)의 수명. 파문만 잠깐 스치고 만다 */
export const RIPPLE_LIFE_FAST_MS = 450;
/** 이 알파 아래로 내려간 파문은 지운다. 눈에 남지 않는 값 */
export const RIPPLE_DEAD_ALPHA = 0.01;
/**
 * 반지름이 자라는 시간 상수를 수명에 곱하는 비율. 수명의 절반쯤에서 거의 다 퍼지고,
 * 나머지 절반은 자리에서 잦아드는 모양이 물에 떨어진 잉크와 가장 닮았다.
 */
const RADIUS_TAU_RATIO = 0.45;
/** 중심 얼룩은 링보다 이만큼 빨리 잔다. 얼룩이 끝까지 남으면 링이 아니라 점으로 읽힌다 */
const BLOT_FADE_RATIO = 2.4;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** 감쇠(0~1) → 파문 수명(ms). 1이 가장 빨리 잔다 */
export function lifeMs(decay: number): number {
  const clamped = clamp01(decay);
  return RIPPLE_LIFE_SLOW_MS + (RIPPLE_LIFE_FAST_MS - RIPPLE_LIFE_SLOW_MS) * clamped;
}

/**
 * 나이(ms) → 반지름(0~1, 최대 반지름 기준). 처음에 훅 퍼지고 뒤로 갈수록 느려진다.
 * 1 - e^(-t): 수명이 짧을수록 퍼지는 것도 빨라 링이 크기만 하고 사라지는 일이 없다.
 */
export function rippleRadius(ageMs: number, decay: number): number {
  const age = Math.max(0, ageMs);
  return 1 - Math.exp(-age / (lifeMs(decay) * RADIUS_TAU_RATIO));
}

/** 나이(ms) → 링 알파(0~1). 태어난 순간 1, 수명이 지나면 1/e */
export function rippleAlpha(ageMs: number, decay: number): number {
  const age = Math.max(0, ageMs);
  return Math.exp(-age / lifeMs(decay));
}

/** 중심 얼룩의 알파. 링보다 먼저 잔다 */
export function rippleBlotAlpha(ageMs: number, decay: number): number {
  return rippleAlpha(Math.max(0, ageMs) * BLOT_FADE_RATIO, decay);
}

/**
 * 방의 밝기(0~1) → 감쇠(0~1). 어두울수록 1에 가깝다.
 *
 * `musicCutoff`의 바닥과 천장 사이를 로그로 0~1에 놓고 뒤집는다. 바닥·천장 상수는
 * music-curve.ts가 내보내지 않으므로 양 끝값을 직접 불러 잡는다: 그쪽 상수가 바뀌어도
 * 여기가 따라간다.
 */
export function rippleDecayFromLevel(level: number): number {
  const floor = Math.log(musicCutoff(0));
  const ceiling = Math.log(musicCutoff(1));
  if (ceiling <= floor) return 0;
  const open = (Math.log(musicCutoff(clamp01(level))) - floor) / (ceiling - floor);
  return clamp01(1 - open);
}

/** 죽은 파문(알파가 RIPPLE_DEAD_ALPHA 아래)을 뺀 새 배열. 원본은 건드리지 않는다 */
export function pruneRipples(ripples: readonly Ripple[], now: number, decay: number): Ripple[] {
  return ripples.filter((ripple) => rippleAlpha(now - ripple.bornAt, decay) >= RIPPLE_DEAD_ALPHA);
}
