/**
 * UI 공통 옷 (DESIGN.md > Overview).
 *
 * 패널 두 재질(dark / paper), 버튼 세 역할(primary / quiet / destructive), 선택 칩,
 * HUD 아이콘 버튼. hover / focus-visible / active / disabled / selected 상태를 여기서
 * 한 번만 정한다. 컴포넌트마다 옷을 다시 짓지 않는다.
 *
 * 테두리는 늘 있고 색만 바뀐다 (hover에서 테두리를 새로 그리면 레이아웃이 움직인다).
 * 튀는 스프링·확대·반복 글로우는 없다. 포커스는 memory 아웃라인 하나로 통일한다.
 */

export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory";

/** 어두운 패널: 메뉴·설정·미니게임 셸·모달. */
export const PANEL_DARK = "rounded-md border border-line bg-surface text-ivory shadow-panel";
/** 대사창: 공간에 깔리는 어두운 자막 패널. 모양은 globals.css의 .dialogue-panel. */
export const PANEL_DIALOGUE = "dialogue-panel text-ivory";
/** 미니게임 프레임: 경계가 또렷한 도구의 틀. 게임 화면보다 한 톤 밝은 청회색. */
export const PANEL_FRAME = "rounded-md border border-line bg-panel text-ivory shadow-panel";
/** 종이 패널: 수첩과 방에서 집어 든 종이. */
export const PANEL_PAPER = "rounded-lg border border-ink/12 bg-paper text-ink shadow-panel";

const BUTTON_BASE = `inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-sm border text-sm font-medium leading-none transition-colors duration-150 disabled:cursor-default disabled:opacity-40 ${FOCUS_RING}`;
/** 핵심 행동: 시작·확인. 금빛은 여기와 선택·진행에만 쓴다. */
export const BUTTON_PRIMARY = `${BUTTON_BASE} border-memory bg-memory px-4 py-2.5 text-night hover:border-memory/85 hover:bg-memory/85 active:bg-memory/75`;
/** 조용한 행동: 취소·닫기·건너뛰기. */
export const BUTTON_QUIET = `${BUTTON_BASE} border-line bg-transparent px-4 py-2.5 text-fog hover:border-fog/40 hover:text-ivory active:bg-ivory/10`;
/** 되돌릴 수 없는 행동: 리셋·새 게임. */
export const BUTTON_DESTRUCTIVE = `${BUTTON_BASE} border-ember bg-ember px-4 py-2.5 text-ivory hover:border-ember/85 hover:bg-ember/85 active:bg-ember/75`;
/** 종이 위의 조용한 버튼 (수첩·종이 단서). */
export const BUTTON_QUIET_PAPER = `${BUTTON_BASE} border-ink/15 bg-transparent px-3 py-1.5 text-graphite hover:border-ink/40 hover:text-ink active:bg-ink/5`;
/** 어두운 패널 위의 돌리기 아이콘 버튼 (거울 속 캐릭터). */
export const TURN_BUTTON_DARK = `cursor-pointer rounded-sm border border-line bg-surface p-1.5 text-fog transition-colors hover:text-ivory active:bg-surface-strong ${FOCUS_RING}`;

/** 인스펙트 무대 위에 뜨는 조작 버튼 (돌리기·확대). 알약 모양 받침 안에 테 없이 선다. */
export const STAGE_ICON_BUTTON = `grid size-8 cursor-pointer place-items-center rounded-full text-fog transition-colors duration-150 hover:bg-ivory/10 hover:text-ivory active:bg-ivory/15 ${FOCUS_RING}`;

/** 선택 칩 (언어·난이도·분류). 상태는 색만이 아니라 aria-pressed와 채움으로 말한다. */
export const CHIP_BASE = `cursor-pointer rounded-sm border px-3 py-1.5 text-sm font-medium leading-none transition-colors duration-150 ${FOCUS_RING}`;
export const CHIP_SELECTED = "border-memory/60 bg-memory/15 text-memory";
export const CHIP_IDLE =
  "border-line text-fog hover:border-fog/40 hover:text-ivory active:bg-ivory/10";
/**
 * 장면 위에 글자만 서는 선택지 (넓은 화면에서 펼친 HUD 메뉴 줄). 상자 없이 글자와 밑줄뿐이고,
 * 크기는 부모의 글자 크기를 em으로 따른다. 고른 것은 금빛 밑줄로 말한다. 밑줄 자리는 늘
 * 있고 색만 바뀌어서 고를 때 글자가 움직이지 않는다.
 */
export const HUD_CHOICE_BASE = `cursor-pointer border-b-2 px-[0.35em] pb-[0.15em] pt-[0.1em] font-medium leading-none transition-colors duration-150 ${FOCUS_RING}`;
export const HUD_CHOICE_SELECTED = "border-memory text-ivory";
export const HUD_CHOICE_IDLE = "border-transparent text-fog hover:text-ivory active:text-ivory";
/** 종이 위의 칩 */
export const CHIP_SELECTED_PAPER = "border-ink/40 bg-ink/10 text-ink";
export const CHIP_IDLE_PAPER =
  "border-ink/15 text-graphite hover:border-ink/40 hover:text-ink active:bg-ink/5";

/**
 * HUD 아이콘 버튼: 폰에서 20px 아이콘·44px 조작 영역, 넓은 화면에서는 --text-hud를 따라
 * 최대 32px·72px까지 커진다 (아이콘은 size="1.25em"). 장면 위에 밝은 덩어리로 떠다니지
 * 않게 배경은 hover·열림 때만 옅은 네이비로 깔린다. 항상 떠 있어야 하는 닫기 버튼은
 * `HUD_ICON_BUTTON_SOLID`(고정 44px).
 */
export const HUD_ICON_BUTTON = `grid size-[2.75em] cursor-pointer place-items-center rounded-full border border-transparent text-hud text-ivory/85 transition-colors duration-150 hover:border-line hover:bg-surface-subtle hover:text-ivory active:bg-surface ${FOCUS_RING}`;
export const HUD_ICON_BUTTON_SOLID = `grid size-11 cursor-pointer place-items-center rounded-full border border-line bg-surface text-ivory/85 transition-colors duration-150 hover:bg-surface-strong hover:text-ivory active:bg-surface-strong ${FOCUS_RING}`;

/** 어두운 패널 안 목록 항목 */
export const MENU_ITEM = `flex w-full cursor-pointer items-center rounded-sm px-3 py-2 text-left text-sm font-medium text-fog transition-colors duration-150 hover:bg-ivory/8 hover:text-ivory active:bg-ivory/12 ${FOCUS_RING}`;
/** 패널 안 구역 라벨 */
export const SECTION_LABEL = "text-xs font-medium tracking-[0.06em] text-ash";
/** 모달 뒤 백드롭: 방이 안 보일 만큼 흐리거나 어둡게 하지 않는다 */
export const BACKDROP = "absolute inset-0 bg-scene-void/60 backdrop-blur-[2px]";
/** 장면 위에 직접 얹는 글자: 밝은 표면 위에서도 읽히게 그림자를 깐다 */
export const ON_SCENE_TEXT = "monologue-text";
