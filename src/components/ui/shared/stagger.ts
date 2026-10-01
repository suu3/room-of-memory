import type { CSSProperties } from "react";

/**
 * 목록 항목의 계단식 등장.
 *
 * 같은 순간에 전부 뜨는 목록은 "판이 바뀌었다"로 읽히고, 한 항목씩 놓이는 목록은
 * "누가 놓고 있다"로 읽힌다. 간격은 globals.css의 `.stagger-item`이 정하고(55ms),
 * 여기서는 몇 번째인지만 넘긴다. 모션을 끈 판에서는 간격 없이 밝기만 오른다.
 */
export const STAGGER_CLASS = "animate-stagger-rise stagger-item";

export function staggerStyle(index: number): CSSProperties {
  // 커스텀 속성은 CSSProperties 타입에 없어 캐스트한다 (RisingDust와 같은 사정)
  return { "--stagger-index": index } as CSSProperties;
}
