/**
 * 말풍선의 흐림 기울기 (docs/visual-experiments.md 4장 "스마트폰").
 *
 * 최근 메시지일수록 흐리다. 오래된 줄(피시방 내기로 떠들던 방과 후)은 또렷하고,
 * 그날 저녁 도해 혼자 남긴 줄로 내려갈수록 글자가 번진다. 기억이 흐려지는
 * 방향이 시간순과 같다: 최근일수록 손이 닿지 않는다.
 *
 * 순수 함수만 둔다. 컴포넌트는 값을 받아 `filter: blur(px)` 한 줄만 쓴다.
 */

/**
 * 가장 최근 줄의 최대 흐림. 이 위로 올리면 방금 펼친 줄을 읽을 수 없다.
 * 2.4px은 0.875rem 본문에서 글자가 번져 보이되 아직 읽히는 선이다.
 */
export const MAX_BLUR_PX = 2.4;

/** 이만큼 위(과거)로 올라가면 흐림이 0이 된다. 대화가 8줄이라 절반 남짓이 또렷하다. */
export const HAZE_DEPTH = 6;

/**
 * 뒤에서 세어 `indexFromNewest`번째 줄(0 = 가장 최근)의 blur(px).
 *
 * `dim`(0~1)은 방의 어둠: 0이면 밝은 방이라 아무 줄도 흐리지 않고, 1이면 가장
 * 어두울 때라 최근 줄이 MAX_BLUR_PX까지 번진다. 그 위로는 HAZE_DEPTH까지 선형으로
 * 0에 닿는다. 범위 밖 인덱스·비어 있는 목록·NaN은 전부 0: 흐림은 없는 게 기본이다.
 */
export function messageBlurPx(indexFromNewest: number, total: number, dim: number): number {
  if (!(total > 0) || !(indexFromNewest >= 0) || indexFromNewest >= total) return 0;
  const darkness = Number.isFinite(dim) ? Math.min(1, Math.max(0, dim)) : 0;
  if (darkness === 0) return 0;
  const falloff = Math.max(0, 1 - indexFromNewest / HAZE_DEPTH);
  // 소수 둘째 자리까지: 스타일 문자열이 매 렌더 미세하게 달라져 DOM을 흔드는 일을 막는다
  return Math.round(MAX_BLUR_PX * darkness * falloff * 100) / 100;
}
