/** 에셋 경로 상수 — 코드 곳곳에 경로 문자열을 산재시키지 않는다 (.claude/rules/assets.md). */
export const ASSETS = {
  models: {
    baseballBat: "/assets/models/ch1-baseball-bat.glb",
    baseball: "/assets/models/ch1-baseball.glb",
    radio: "/assets/models/ch1-radio.glb",
    /** 플레이어 아바타. 스켈레톤 없이 파트가 나뉘어 있어 모션은 코드가 만든다. */
    playerBlocky: "/assets/models/player-blocky.glb",
    /** 방 소품 (가구 모델). 전부 밑면이 y=0에 정렬돼 있다. */
    computerScreen: "/assets/models/room-computer-screen.glb",
    computerKeyboard: "/assets/models/room-computer-keyboard.glb",
    computerMouse: "/assets/models/room-computer-mouse.glb",
    deskLamp: "/assets/models/room-desk-lamp.glb",
    books: "/assets/models/room-books.glb",
    rug: "/assets/models/room-rug.glb",
    pottedPlant: "/assets/models/room-potted-plant.glb",
    pillow: "/assets/models/room-pillow.glb",
  },
  images: {
    /** 로딩 애니메이션 (420x400, 5프레임 gif). */
    uiLoading: "/assets/images/ui-loading.gif",
    mgBallCatchBall: "/assets/images/mg-ball-catch-ball.svg",
    mgBallCatchSunsetField: "/assets/images/mg-ball-catch-sunset-field.webp",
    mgBallCatchPitcher: "/assets/images/mg-ball-catch-pitcher.png",
    mgBallCatchBat: "/assets/images/mg-ball-catch-bat.png",
    mgBallCatchImpact: "/assets/images/mg-ball-catch-impact.png",
    /** 액자 사진 1차 — 부모 얼굴이 그늘에 묻힌 버전. Phase 1의 바탕, Phase 2의 덮개. */
    mgPhotoWipePhase1: "/assets/images/mg-photo-wipe-phase-1.webp",
    /** 액자 사진 2차 — 가족 얼굴이 드러난 버전. Phase 2에서 닦아내면 나온다. */
    mgPhotoWipePhase2: "/assets/images/mg-photo-wipe-phase-2.webp",
    /** 대사창 초상. 세 장 모두 같은 크롭이라 겹쳐서 opacity만 토글하면 정렬이 맞는다. */
    characterHeroNeutral: "/assets/images/character-hero-neutral.webp",
    characterHeroSmile: "/assets/images/character-hero-smile.webp",
    characterHeroSurprised: "/assets/images/character-hero-surprised.webp",
    characterHeroSheet: "/assets/images/character-hero-sheet.webp",
  },
} as const;
