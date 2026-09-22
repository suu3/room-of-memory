/**
 * 세면대에 고인 물의 파문 (docs/visual-experiments.md 11장 "굴절 · 파문 → 세면대의 물").
 *
 * 30일 멈춘 집의 물은 평소 정지다. 열쇠를 집는 순간 손이 물을 스친 듯 파문 하나가
 * 번지고, 대야 바닥이 굴절로 흔들리다 잔다. 여기는 그 한 번의 곡선만 둔다: 시간(초)을
 * 넣으면 진폭과 파두 반경이 나온다. 셰이더는 이 값을 uniform으로 받아 sin 하나를 그린다.
 * 브라우저 없이 시험하기 위해 순수 함수로 뗐다 (film-look.ts와 같은 관례).
 *
 * 거리 단위는 물 판의 uv다. 판의 긴 변(0.44m)이 1이고 가운데가 원점이라, 판의 긴 쪽
 * 가장자리는 0.5, 짧은 쪽 가장자리는 0.32쯤이다.
 */
export const RIPPLE = {
  /** 파문이 다 잔 것으로 치는 시간(초). 이 뒤로는 진폭이 0.02 아래다. */
  duration: 2.5,
  /** 손이 닿은 직후 진폭이 꼭대기에 오르는 시간(초). 순간이지만 0이면 첫 프레임이 튄다. */
  attack: 0.08,
  /** 지수 감쇠 계수. duration에서 exp(-decay * duration) ≈ 0.02가 되도록 잡았다. */
  decay: 1.6,
  /** 파두가 다다르는 최대 반경(uv). 판 가장자리(0.5)를 넘어야 끝까지 번진 것으로 보인다. */
  reach: 0.62,
  /** 파두가 퍼지는 빠르기. 처음 빠르고 곧 느려진다: 1 - exp(-spread * t). */
  spread: 2.4,
  /** 파장의 각주파수(uv 1당). 2π / 0.09 ≈ 70: 대야 위에서 마루 네다섯 개가 보인다. */
  waveNumber: 70,
  /** 시간의 각주파수(초당). waveNumber와의 비가 위상 속도(uv/s)다: 21/70 = 0.3. */
  angularSpeed: 21,
} as const;

/**
 * 충격 뒤 흐른 시간(초)에서 파문의 진폭 (0~1).
 * 닿기 전은 0. attack 동안 부드럽게 올라 꼭대기를 찍고, 그 뒤 지수로 잔다.
 * 꼭대기는 attack 근처에서 1에 못 미친다 (감쇠가 이미 시작됐다): 그래서 상한만 1이다.
 */
export function rippleAmplitude(ageS: number): number {
  if (!(ageS > 0)) return 0;
  const rise = Math.min(ageS / RIPPLE.attack, 1);
  const eased = rise * rise * (3 - 2 * rise);
  return eased * Math.exp(-RIPPLE.decay * ageS);
}

/**
 * 충격 뒤 흐른 시간(초)에서 파두의 반경(uv). 닿기 전은 0.
 * 처음엔 빠르게 벌어지고 reach에 가까워질수록 느려진다: 실제 물결도 앞으로 갈수록 잦아든다.
 */
export function rippleWavefront(ageS: number): number {
  if (!(ageS > 0)) return 0;
  return RIPPLE.reach * (1 - Math.exp(-RIPPLE.spread * ageS));
}

/** 이 시간에도 파문이 그릴 만큼 남았는가. 셰이더 분기와 lab의 상태 표시가 같이 쓴다. */
export function rippleAlive(ageS: number): boolean {
  return ageS > 0 && ageS < RIPPLE.duration;
}
