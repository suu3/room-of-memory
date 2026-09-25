import { describe, expect, it } from "vitest";
import {
  MOUTH_OPEN_EXPRESSION,
  PORTRAIT_BASE_EXPRESSION,
  PORTRAIT_EXPRESSIONS,
  PORTRAIT_OVERLAY_EXPRESSIONS,
  PORTRAIT_SOURCES,
  portraitExpressionOf,
} from "./character-portrait";

describe("portraitExpressionOf", () => {
  it("타이핑이 끝나면 대사가 지정한 표정으로 고정된다", () => {
    for (const expression of PORTRAIT_EXPRESSIONS) {
      expect(portraitExpressionOf(expression, false)).toBe(expression);
    }
  });

  it("말하는 동안에는 표정과 무관하게 입 열린 프레임을 든다", () => {
    for (const expression of PORTRAIT_EXPRESSIONS) {
      expect(portraitExpressionOf(expression, true)).toBe(MOUTH_OPEN_EXPRESSION);
    }
  });

  it("대사 한 줄에 전환은 한 번뿐이다. 같은 입력이면 결과가 바뀌지 않는다", () => {
    expect(portraitExpressionOf("smile", true)).toBe(portraitExpressionOf("smile", true));
    expect(portraitExpressionOf("smile", false)).toBe("smile");
  });

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
