import type { CutsceneCut } from "@/types/interaction";

/** 페이지의 한 줄: 16:9 칸 하나(full), 또는 3:4 칸 둘(pair). 칸은 컷 순번으로 가리킨다. */
export type WebtoonRow =
  | { kind: "full"; indices: [number] }
  | { kind: "pair"; indices: [number, number] };

export interface WebtoonPage {
  page: number;
  rows: WebtoonRow[];
}

/** 페이지 폭의 상한(px): 넓은 화면에서도 웹툰 한 장의 폭을 넘지 않는다. */
export const PAGE_MAX_WIDTH = 900;

/**
 * 컷들을 페이지와 줄로 묶는다. 페이지 없는 컷(웹툰 뒤의 한마디)은 빠진다.
 * 3:4 칸은 이어진 둘이 한 줄이다. 짝이 없으면 혼자 한 줄에 선다 (검증이 먼저 막는다).
 */
export function buildWebtoonPages(cuts: readonly CutsceneCut[]): WebtoonPage[] {
  const pages: WebtoonPage[] = [];
  let pendingTall: number | null = null;
  const flushTall = (page: WebtoonPage | undefined) => {
    if (pendingTall === null || !page) return;
    page.rows.push({ kind: "full", indices: [pendingTall] });
    pendingTall = null;
  };
  for (const [index, cut] of cuts.entries()) {
    if (cut.page === undefined) continue;
    let page = pages.at(-1);
    if (page?.page !== cut.page) {
      flushTall(page);
      page = { page: cut.page, rows: [] };
      pages.push(page);
    }
    if (cut.ratio === "3:4") {
      if (pendingTall === null) {
        pendingTall = index;
      } else {
        page.rows.push({ kind: "pair", indices: [pendingTall, index] });
        pendingTall = null;
      }
    } else {
      flushTall(page);
      page.rows.push({ kind: "full", indices: [index] });
    }
  }
  flushTall(pages.at(-1));
  return pages;
}

/** 화면 폭에 따른 칸 간격(px): 모바일(640px 미만)은 12, 그 위는 24. */
export function pageGap(viewport: { width: number }): number {
  return viewport.width < 640 ? 12 : 24;
}

/** 칸 아래로 걸치는 말풍선 몫의 상한(px): 가장 큰 글자(20px) × 2.6em. */
const MAX_BUBBLE_OVERHANG = 52;

/**
 * 페이지 폭(px). 페이지 전체를 화면 높이에 맞춰 줄이지 않는다: 한 화면에 다 넣으면
 * 데스크톱에서 폭이 400px 안팎으로 쪼그라들어 그림이 안 읽힌다. 대신 칸을 따라 화면이
 * 내려간다 (pagePosition). 데스크톱은 900px, 모바일은 여백 없이 화면 폭이 상한이다.
 *
 * 다만 **줄 하나**는 화면에 통째로 들어야 한다. 가로로 든 폰(812×375)에서 폭만 보고
 * 잡으면 3:4 두 칸 줄이 490px로 화면보다 커서 칸의 위아래가 잘린다. 높이가 주어지면
 * 가장 높은 줄(3:4 두 칸)과 말풍선이 들어가는 폭까지만 쓴다.
 */
export function pageWidth(viewport: { width: number; height?: number }): number {
  const gap = pageGap(viewport);
  const sidePad = viewport.width < 640 ? 0 : gap;
  let width = Math.min(PAGE_MAX_WIDTH, viewport.width - sidePad * 2);
  if (viewport.height !== undefined) {
    // 3:4 두 칸 줄의 높이는 (폭 − 간격) × 2/3. 위아래 간격과 말풍선 몫을 뺀 높이에 맞춘다
    const room = viewport.height - gap * 2 - MAX_BUBBLE_OVERHANG;
    width = Math.min(width, room * 1.5 + gap);
  }
  return Math.max(0, Math.floor(width));
}

/** 줄마다의 위치와 높이(px), 페이지 전체 높이. 16:9 줄은 폭×9/16, 3:4 두 칸 줄은 (폭−간격)/2×4/3. */
export function rowMetrics(rows: readonly WebtoonRow[], width: number, gap: number) {
  const heights = rows.map((row) =>
    row.kind === "full" ? (width * 9) / 16 : (((width - gap) / 2) * 4) / 3,
  );
  const tops: number[] = [];
  let y = 0;
  for (const height of heights) {
    tops.push(y);
    y += height + gap;
  }
  return { tops, heights, total: Math.max(0, y - gap) };
}

/**
 * 페이지를 화면에 세우는 세로 위치(px, 화면 위에서 페이지 위까지).
 *
 * 한 화면에 다 들면 가운데 세운다. 넘치면 지금 칸이 있는 줄이 화면 가운데 오도록
 * 끌어올리되, 페이지 위아래 끝(말풍선이 칸 아래로 걸치는 자리 포함)을 넘어 비우지 않는다.
 */
export function pagePosition({
  rows,
  width,
  gap,
  viewportHeight,
  focusRow,
  overhang,
}: {
  rows: readonly WebtoonRow[];
  width: number;
  gap: number;
  viewportHeight: number;
  /** 지금 칸이 든 줄. */
  focusRow: number;
  /** 마지막 줄 아래로 걸치는 말풍선 몫(px). */
  overhang: number;
}): number {
  const { tops, heights, total } = rowMetrics(rows, width, gap);
  const extent = total + overhang;
  if (extent + gap * 2 <= viewportHeight) return (viewportHeight - extent) / 2;
  const row = Math.min(Math.max(focusRow, 0), rows.length - 1);
  const center = (tops[row] ?? 0) + (heights[row] ?? 0) / 2 + overhang / 2;
  const top = viewportHeight / 2 - center;
  const highest = viewportHeight - gap - extent;
  return Math.min(gap, Math.max(highest, top));
}
