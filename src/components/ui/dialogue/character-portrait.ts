import { ASSETS } from "@/lib/assets";
import type { CharacterExpression } from "@/types/interaction";
import type { CharacterId } from "@/types/scenario";

/**
 * 초상이 있는 화자. 라디오 너머의 목소리처럼 얼굴이 없는 화자는 대사창만 쓴다.
 * 정체를 모른다는 것이 그 인물의 전부라 아무 얼굴도 붙이면 안 된다.
 */
const PORTRAIT_SPEAKERS: readonly CharacterId[] = ["hero"];

export function hasPortrait(speaker: CharacterId): boolean {
  return PORTRAIT_SPEAKERS.includes(speaker);
}

/** 전부 같은 크롭이라 겹쳐두고 opacity만 토글하면 정렬이 맞는다. */
export const PORTRAIT_SOURCES: Record<CharacterExpression, string> = {
  neutral: ASSETS.images.characterHeroNeutral,
  smile: ASSETS.images.characterHeroSmile,
  surprised: ASSETS.images.characterHeroSurprised,
  sad: ASSETS.images.characterHeroSad,
  puzzled: ASSETS.images.characterHeroPuzzled,
};

export const PORTRAIT_EXPRESSIONS = Object.keys(PORTRAIT_SOURCES) as CharacterExpression[];

/**
 * 항상 불투명하게 깔아두는 바닥 프레임.
 *
 * 표정끼리 서로 교차 페이드시키면 배경이 투명한 탓에 전환 한가운데서 합성 알파가
 * 0.5 + 0.5 × (1 − 0.5) = 0.75로 떨어진다. 캐릭터가 잠깐 비쳐 보이는 게 깜빡임의 정체다.
 * 바닥 한 장을 늘 채워두면 합성 알파가 1로 유지되고, 위에서 표정만 갈린다.
 */
export const PORTRAIT_BASE_EXPRESSION: CharacterExpression = "neutral";

/** 바닥 위에 얹어 페이드시키는 프레임들. */
export const PORTRAIT_OVERLAY_EXPRESSIONS = PORTRAIT_EXPRESSIONS.filter(
  (expression) => expression !== PORTRAIT_BASE_EXPRESSION,
);
