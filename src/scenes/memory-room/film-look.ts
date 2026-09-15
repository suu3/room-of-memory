/**
 * 필름 룩의 수치. 셰이더 그레인과 색수차가 같이 읽는다 (FilmLook.tsx).
 *
 * 둘 다 "화면이 필름처럼 보이는" 층이지 어둠을 만드는 층이 아니다 (DESIGN.md > Texture).
 * 어둠은 씬 조명이 만들고, 여기는 그 위에 얹히는 질감의 양만 정한다.
 */

/**
 * 그레인의 불투명도. overlay 블렌드라 중간 밝기에서 가장 세게 보이고 검정·흰색에서는
 * 사라진다. CSS 판(.film-grain, 0.13)은 fractal 노이즈라 결이 굵었고, 셰이더 판은
 * 픽셀 단위 백색 노이즈라 같은 값이면 훨씬 거칠게 읽힌다. 그래서 더 낮다.
 */
export const FILM_GRAIN_OPACITY = 0.09;

export const ABERRATION = {
  /** 밝은 방에서의 색 어긋남 (UV 단위). 1440px 화면 가장자리에서 1px이 채 안 된다. */
  base: 0.0006,
  /** 가장 어두운 지점에서 base에 곱해 더하는 배율. 어두울수록 기억이 더 흔들린다. */
  dimGain: 1.5,
  /** 사건이 튀기는 순간의 최대 어긋남. 잠깐 화면 가장자리가 갈라졌다가 돌아온다. */
  pulse: 0.0035,
  /** 튄 값이 잦아드는 속도. 1초 남짓이면 거의 사라진다. */
  pulseLambda: 4,
  /** 밝기 변화를 따라가는 속도. 조명 damp(LIGHT_LAMBDA)와 같은 호흡이다. */
  followLambda: 2.2,
  /** 세로 어긋남은 가로의 이 비율. 렌즈처럼 한쪽으로 치우친다. */
  aspect: 0.6,
  /** 이 반지름(0~1) 안쪽은 어긋나지 않는다. 화면 가운데의 글자·얼굴은 깨끗하게 둔다. */
  modulationOffset: 0.3,
} as const;

/** 사건마다 튀는 세기 (0~1). 라디오가 깨어나는 순간이 기억 하나를 줍는 순간보다 크다. */
export const ABERRATION_PULSE = {
  collect: 0.6,
  radioWake: 1,
} as const;

/** 어둠의 양(0 = 밝은 방, 1 = 가장 어두운 지점)에서 쉬고 있을 때의 어긋남. */
export function restingAberration(dim: number): number {
  const clamped = Math.min(1, Math.max(0, dim));
  return ABERRATION.base * (1 + clamped * ABERRATION.dimGain);
}

/** 쉬는 값 위에 튄 값(0~1)을 얹는다. 튀는 쪽은 damp 없이 곧바로 붙는다: 사건은 순간이다. */
export function aberrationAmount(resting: number, pulse: number): number {
  return resting + Math.min(1, Math.max(0, pulse)) * ABERRATION.pulse;
}

/** 프레임마다 튄 값을 잦아들게 한다. 지수 감쇠라 프레임 길이가 달라도 같은 곡선이다. */
export function decayPulse(pulse: number, delta: number): number {
  const next = pulse * Math.exp(-ABERRATION.pulseLambda * delta);
  // 아주 작아지면 0으로 끊는다. 영원히 0.00001로 남아 있을 이유가 없다
  return next < 0.001 ? 0 : next;
}
