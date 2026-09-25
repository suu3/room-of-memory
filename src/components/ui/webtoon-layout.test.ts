import { describe, expect, it } from "vitest";
import { CUTSCENES } from "@/data/memory-room";
import { buildWebtoonPages, fitPageWidth, PAGE_MAX_WIDTH } from "./webtoon-layout";

const survivor = CUTSCENES["survivor-broadcast"].cuts;
const pages = buildWebtoonPages(survivor);

/** 페이지 높이(px): 16:9 줄은 폭×9/16, 3:4 두 칸 줄은 (폭−간격)/2×4/3, 줄 사이 간격. */
function pageHeight(rows: (typeof pages)[number]["rows"], width: number, gap: number) {
  const heights = rows.map((row) =>
    row.kind === "full" ? (width * 9) / 16 : (((width - gap) / 2) * 4) / 3,
  );
  return heights.reduce((sum, each) => sum + each, 0) + (rows.length - 1) * gap;
}

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

  it.each([
    ["모바일 세로", { width: 375, height: 667 }],
    ["모바일 긴 세로", { width: 390, height: 844 }],
    ["데스크톱", { width: 1440, height: 900 }],
    ["낮은 노트북", { width: 1280, height: 720 }],
  ])("%s에서 모든 페이지가 스크롤 없이 한 화면에 든다", (_, viewport) => {
    const width = fitPageWidth(pages, viewport);
    const gap = viewport.width < 640 ? 12 : 24;
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(Math.min(PAGE_MAX_WIDTH, viewport.width));
    for (const page of pages) {
      expect(pageHeight(page.rows, width, gap)).toBeLessThanOrEqual(viewport.height - gap * 2);
    }
  });
});
