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

/**
 * 사건이 튀는 순간 그레인이 진해지는 배율. 색수차와 같은 펄스(event-pulse)를 먹는다.
 * 1이면 펄스 꼭대기에서 두 배. 화면이 잠깐 거칠어졌다 가라앉는다.
 */
export const GRAIN_PULSE_GAIN = 1;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isNaN(value) ? 0 : value));
}

/**
 * 펄스(0~1)에 따른 그레인 불투명도.
 *
 * `noise`는 라디오 튜닝의 잡음(film-look-input). 펄스와 같은 상한을 먹는다: 둘 중 큰
 * 값 하나만 센다. 더하면 사건 순간에 상한을 넘어 화면이 번쩍인다.
 * `clean`(0~1)은 엔딩의 몫이다. 1이면 그레인이 사라진다. 게임에서 화면이 처음으로
 * 깨끗해지는 순간이다.
 */
export function grainOpacity(pulse: number, noise = 0, clean = 0): number {
  const lift = Math.max(clamp01(pulse), clamp01(noise));
  return FILM_GRAIN_OPACITY * (1 + lift * GRAIN_PULSE_GAIN) * (1 - clamp01(clean));
}

/** 어둠의 양(0 = 밝은 방, 1 = 가장 어두운 지점)에서 쉬고 있을 때의 어긋남. */
export function restingAberration(dim: number): number {
  const clamped = Math.min(1, Math.max(0, dim));
  return ABERRATION.base * (1 + clamped * ABERRATION.dimGain);
}

/**
 * 쉬는 값 위에 튄 값(0~1)을 얹는다. 튀는 쪽은 damp 없이 곧바로 붙는다: 사건은 순간이다.
 * `noise`·`clean`은 grainOpacity와 같은 뜻이다. 잡음은 펄스와 상한을 나눠 쓰고, 깨끗해지는
 * 쪽은 쉬는 값까지 지운다.
 */
export function aberrationAmount(resting: number, pulse: number, noise = 0, clean = 0): number {
  const lift = Math.max(clamp01(pulse), clamp01(noise));
  return (resting + lift * ABERRATION.pulse) * (1 - clamp01(clean));
}

/**
 * 엔딩에서 화면이 깨끗해지는 속도. 문이 열리는 1.8초(EndingScreen의 DOOR_BEAT)와
 * 타들어감(ScreenTransition의 BURN_RISE_S, 1.5초) 사이에서 다 지워져야 한다.
 */
export const CLEAN_LAMBDA = 2.6;

/** 프레임마다 튄 값을 잦아들게 한다. 지수 감쇠라 프레임 길이가 달라도 같은 곡선이다. */
export function decayPulse(pulse: number, delta: number): number {
  const next = pulse * Math.exp(-ABERRATION.pulseLambda * delta);
  // 아주 작아지면 0으로 끊는다. 영원히 0.00001로 남아 있을 이유가 없다
  return next < 0.001 ? 0 : next;
}
