/**
 * 만화책 한 쪽의 칸 나누기 (선반의 거꾸로 꽂힌 책, inspect-objects의 paintMangaPage).
 *
 * 읽을 그림이 아니라 "만화 칸이 있다"는 결만 낸다. 좌표는 본문 영역을 0~1로 본 값이라
 * 면 해상도를 모른다. 쪽 번호에서 정해져 늘 같다 (리렌더에 흔들리지 않는다).
 */

/** 칸 안에 무엇을 놓는가: 인물 실루엣 · 집중선 · 톤 깔린 배경. */
export type MangaPanelKind = "figure" | "speed" | "tone";

export type MangaPanel = {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: MangaPanelKind;
  /** 말풍선이 붙는가. */
  bubble: boolean;
};

const ROWS = 3;
/** 칸 사이 홈통. */
const GUTTER = 0.035;
const KINDS: readonly MangaPanelKind[] = ["figure", "speed", "tone"];

/** 쪽 번호와 자리에서 나오는 0~1 값. */
function seedOf(pageNumber: number, slot: number): number {
  return Math.sin(pageNumber * 7.1 + slot * 3.3) * 0.5 + 0.5;
}

/** 그 쪽의 칸들. 세 단이고, 단마다 한 칸이거나 좌우 두 칸이다. */
export function mangaPanels(pageNumber: number): MangaPanel[] {
  const weights = Array.from({ length: ROWS }, (_, row) => 0.8 + seedOf(pageNumber, row) * 0.7);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const usable = 1 - GUTTER * (ROWS - 1);
  const panels: MangaPanel[] = [];
  let y = 0;
  weights.forEach((weight, row) => {
    const height = (weight / total) * usable;
    const pick = (slot: number) => {
      const seed = seedOf(pageNumber, 10 + row * 4 + slot);
      return {
        kind: KINDS[Math.floor(seed * KINDS.length) % KINDS.length],
        bubble: seedOf(pageNumber, 30 + row * 4 + slot) > 0.4,
      };
    };
    const split = seedOf(pageNumber, 20 + row);
    if (split < 0.3) {
      panels.push({ x: 0, y, width: 1, height, ...pick(0) });
    } else {
      const left = 0.36 + ((split - 0.3) / 0.7) * 0.28 - GUTTER / 2;
      panels.push({ x: 0, y, width: left, height, ...pick(0) });
      panels.push({ x: left + GUTTER, y, width: 1 - left - GUTTER, height, ...pick(1) });
    }
    y += height + GUTTER;
  });
  return panels;
}
