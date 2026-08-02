import { ASSETS } from "@/lib/assets";
import type { CharacterExpression } from "@/types/interaction";

/** 세 장 모두 같은 크롭이라 겹쳐두고 opacity만 토글하면 정렬이 맞는다. */
export const PORTRAIT_SOURCES: Record<CharacterExpression, string> = {
  neutral: ASSETS.images.characterHeroNeutral,
  smile: ASSETS.images.characterHeroSmile,
  surprised: ASSETS.images.characterHeroSurprised,
};

export const PORTRAIT_EXPRESSIONS = Object.keys(PORTRAIT_SOURCES) as CharacterExpression[];

/**
 * 항상 불투명하게 깔아두는 바닥 프레임.
 *
 * 세 장을 서로 교차 페이드시키면 배경이 투명한 탓에 전환 한가운데서 합성 알파가
 * 0.5 + 0.5 × (1 − 0.5) = 0.75로 떨어진다. 캐릭터가 잠깐 비쳐 보이는 게 깜빡임의 정체다.
 * 바닥 한 장을 늘 채워두면 합성 알파가 1로 유지되고, 위에서 표정만 갈린다.
 */
export const PORTRAIT_BASE_EXPRESSION: CharacterExpression = "neutral";

/** 바닥 위에 얹어 페이드시키는 프레임들. */
export const PORTRAIT_OVERLAY_EXPRESSIONS = PORTRAIT_EXPRESSIONS.filter(
  (expression) => expression !== PORTRAIT_BASE_EXPRESSION,
);

/** 입이 열려 있는 유일한 프레임 — "말하는 중" 표시로 재사용한다. */
export const MOUTH_OPEN_EXPRESSION: CharacterExpression = "surprised";

/**
 * 말하는 동안은 입 열린 프레임을 그대로 들고 있다가, 다 찍히면 대사가 지정한 표정으로 넘어간다.
 * 프레임을 번갈아 돌리면(=립싱크) 화면이 깜빡여서, 대사 한 줄에 전환은 딱 한 번만 일어나게 한다.
 */
export function portraitExpressionOf(
  resting: CharacterExpression,
  talking: boolean,
): CharacterExpression {
  return talking ? MOUTH_OPEN_EXPRESSION : resting;
}
