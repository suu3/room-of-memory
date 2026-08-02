/** 에셋 경로 상수 — 코드 곳곳에 경로 문자열을 산재시키지 않는다 (.claude/rules/assets.md). */
export const ASSETS = {
  models: {
    baseballBat: "/assets/models/ch1-baseball-bat.glb",
    baseball: "/assets/models/ch1-baseball.glb",
    photoFrame: "/assets/models/ch1-photo-frame.glb",
  },
  images: {
    /** 로딩 애니메이션 (420x400, 5프레임 gif). */
    uiLoading: "/assets/images/ui-loading.gif",
    mgBallCatchBall: "/assets/images/mg-ball-catch-ball.svg",
    mgBallCatchSunsetField: "/assets/images/mg-ball-catch-sunset-field.webp",
    mgBallCatchPitcher: "/assets/images/mg-ball-catch-pitcher.png",
    mgBallCatchBat: "/assets/images/mg-ball-catch-bat.png",
    mgBallCatchImpact: "/assets/images/mg-ball-catch-impact.png",
    /** 대사창 초상. 세 장 모두 같은 크롭이라 겹쳐서 opacity만 토글하면 정렬이 맞는다. */
    characterHeroNeutral: "/assets/images/character-hero-neutral.webp",
    characterHeroSmile: "/assets/images/character-hero-smile.webp",
    characterHeroSurprised: "/assets/images/character-hero-surprised.webp",
    characterHeroSheet: "/assets/images/character-hero-sheet.webp",
  },
} as const;
