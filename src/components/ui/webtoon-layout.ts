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

/**
 * 모든 페이지가 세로 스크롤 없이 한 화면에 들어오는 페이지 폭(px).
 *
 * 16:9 줄의 높이는 폭 × 9/16, 3:4 두 칸 줄은 (폭 − 간격)/2 × 4/3이다. 줄 사이 간격을
 * 더한 높이가 화면 높이(위아래 여백 뺀)를 넘지 않는 가장 넓은 폭을 고르고, 가장 긴
 * 페이지에 맞춰 모든 페이지가 같은 폭을 쓴다. 넘길 때 폭이 들쭉날쭉하면 책이 아니다.
 * 데스크톱은 900px, 모바일(640px 미만)은 여백 없이 화면 폭이 상한이다.
 */
export function fitPageWidth(
  pages: readonly WebtoonPage[],
  viewport: { width: number; height: number },
): number {
  const mobile = viewport.width < 640;
  const gap = mobile ? 12 : 24;
  const sidePad = mobile ? 0 : gap;
  const availableHeight = viewport.height - gap * 2;
  let width = Math.min(PAGE_MAX_WIDTH, viewport.width - sidePad * 2);
  for (const page of pages) {
    const fulls = page.rows.filter((row) => row.kind === "full").length;
    const pairs = page.rows.length - fulls;
    const perWidth = fulls * (9 / 16) + pairs * (2 / 3);
    if (perWidth === 0) continue;
    const fixed = (page.rows.length - 1) * gap - pairs * (2 / 3) * gap;
    width = Math.min(width, (availableHeight - fixed) / perWidth);
  }
  return Math.max(0, Math.floor(width));
}
