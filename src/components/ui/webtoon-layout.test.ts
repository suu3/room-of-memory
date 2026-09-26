import { describe, expect, it } from "vitest";
import { CUTSCENES } from "@/data/memory-room";
import {
  buildWebtoonPages,
  PAGE_MAX_WIDTH,
  pageGap,
  pagePosition,
  pageWidth,
  rowMetrics,
} from "./webtoon-layout";

const survivor = CUTSCENES["survivor-broadcast"].cuts;
const pages = buildWebtoonPages(survivor);

describe("생존자 방송 웹툰의 페이지", () => {
  it("3페이지 10칸이 정해진 줄 모양으로 묶인다", () => {
    expect(pages.map((page) => page.rows.map((row) => row.kind))).toEqual([
      ["full", "pair", "full"],
      ["pair", "full"],
      ["full", "pair"],
    ]);
    expect(pages.flatMap((page) => page.rows.flatMap((row) => row.indices))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it("웹툰 뒤의 한마디(페이지 없는 컷)는 페이지에 들지 않는다", () => {
    expect(survivor.at(-1)?.page).toBeUndefined();
    expect(survivor.at(-1)?.lines.length).toBe(1);
  });

  it("폭은 화면 높이에 묶이지 않는다: 데스크톱 900px, 모바일은 화면 폭", () => {
    expect(pageWidth({ width: 1440 })).toBe(PAGE_MAX_WIDTH);
    expect(pageWidth({ width: 375 })).toBe(375);
    expect(pageWidth({ width: 375, height: 667 })).toBe(375);
    expect(pageWidth({ width: 1440, height: 900 })).toBe(PAGE_MAX_WIDTH);
  });

  it("가로로 든 폰에서는 가장 높은 줄(3:4 두 칸)이 화면 높이 안에 든다", () => {
    const viewport = { width: 812, height: 375 };
    const width = pageWidth(viewport);
    const gap = pageGap(viewport);
    const pair = rowMetrics([{ kind: "pair", indices: [0, 1] }], width, gap).total;
    expect(width).toBeLessThan(812);
    expect(pair + gap * 2 + 52).toBeLessThanOrEqual(viewport.height);
  });

  it.each([
    ["모바일 세로", { width: 375, height: 667 }],
    ["데스크톱", { width: 1440, height: 900 }],
    ["낮은 노트북", { width: 1280, height: 720 }],
  ])("%s에서 지금 칸이 든 줄이 화면 안에 선다", (_, viewport) => {
    const width = pageWidth(viewport);
    const gap = pageGap(viewport);
    const overhang = 40;
    for (const page of pages) {
      const { tops, heights, total } = rowMetrics(page.rows, width, gap);
      for (const [row] of page.rows.entries()) {
        const top = pagePosition({
          rows: page.rows,
          width,
          gap,
          viewportHeight: viewport.height,
          focusRow: row,
          overhang,
        });
        const rowTop = top + (tops[row] ?? 0);
        const rowBottom = rowTop + (heights[row] ?? 0);
        // 줄이 화면보다 크지 않으면 통째로 보인다
        if ((heights[row] ?? 0) + gap * 2 <= viewport.height) {
          expect(rowTop).toBeGreaterThanOrEqual(0);
          expect(rowBottom).toBeLessThanOrEqual(viewport.height);
        }
        // 페이지 위아래 끝을 넘어 비우지 않는다
        expect(top).toBeLessThanOrEqual(Math.max(gap, (viewport.height - total - overhang) / 2));
        expect(top + total + overhang).toBeGreaterThanOrEqual(
          Math.min(viewport.height - gap, (viewport.height + total + overhang) / 2) - 0.001,
        );
      }
    }
  });
});
