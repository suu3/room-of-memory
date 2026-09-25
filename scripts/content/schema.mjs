/**
 * 콘텐츠 저작 파일(content/*.yaml)의 스키마 상수.
 *
 * 로더·검증기·생성기와 어드민이 같은 값을 본다. 새 화자나 새 아이콘을 쓰려면
 * 여기 먼저 추가한다. 오타가 빌드까지 가지 않게 막는 관문이다.
 */

/** i18n 리소스가 있는 언어. 모든 대사는 이 셋을 전부 채워야 한다. */
export const LOCALES = ["ko", "en", "ja"];

/**
 * 기준 언어. 비면 안 되는 유일한 언어이자 폴백.
 *
 * 나머지 언어(en/ja)가 비어 있으면 검증은 막지 않고 "번역 TODO"로 센다. 생성물에는
 * 기준 언어 문장이 그 자리에 들어간다 (i18n의 fallbackLng와 같은 동작). 대본을 먼저
 * 한국어로 세우고 번역을 뒤따라 채우는 작업 순서를 위한 것이다 (v4 설계서 7-1).
 */
export const BASE_LOCALE = "ko";

/** 초상 표정 프레임. 생략하면 neutral. */
export const EXPRESSIONS = ["neutral", "smile", "surprised"];

/**
 * 대사창을 쓸 수 있는 화자. 이름은 i18n의 characters.<id>.name에 있다
 * (src/i18n/locales/<lng>/memory-room.base.json).
 */
export const SPEAKERS = ["hero", "dad", "mom", "broadcast", "signal", "narrator"];

/**
 * 기억 패널 아이콘으로 쓸 수 있는 @phosphor-icons/react 이름.
 *
 * 생성기가 이 이름을 그대로 import 문으로 뽑기 때문에, 목록에 없는 이름은
 * 타입 에러가 아니라 친절한 검증 에러로 먼저 걸린다.
 */
export const ICONS = [
  "Bag",
  "Baseball",
  "Bed",
  "BookOpen",
  "CalendarHeart",
  "Cards",
  "Desktop",
  "DeviceMobile",
  "Envelope",
  "FileText",
  "GameController",
  "GridFour",
  "IdentificationCard",
  "ImageSquare",
  "Lamp",
  "MusicNotes",
  "Note",
  "Package",
  "Radio",
  "Sneaker",
  "Syringe",
  "Television",
];

/**
 * 독백 구간 id. 진행도(조사 개수)로 갈리며, 어느 구간을 쓸지는
 * src/data/monologue.ts의 monologueIdFor가 정한다. 거기 MONOLOGUE_IDS와 같아야 한다.
 */
export const STAGE_IDS = [
  "p0-dark",
  "p1-0",
  "p1-mid",
  "p1-late",
  "turn-bottom",
  "turn-signal",
  "p2-enter",
  "p3-enter",
  "p4-enter",
  "resolve",
];

/**
 * 이야기의 페이즈 (v4 설계서 1-1). 순서가 곧 진행 순서다.
 *
 * 저장하지 않고 진행 상태에서 파생된다 (src/data/story-phase.ts). 조사 설정의
 * `from`이 이 이름을 쓴다: "이 페이즈부터 열린다".
 */
export const STORY_PHASES = ["intro", "p1", "turning", "p2", "p3", "p4", "resolve", "ending"];

/** 조사 설정의 `from`에 쓸 수 있는 페이즈. 1차 조사는 늘 p1이라 여기 없다. */
export const FROM_PHASES = ["turning", "p2", "p3", "p4"];

/** 조사 차수: phase1(1차) · phase2(2차) · phase3(3차). */
export const VISIT_KEYS = ["phase1", "phase2", "phase3"];

/** 컷에 붙일 수 있는 효과음 (src/lib/audio/voices.ts의 이름). 컷이 뜨는 순간 한 번 난다. */
export const CUT_SFX = ["micTap", "radioCut", "radioWake"];

/** 웹툰 컷의 자리. 없으면 그림이 판을 통째로 덮는다. */
export const CUT_PANELS = ["left", "right"];

/** 컷에서 허용하는 키. */
export const CUT_KEYS = ["image", "holdMs", "panel", "sfx", "narration", "lines"];

/** 저작 파일과 그 안의 최상위 키. */
export const SOURCES = {
  memories: { file: "memories.yaml", root: "memories" },
  scripts: { file: "scripts.yaml", root: "scripts" },
  cutscenes: { file: "cutscenes.yaml", root: "cutscenes" },
  stages: { file: "stages.yaml", root: "stages" },
};

/** phase 설정에서 허용하는 키. 오타난 키를 조용히 무시하지 않으려고 명시한다. */
export const PHASE_KEYS = [
  "script",
  "minigame",
  "resultScript",
  "unlockAfter",
  "replayStill",
  "from",
  "side",
  "cutscene",
];

/** 기억 항목에서 허용하는 키. */
export const MEMORY_KEYS = ["id", "icon", "lore", "phase1", "phase2", "phase3"];

/** id로 쓸 수 있는 형태: kebab-case. 파일명·i18n 키·CSS 선택자에 그대로 들어간다. */
export const ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
