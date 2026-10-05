/**
 * 따라다니는 카메라의 목표점을 벽에서 얼마나 안쪽으로 붙들어 둘 것인가.
 *
 * 플레이어가 방 모서리에 붙으면 화면 아래쪽에 방 바깥(받침·배경)이 크게 들어오므로, 목표점을
 * 방 안쪽으로 붙들어 둔다. 카메라는 여전히 플레이어 쪽으로 따라가되 모서리에서만 조금 덜
 * 따라간다.
 *
 * 그 여유는 화면이 담는 폭에 맞춰야 한다. 넓은 화면(가로 9유닛 이상)의 1.6을 폭 5.6유닛짜리
 * 폰에 그대로 쓰면, 목표점이 벽에서 1.6 떨어진 채로 화면 반폭이 2.8뿐이라 벽에 붙은 물건이
 * 전부 화면 가장자리로 밀린다. 현관 구석의 배트와 현관문이 오른쪽 끝 "기억수집" 탭 밑에
 * 깔려 눌리지 않았고, 책상·협탁·신발장도 같은 이유로 잘렸다 (2026-10-05 플레이 테스트).
 */
export const FOLLOW_INSET = { narrow: 0.65, wide: 1.6 } as const;
/** 이 폭(월드 유닛) 이하면 좁은 화면의 여유를, 이상이면 넓은 화면의 여유를 쓴다. 사이는 잇는다. */
const VIEW_WIDTH = { narrow: 5.6, wide: 9 } as const;

/** 화면이 가로로 담는 월드 유닛에서 여유를 낸다. */
export function followInsetFor(viewWidthUnits: number): number {
  if (!Number.isFinite(viewWidthUnits)) return FOLLOW_INSET.wide;
  const t = (viewWidthUnits - VIEW_WIDTH.narrow) / (VIEW_WIDTH.wide - VIEW_WIDTH.narrow);
  const clamped = Math.min(1, Math.max(0, t));
  return FOLLOW_INSET.narrow + (FOLLOW_INSET.wide - FOLLOW_INSET.narrow) * clamped;
}
