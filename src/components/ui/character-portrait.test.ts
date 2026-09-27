import { describe, expect, it } from "vitest";
import {
  PORTRAIT_BASE_EXPRESSION,
  PORTRAIT_EXPRESSIONS,
  PORTRAIT_OVERLAY_EXPRESSIONS,
  PORTRAIT_SOURCES,
} from "./character-portrait";

describe("초상 프레임", () => {
  it("바닥 프레임은 오버레이에 포함되지 않는다. 바닥이 페이드되면 알파가 다시 꺼진다", () => {
    expect(PORTRAIT_OVERLAY_EXPRESSIONS).not.toContain(PORTRAIT_BASE_EXPRESSION);
    expect([PORTRAIT_BASE_EXPRESSION, ...PORTRAIT_OVERLAY_EXPRESSIONS].sort()).toEqual(
      [...PORTRAIT_EXPRESSIONS].sort(),
    );
  });

  it("모든 표정에 소스 경로가 있다", () => {
    for (const expression of PORTRAIT_EXPRESSIONS) {
      expect(PORTRAIT_SOURCES[expression]).toMatch(
        /^\/assets\/images\/character-hero-.+\.webp(?:\?v=\d+)?$/,
      );
    }
  });
});
