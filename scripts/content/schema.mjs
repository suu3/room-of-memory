/**
 * 콘텐츠 저작 파일(content/*.yaml)의 스키마 상수.
 *
 * 로더·검증기·생성기와 어드민이 같은 값을 본다. 새 화자나 새 아이콘을 쓰려면
 * 여기 먼저 추가한다. 오타가 빌드까지 가지 않게 막는 관문이다.
 */

/** i18n 리소스가 있는 언어. 모든 대사는 이 셋을 전부 채워야 한다. */
export const LOCALES = ["ko", "en", "ja"];

/** 기준 언어. 비면 안 되는 유일한 언어이자 폴백. */
export const BASE_LOCALE = "ko";

/** 초상 표정 프레임. 생략하면 neutral. */
export const EXPRESSIONS = ["neutral", "smile", "surprised", "embarrassed"];

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
  "GameController",
  "GridFour",
  "ImageSquare",
  "Lamp",
  "MusicNotes",
  "Package",
  "Radio",
  "Sneaker",
  "Syringe",
  "Television",
];

/** 방 단계 id. src/data/memory-room.ts의 ROOM_STAGES와 순서·이름이 같아야 한다. */
export const STAGE_IDS = ["dark", "dim", "gold"];

/** 저작 파일과 그 안의 최상위 키. */
export const SOURCES = {
  memories: { file: "memories.yaml", root: "memories" },
  scripts: { file: "scripts.yaml", root: "scripts" },
  cutscenes: { file: "cutscenes.yaml", root: "cutscenes" },
  stages: { file: "stages.yaml", root: "stages" },
};

/** phase 설정에서 허용하는 키. 오타난 키를 조용히 무시하지 않으려고 명시한다. */
export const PHASE_KEYS = ["script", "minigame", "resultScript", "unlockAfter", "replayStill"];

/** 기억 항목에서 허용하는 키. */
export const MEMORY_KEYS = ["id", "icon", "lore", "phase1", "phase2"];

/** id로 쓸 수 있는 형태: kebab-case. 파일명·i18n 키·CSS 선택자에 그대로 들어간다. */
export const ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
