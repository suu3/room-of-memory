import type { Locale } from "@/i18n/config";
import type { VoiceId } from "@/lib/audio/voices";

/** 에셋 경로 상수: 코드 곳곳에 경로 문자열을 산재시키지 않는다 (.claude/rules/assets.md). */
export const ASSETS = {
  models: {
    /** Blender로 제작한 야구부 생활 소품. scripts/assets/create-baseball-room-props.py */
    baseballJersey: "/assets/models/room-baseball-jersey.glb?v=20260914",
    /** 책장 위 야구 모자. 옆에 있던 글러브는 2026-09-15에 뺐다 (방 크기에서 덩어리로만 보였다). */
    baseballCap: "/assets/models/room-baseball-cap.glb?v=20260915",
    trainingKit: "/assets/models/room-training-kit.glb?v=20260914",
    studyTools: "/assets/models/room-study-tools.glb?v=20260914",
    teamPennant: "/assets/models/room-team-pennant.glb?v=20260914",
    /** Blender로 제작한 접힌 종이와 타원형 입구가 있는 각티슈. */
    tissueBox: "/assets/models/room-tissue-box.glb?v=20260913",
    /** 천장 부착형 실내기: 흡입 그릴·송풍 날개·센서 창. */
    ceilingAc: "/assets/models/room-ceiling-ac.glb?v=20260913",
    /**
     * 오른손으로 커튼을 당기는 모션. 플레이어 리그를
     * 바꾸면 scripts/assets/retarget-curtain-clips.mjs로 새 rest에 옮기고 v도 같이 올린다.
     */
    curtainPullTest: "/assets/models/curtain-pull-test.glb?v=tripo-20260915",
    /** 창을 바라볼 때 왼손으로 당기는 대칭 모션. */
    curtainPullLeft: "/assets/models/curtain-pull-left.glb?v=tripo-20260915",
    baseballBat: "/assets/models/ch1-baseball-bat.glb",
    baseball: "/assets/models/ch1-baseball.glb",
    /** 책상 위에 눕혀 놓는 A4 성적표. 재생성: scripts/assets/create-report-card.mjs. */
    reportCard: "/assets/models/ch1-report-card.glb?v=20260926",
    radio: "/assets/models/ch1-radio.glb?v=original-20260912",
    /** 러그 위 게임패드 (사용자 제공, Meshopt 압축). 원본은 세워진 자세(앞면 +z, 밑면 y=0)라 씬에서 눕힌다. */
    gamepad: "/assets/models/ch1-gamepad.glb",
    /**
     * 침대 위 스마트폰 (사용자 제공, Meshopt 압축). 세워진 자세(화면 +z, 밑면 y=0)라 씬에서
     * 눕힌다. 화면 메쉬에는 재질이 안 붙어 있어 코드가 입힌다 (MemoryObjects의 MODEL_MATERIALS).
     */
    smartphone: "/assets/models/ch1-smartphone.glb",
    /**
     * 플레이어 (Tripo 제작 chibi, 본·애니메이션·눈꺼풀 포함). 원본 FBX에서
     * scripts/assets/create-tripo-player.py로 굽는다. 모델 교체 시 v도 변경해 기존 SW 캐시와 분리한다.
     */
    playerBlocky: "/assets/models/player-blocky.glb?v=tripo-20260917-cloth",
    /** 직접 제작한 방 소품. 재생성: scripts/assets/create-original-furniture.mjs. 밑면 y=0. */
    computerScreen: "/assets/models/room-computer-screen.glb?v=original-20260912",
    computerKeyboard: "/assets/models/room-computer-keyboard.glb?v=original-20260912",
    computerMouse: "/assets/models/room-computer-mouse.glb?v=original-20260912",
    deskLamp: "/assets/models/room-desk-lamp.glb?v=original-20260912",
    books: "/assets/models/room-books.glb?v=original-20260912",
    /** 직접 제작한 고3 생활 소품. 재생성: scripts/assets/create-student-props.mjs */
    snackBag: "/assets/models/room-snack-bag.glb?v=20260910-flat",
    studyPapers: "/assets/models/room-study-papers.glb?v=20260910",
    cupNoodleTrash: "/assets/models/room-cup-noodle-trash.glb?v=20260910-upright2",
    studentBookshelf: "/assets/models/room-student-bookshelf.glb?v=no-labels-20260927",
    rug: "/assets/models/room-rug.glb?v=original-20260912",
    leafyPlant: "/assets/models/room-potted-plant.glb?v=original-20260912",
    /** 둥근 선인장과 도자기 화분. 재생성: scripts/assets/create-cactus.mjs */
    pottedPlant: "/assets/models/room-potted-cactus.glb?v=20260911",
    /**
     * 침대: 프레임·매트리스·베개·이불 한 모델 (사용자 제공, Meshopt 압축). 재질이 없어
     * 코드가 부품 노드 이름(frame·mattress·headboard·base·footboard·pillow·blanket)으로
     * 팔레트색을 입히고, 이불의 shape key `folded`로 접었다 편다. 실측·배치는
     * src/scenes/memory-room/world/bed.ts. 다시 내보내면 이름 규약을 지키고 ?v=를 올린다.
     */
    bed: "/assets/models/room-bed.glb",
    /**
     * 창 양쪽 커튼 천 두 장 (노드 left·right). 재생성: scripts/assets/create-curtain.mjs. 재질이 없어
     * 코드가 fabric을 입히고, 각 장의 shape key `open`으로 여닫는다 (이불의 folded와 같은
     * 방식). 규약·놓는 자리는 src/scenes/memory-room/rooms/room/curtain-model.ts. 블렌더 제작본으로
     * 바꾸면 같은 이름으로 내보내고 ?v=를 올린다.
     */
    curtain: "/assets/models/room-curtain.glb",
    /**
     * 거실 안방문 옆 벽의 토끼 인형 (사용자 제공, Meshopt 압축). 밑면이 y=0에 맞춰져 있고,
     * scripts/assets/recolor-rabbit-doll.mjs가 방의 clay·linen 팔레트를 밝게 섞어 입힌다.
     */
    rabbitDoll: "/assets/models/rabbit-doll.glb?v=light-palette-20260927",
    /** 거실 확장부의 오픈 키친. 재생성: scripts/assets/create-living-kitchen.mjs */
    livingKitchen: "/assets/models/living-kitchen.glb?v=l-shape-left-20261001",
    /** 라온생명과학연구소 RX-11 유리 바이알. 재생성: scripts/assets/create-ampoule.mjs */
    ampoule: "/assets/models/room-laon-ampoule.glb?v=2",
  },
  images: {
    /** 로딩 애니메이션 (420x400, 8프레임, 프레임당 140ms). */
    uiLoading: "/assets/images/ui-loading.gif?v=20260910-grounded-bounce",
    /**
     * 엔딩 카드의 "Thank you!" 그림 (1160×1533, 제작자가 그린 배트 든 도해). 흰 바탕이 그림의
     * 일부라 어두운 카드 위에 종이처럼 올린다. 카드의 "그림 저장"이 이 파일을 그대로 내려받는다.
     */
    endingThanks: "/assets/images/ui-ending-thanks.webp?v=2",
    /** 만든 사람 화면의 프로필 그림 (512×512, 제작자의 토끼 낙서). 둥글게 잘라 쓴다. */
    creatorAvatar: "/assets/images/ui-creator-avatar.webp",
    /** 지원사업 CI (경기청년 갭이어 흰색 가로형 워드마크, 720×120). 어두운 판 위에만 올린다. */
    gapYearLogo: "/assets/images/ui-gapyear-logo.webp",
    /** 라온생명과학연구소 공통 심볼. 출입증·앰플·컴퓨터 화면에서 같은 도형을 쓴다. */
    raonLogo: "/assets/images/ui-raon-logo.svg?v=2",
    /** 라디오 반전에서 번지는 '그날' 8연작 (분기점 과거편, content/cutscenes.yaml의 radio-blackout). */
    cutsceneDay1: "/assets/images/cutscene-day-1.webp?v=4",
    cutsceneDay2: "/assets/images/cutscene-day-2.webp?v=3",
    cutsceneDay3: "/assets/images/cutscene-day-3.webp?v=3",
    cutsceneDay4: "/assets/images/cutscene-day-4.webp?v=3",
    cutsceneDay5: "/assets/images/cutscene-day-5.webp?v=4",
    cutsceneDay6: "/assets/images/cutscene-day-6.webp?v=4",
    cutsceneDay7: "/assets/images/cutscene-day-7.webp?v=3",
    cutsceneDay8: "/assets/images/cutscene-day-8.webp",
    /** 생존자 방송 웹툰 10칸 (3페이지, content/cutscenes.yaml의 survivor-broadcast). */
    cutsceneSurvivor1: "/assets/images/cutscene-survivor-1.webp?v=2",
    cutsceneSurvivor2: "/assets/images/cutscene-survivor-2.webp?v=2",
    cutsceneSurvivor3: "/assets/images/cutscene-survivor-3.webp?v=3",
    cutsceneSurvivor4: "/assets/images/cutscene-survivor-4.webp?v=2",
    cutsceneSurvivor5: "/assets/images/cutscene-survivor-5.webp?v=2",
    cutsceneSurvivor6: "/assets/images/cutscene-survivor-6.webp?v=2",
    cutsceneSurvivor7: "/assets/images/cutscene-survivor-7.webp?v=2",
    cutsceneSurvivor8: "/assets/images/cutscene-survivor-8.webp?v=2",
    cutsceneSurvivor9: "/assets/images/cutscene-survivor-9.webp?v=2",
    cutsceneSurvivor10: "/assets/images/cutscene-survivor-10.webp?v=3",
    /** '뒤집으면 보인다' 조사 에셋. */
    mgIdCardFront: "/assets/images/mg-id-card-front.webp?v=4",
    mgIdCardBack: "/assets/images/mg-id-card-back.webp?v=4",
    mgAmpouleLabel: "/assets/images/mg-ampoule-label.webp",
    mgPapersPaper: "/assets/images/mg-papers-paper.webp",
    mgBallCatchBall: "/assets/images/mg-ball-catch-ball.svg?v=2",
    mgBallCatchSunsetField: "/assets/images/mg-ball-catch-sunset-field.webp?v=2",
    mgBallCatchPitcher: "/assets/images/mg-ball-catch-pitcher.webp?v=4",
    mgBallCatchBat: "/assets/images/mg-ball-catch-bat.webp?v=2",
    mgBallCatchImpact: "/assets/images/mg-ball-catch-impact.webp?v=3",
    /**
     * 라디오 본체 일러스트 (1597×1159). 바깥 배경과 표시창이 알파로 뚫려 있어
     * 다이얼을 뒤에 깔고 이 이미지를 위에 얹으면 창 안에 든 것처럼 보인다.
     * 창 좌표는 src/minigames/frequency-tune/index.tsx의 DIAL_WINDOW.
     */
    mgFrequencyTuneFrame: "/assets/images/mg-frequency-tune-frame.webp?v=cutout-20260928b",
    /** 커튼을 걷었을 때 보이는 창밖 (1448×1086). 그날 이후의 도시가 그려져 있다. */
    mgWindowViewOutside: "/assets/images/mg-window-view-outside.webp",
    /**
     * 서랍에서 꺼낸 쪽지의 종이 판 (640×400 SVG). 글씨는 없다. 본문은 i18n을
     * 타야 해서 DOM이 위에 얹는다 (ClueOverlay). 늘려 쓰므로 비율이 크게
     * 어긋나지 않는 판에만 깐다.
     */
    clueNotePaper: "/assets/images/clue-note-paper.svg",
    /*
     * 격투 미니게임 스프라이트. 아직 리포에 없어도 된다. 파일이 없으면
     * 블록 캐릭터/그라디언트 배경으로 떨어진다. 시트 규격은
     * src/minigames/fighter-duel/sprites.ts 주석 참고
     * (7프레임 가로 시트, 1568×320: idle·strike·guard·throw·hurt·ko·win).
     */
    mgFighterDuelHero: "/assets/images/mg-fighter-duel-hero.webp?v=cutout-20260928",
    mgFighterDuelRival: "/assets/images/mg-fighter-duel-rival.webp",
    /*
     * 달력 장 그림 (7~11월, 1080×1600). 빈 달력 그림이고 11월만 正자 낙서가 그려져 있다.
     * 전국대회 금빛 동그라미와 메모 점은 코드가 그림 위에 얹는다 (calendar-flip/PageImage).
     * 파일을 못 받으면 코드가 그리는 날짜 격자·正자 장이 대신 선다.
     *
     * 2026년 달력, 월요일 시작. 격자 자리는 calendar.ts의 PAGE_IMAGE와 맞물려 있어서
     * 그림을 새로 그리면 그 값도 같이 맞춘다. 같은 파일을 바꾸면 ?v=를 붙여 올린다.
     */
    mgCalendarFlipPages: {
      7: "/assets/images/mg-calendar-flip-07.webp",
      8: "/assets/images/mg-calendar-flip-08.webp",
      9: "/assets/images/mg-calendar-flip-09.webp",
      10: "/assets/images/mg-calendar-flip-10.webp",
      11: "/assets/images/mg-calendar-flip-11.webp",
    } as Partial<Record<number, string>>,
    /**
     * 액자 사진 1차: 부모 얼굴이 틀 밖으로 잘린 버전. Phase 1의 바탕, Phase 2의 덮개.
     * 그림을 갈아 끼우면 v도 바꾼다: 서비스 워커가 캐시를 먼저 읽어 옛 그림이 남는다.
     */
    mgPhotoWipePhase1: "/assets/images/mg-photo-wipe-phase-1.webp?v=20260912",
    /** 액자 사진 2차: 가족 얼굴이 드러난 버전. Phase 2에서 닦아내면 나온다. */
    mgPhotoWipePhase2: "/assets/images/mg-photo-wipe-phase-2.webp?v=20260912",
    /** 대사창 초상. 전부 같은 크롭이라 겹쳐서 opacity만 토글하면 정렬이 맞는다. */
    characterHeroNeutral: "/assets/images/character-hero-neutral.webp?v=3",
    characterHeroSmile: "/assets/images/character-hero-smile.webp?v=3",
    characterHeroSurprised: "/assets/images/character-hero-surprised.webp?v=3",
    characterHeroSad: "/assets/images/character-hero-sad.webp?v=1",
    characterHeroPuzzled: "/assets/images/character-hero-puzzled.webp?v=1",
    characterHeroSheet: "/assets/images/character-hero-sheet.webp?v=3",
  },
  /**
   * 웹 AR(/ar). 포토카드 앞면 그림을 MindAR가 알아보도록 컴파일한 타깃이다.
   * 카드 그림을 바꾸면 dev 서버의 /ar/compile에서 다시 굽고 v를 올린다.
   */
  ar: {
    target: "/assets/ar/ar-target-hero.mind?v=3",
  },
  /**
   * 엔딩 영상. 현관문을 열면 튼다 (EndingScreen). 1920×1080 H.264 3.5Mbps + AAC,
   * faststart라 받는 중에도 재생이 시작된다. 원본(.mov)은 리포에 넣지 않는다.
   */
  video: {
    endingFilm: "/assets/video/ending-film.mp4?v=20261002-closeup",
  },
  /**
   * 3D 씬의 면에 깔리는 그림. UI가 <img>로 읽는 images/와 갈라 둔다: 이쪽은
   * three의 TextureLoader가 읽고 조명·톤매핑을 통과해 화면에 닿는다.
   */
  textures: {
    /**
     * 책상 위 벽에 붙은 고교야구대회 포스터 (512×768, 사용자 제공). 방에서
     * 유일하게 그림이 실린 벽면이다. 2:3이라 가로만 2의 제곱이다: WebGL2는
     * 밉맵이 붙는 NPOT 텍스처를 그대로 받고, 비율을 맞추려 늘리면 포스터가
     * 찌그러진다 (.claude/rules/assets.md의 2048px·2MB 한도는 지킨다).
     */
    roomPosterBaseball: "/assets/textures/room-poster-baseball.webp",
  },
  /**
   * 바퀴마다 한 곡. 값은 **후보 목록**이고 앞에서부터 받아 처음 성공한 것을 튼다
   * (music.ts의 startMusic): 아직 리포에 없는 곡을 앞에 세워 둬도 방이 조용해지지
   * 않는다. 규격과 고르는 기준은 docs/story/content-design.md 8-1.
   */
  bgm: {
    /**
     * 타이틀: 게임에 들어가기 전의 적막한 솔로 피아노. 첫 클릭·키 입력에 차오르고
     * 게임에 들어가면 내려간다. 방 곡과 달리 밝기 곡선을 타지 않는다.
     */
    title: "/assets/audio/bgm/bgm-title-winter-morning.ogg",
    /**
     * 1바퀴: 발랄한 일상 곡. 조사할수록 컷오프가 닫히고 리버브가 늘며 열화되어
     * 라디오 직전에는 거의 정적에 닿는다 (src/lib/audio/music-curve.ts).
     */
    room: ["/assets/audio/bgm/bgm-room-daylight.ogg"],
    /**
     * 2바퀴: 컷씬의 정적을 지나 새로 드는 따뜻한 곡. 대신 설 곡이 없어서 이 파일을
     * 못 받으면 1바퀴 곡이 그대로 이어진다.
     */
    roomSecondLight: ["/assets/audio/bgm/bgm-room-second-light.ogg"],
    /**
     * 게임기(fighter-duel)를 켠 동안 방 곡 대신 드는 8비트 루프. 방 TV 스피커 소리로
     * 깎아 구웠다. 코드 합성이라 곡을 바꾸려면 scripts/assets/create-fighter-duel-chip.mjs를 고친다.
     */
    fighterDuel: "/assets/audio/bgm/mg-fighter-duel-chip.ogg",
  },
  /**
   * 파일로 대신할 효과음. 여기 없는 보이스는 전부 합성이다(src/lib/audio/voices.ts).
   *
   * 스프라이트 시트와 같이 "아직 리포에 없어도 되는" 목록이다. 파일이 없으면
   * 합성 보이스가 그대로 울린다 (src/lib/audio/samples.ts).
   */
  sfx: {
    /**
     * 클릭(select)과 뽁(open): 게임 내내 가장 자주 우는 두 소리라 합성음 대신 실물 UI음으로
     * 바꿨다. 클릭은 메뉴·버튼·물건 조사 전부, 뽁은 창·카드·수첩이 튀어나올 때다.
     * 둘 다 앞 무음을 자르고 소리 부분만 0.1~0.2초 남겼다.
     */
    select: "/assets/audio/sfx/sfx-ui-click.ogg",
    open: "/assets/audio/sfx/sfx-ui-pop.ogg",
    /** 컴퓨터 조사의 부팅 화면(약 2.8초)에 맞춰 원본 12초 중 앞 3.6초만, 끝은 페이드. */
    computerBoot: "/assets/audio/sfx/mg-computer-browse-boot.ogg",
    /**
     * 생존자 방송 첫 컷의 미트 소리. 포수 복선이라 가죽을 치는 실물 소리여야 한다.
     * 체육관 미트 영상(힉스필드)에서 두 번 치는 1.26초만 잘라 Opus로 담았다.
     */
    mittTap: "/assets/audio/sfx/sfx-mitt-tap.ogg",
    /**
     * 방문·안방·현관 문이 열리는 소리. 문 하나 열 때마다 새 공간이 열리는 순간이라
     * 합성 UI음(open)이 아니라 실물 경첩 소리로 낸다. 앞 무음을 자르고 Opus 모노로 담았다.
     */
    doorOpen: "/assets/audio/sfx/sfx-door-open.ogg",
    /** 벽 스위치 딸깍. 게임의 첫 조작이라 실물 소리로. 딸-깍 두 번 닿는 0.29초만 잘랐다. */
    lightSwitch: "/assets/audio/sfx/sfx-light-switch.ogg",
  } as Partial<Record<VoiceId, string>>,
  /**
   * 녹음된 말소리 (src/lib/audio/speech.ts). 게임에서 사람 목소리가 나는 자리는 여기뿐이다:
   * 다른 화자는 전부 타자 틱이 목소리를 대신한다.
   */
  voice: {
    /**
     * 그날의 재난 방송 (radio-blackout의 방송 세 줄을 이어 읽은 한 편, 18~20초).
     * 대사 언어를 따라간다. 대본의 방송 문장을 고치면 세 파일을 다시 녹음하고 `?v=`를 붙인다.
     */
    broadcast: {
      ko: "/assets/audio/sfx/sfx-radio-broadcast-ko.mp3?v=2",
      en: "/assets/audio/sfx/sfx-radio-broadcast-en.mp3?v=2",
      ja: "/assets/audio/sfx/sfx-radio-broadcast-ja.mp3?v=2",
    } satisfies Record<Locale, string>,
  },
} as const;
