import type { VoiceId } from "@/lib/audio/voices";

/** 에셋 경로 상수 — 코드 곳곳에 경로 문자열을 산재시키지 않는다 (.claude/rules/assets.md). */
export const ASSETS = {
  models: {
    baseballBat: "/assets/models/ch1-baseball-bat.glb",
    baseball: "/assets/models/ch1-baseball.glb",
    radio: "/assets/models/ch1-radio.glb",
    /** 러그 위 게임패드 (사용자 제공, Meshopt 압축). 원본은 세워진 자세(앞면 +z, 밑면 y=0)라 씬에서 눕힌다. */
    gamepad: "/assets/models/ch1-gamepad.glb",
    /**
     * 침대 위 스마트폰 (사용자 제공, Meshopt 압축). 세워진 자세(화면 +z, 밑면 y=0)라 씬에서
     * 눕힌다. 화면 메쉬에는 재질이 안 붙어 있어 코드가 입힌다 (MemoryObjects의 MODEL_MATERIALS).
     */
    smartphone: "/assets/models/ch1-smartphone.glb",
    /** 본·애니메이션 포함. 모델 교체 시 v도 변경해 기존 SW 캐시와 분리한다. */
    playerBlocky: "/assets/models/player-blocky.glb?v=backed80-20260907",
    /** 방 소품 (가구 모델). 전부 밑면이 y=0에 정렬돼 있다. */
    computerScreen: "/assets/models/room-computer-screen.glb",
    computerKeyboard: "/assets/models/room-computer-keyboard.glb",
    computerMouse: "/assets/models/room-computer-mouse.glb",
    deskLamp: "/assets/models/room-desk-lamp.glb",
    books: "/assets/models/room-books.glb",
    rug: "/assets/models/room-rug.glb",
    pottedPlant: "/assets/models/room-potted-plant.glb",
    pillow: "/assets/models/room-pillow.glb",
    /** 거실 소파 옆 토끼 인형 (사용자 제공, Meshopt 압축). 밑면이 y=0에 맞춰져 있다. */
    rabbitDoll: "/assets/models/rabbit-doll.glb?v=fix-20260906",
  },
  images: {
    /** 로딩 애니메이션 (420x400, 5프레임 gif). */
    uiLoading: "/assets/images/ui-loading.gif",
    mgBallCatchBall: "/assets/images/mg-ball-catch-ball.svg",
    mgBallCatchSunsetField: "/assets/images/mg-ball-catch-sunset-field.webp",
    mgBallCatchPitcher: "/assets/images/mg-ball-catch-pitcher.webp",
    mgBallCatchBat: "/assets/images/mg-ball-catch-bat.webp",
    mgBallCatchImpact: "/assets/images/mg-ball-catch-impact.webp",
    /**
     * 라디오 본체 일러스트 (1598×1174). 바깥 배경과 표시창이 알파로 뚫려 있어
     * 다이얼을 뒤에 깔고 이 이미지를 위에 얹으면 창 안에 든 것처럼 보인다.
     * 창 좌표는 src/minigames/frequency-tune/index.tsx의 DIAL_WINDOW.
     */
    mgFrequencyTuneFrame: "/assets/images/mg-frequency-tune-frame.webp",
    /** 커튼을 걷었을 때 보이는 창밖 (1448×1086). 그날 이후의 도시가 그려져 있다. */
    mgWindowViewOutside: "/assets/images/mg-window-view-outside.webp",
    /**
     * 서랍에서 꺼낸 쪽지의 종이 판 (640×400 SVG). 글씨는 없다 — 본문은 i18n을
     * 타야 해서 DOM이 위에 얹는다 (ClueOverlay). 늘려 쓰므로 비율이 크게
     * 어긋나지 않는 판에만 깐다.
     */
    clueNotePaper: "/assets/images/clue-note-paper.svg",
    /*
     * 격투 미니게임 스프라이트. 아직 리포에 없어도 된다 — 파일이 없으면
     * 블록 캐릭터/그라디언트 배경으로 떨어진다. 시트 규격은
     * src/minigames/fighter-duel/sprites.ts 주석 참고
     * (7프레임 가로 시트, 1568×320 — idle·strike·guard·throw·hurt·ko·win).
     */
    mgFighterDuelHero: "/assets/images/mg-fighter-duel-hero.webp",
    mgFighterDuelRival: "/assets/images/mg-fighter-duel-rival.webp",
    /** 격투 미니게임 무대 배경 (960×256). 없으면 CSS 그라디언트가 그대로 보인다. */
    mgFighterDuelStage: "/assets/images/mg-fighter-duel-stage.webp",
    /*
     * 달력 장 그림 (7~11월). 아직 리포에 없어도 된다 — 파일이 없으면 코드가 그리는
     * 날짜 격자·正자 장이 그대로 선다 (src/minigames/calendar-flip).
     *
     * 규격: 세로로 긴 한 장(권장 3:4 안팎, 잘리지 않게 판에 맞춰 들어간다).
     * 요일 배치는 CALENDAR_YEAR(2026) 기준으로 그릴 것 — 코드가 그리는 대체 장이
     * 같은 해로 격자를 만들기 때문에 해가 어긋나면 둘이 다른 달력이 된다.
     */
    mgCalendarFlipPages: {
      7: "/assets/images/mg-calendar-flip-07.webp",
      8: "/assets/images/mg-calendar-flip-08.webp",
      9: "/assets/images/mg-calendar-flip-09.webp",
      10: "/assets/images/mg-calendar-flip-10.webp",
      11: "/assets/images/mg-calendar-flip-11.webp",
    } as Partial<Record<number, string>>,
    /** 액자 사진 1차 — 부모 얼굴이 그늘에 묻힌 버전. Phase 1의 바탕, Phase 2의 덮개. */
    mgPhotoWipePhase1: "/assets/images/mg-photo-wipe-phase-1.webp",
    /** 액자 사진 2차 — 가족 얼굴이 드러난 버전. Phase 2에서 닦아내면 나온다. */
    mgPhotoWipePhase2: "/assets/images/mg-photo-wipe-phase-2.webp",
    /*
     * 전환 컷씬 일러스트 3컷. 게임을 통틀어 그림이 화면을 통째로 차지하는 유일한
     * 자리라, 파일이 아직 없어도 컷씬은 돌아간다 — 없으면 회색 판이 대신 서고
     * 대사만 흐른다 (src/components/ui/Cutscene.tsx).
     */
    cutsceneRadioRoom: "/assets/images/cutscene-radio-room.webp",
    cutsceneRadioHands: "/assets/images/cutscene-radio-hands.webp",
    cutsceneRadioSignal: "/assets/images/cutscene-radio-signal.webp",
    /** 대사창 초상. 전부 같은 크롭이라 겹쳐서 opacity만 토글하면 정렬이 맞는다. */
    characterHeroNeutral: "/assets/images/character-hero-neutral.webp",
    characterHeroSmile: "/assets/images/character-hero-smile.webp",
    characterHeroSurprised: "/assets/images/character-hero-surprised.webp",
    characterHeroEmbarrassed: "/assets/images/character-hero-embarrassed.webp",
    characterHeroSheet: "/assets/images/character-hero-sheet.webp",
  },
  /**
   * 바퀴마다 한 곡. 값은 **후보 목록**이고 앞에서부터 받아 처음 성공한 것을 튼다
   * (music.ts의 startMusic) — 아직 리포에 없는 곡을 앞에 세워 둬도 방이 조용해지지
   * 않는다. 규격과 고르는 기준은 docs/content-design.md 8-1.
   */
  bgm: {
    /**
     * 1바퀴 — 발랄한 일상 곡. 조사할수록 컷오프가 닫히고 리버브가 늘며 열화되어
     * 라디오 직전에는 거의 정적에 닿는다 (src/lib/audio/music-curve.ts).
     *
     * daylight가 들어와 있으므로 실제로 도는 건 첫 줄이다. 뒤에 선 winter-morning은
     * modern classical 솔로 피아노라 톤이 다르다 — daylight를 못 받았을 때만 서는
     * 자리 지킴이로 남겨 둔다.
     */
    room: [
      "/assets/audio/bgm/bgm-room-daylight.ogg",
      "/assets/audio/bgm/bgm-room-winter-morning.ogg",
    ],
    /**
     * 2바퀴 — 컷씬의 정적을 지나 새로 드는 따뜻한 곡. 대신 설 곡이 없어서 이 파일을
     * 못 받으면 1바퀴 곡이 그대로 이어진다.
     */
    roomSecondLight: ["/assets/audio/bgm/bgm-room-second-light.ogg"],
  },
  /**
   * 파일로 대신할 효과음. 여기 없는 보이스는 전부 합성이다(src/lib/audio/voices.ts).
   *
   * 스프라이트 시트와 같이 "아직 리포에 없어도 되는" 목록이다 — 파일이 없으면
   * 합성 보이스가 그대로 울린다 (src/lib/audio/samples.ts).
   */
  sfx: {
    /**
     * 배트가 공을 맞히는 순간. 나무가 쪼개지는 크랙은 오실레이터로 끝까지 못 간다 —
     * 이 목록에 파일이 필요한 소리가 하나뿐인 이유이자, 그 하나인 이유.
     * 넣을 때 규격: mp3/ogg, 500KB 이하 (.claude/rules/assets.md).
     */
    batHit: "/assets/audio/sfx/mg-ball-catch-bat-hit.mp3",
  } as Partial<Record<VoiceId, string>>,
} as const;
