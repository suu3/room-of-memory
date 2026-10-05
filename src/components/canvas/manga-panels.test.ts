import { describe, expect, it } from "vitest";
import { mangaPanels } from "./manga-panels";

describe("mangaPanels", () => {
  const pages = Array.from({ length: 8 }, (_, index) => index + 1);

  it("같은 쪽은 늘 같은 칸으로 나뉜다", () => {
    expect(mangaPanels(5)).toEqual(mangaPanels(5));
  });

  it("쪽마다 칸 나누기가 다르다", () => {
    const layouts = new Set(pages.map((page) => JSON.stringify(mangaPanels(page))));
    expect(layouts.size).toBe(pages.length);
  });

  it("칸은 본문 영역 안에 있고 서로 겹치지 않는다", () => {
    for (const page of pages) {
      const panels = mangaPanels(page);
      expect(panels.length).toBeGreaterThanOrEqual(3);
      expect(panels.length).toBeLessThanOrEqual(6);
      for (const panel of panels) {
        expect(panel.x).toBeGreaterThanOrEqual(0);
        expect(panel.y).toBeGreaterThanOrEqual(0);
        expect(panel.x + panel.width).toBeLessThanOrEqual(1 + 1e-9);
        expect(panel.y + panel.height).toBeLessThanOrEqual(1 + 1e-9);
        // 너무 가는 칸은 그림이 아니라 줄로 보인다
        expect(panel.width).toBeGreaterThan(0.25);
        expect(panel.height).toBeGreaterThan(0.15);
      }
      panels.forEach((a, i) => {
        for (const b of panels.slice(i + 1)) {
          const apart =
            a.x + a.width <= b.x + 1e-9 ||
            b.x + b.width <= a.x + 1e-9 ||
            a.y + a.height <= b.y + 1e-9 ||
            b.y + b.height <= a.y + 1e-9;
          expect(apart).toBe(true);
        }
      });
    }
  });
});
