/**
 * 방에 흩어진 단서 — 기억도 트리거도 아닌 배경 오브젝트가 들고 있는 것들.
 *
 * 지금은 하나뿐이다: 컴퓨터 로그인 비밀번호. 답은 어디에도 통째로 적혀 있지 않고
 * 세 조각으로 갈라져 있다.
 *
 *   협탁 서랍 속 쪽지 — "전국대회 날짜로 해놨다" (아빠가 남긴 메모)
 *   잠금 화면의 힌트  — "전국대회 날" (쪽지를 못 봤을 때의 안전망)
 *   벽에 걸린 달력    — 그 날에 그어둔 표시 (며칠인가)
 *
 * 쪽지든 잠금 화면이든 "무슨 날"까지만 말한다 — "달력을 봐라"처럼 다음 행동을
 * 지시하면 단서가 심부름표가 된다. 숫자는 달력만 갖고 있다.
 *
 * 어느 쪽도 진행을 막지 않는다 — 못 찾아도 잠금 화면이 일정 시간 뒤 스킵을
 * 내준다 (접근성 규칙, .claude/rules/minigames.md).
 *
 * 날짜를 한곳에 두는 이유: 비밀번호(코드)와 달력에 표시되는 날(화면)이 갈라지면
 * 아무리 뒤져도 안 맞는 단서가 된다. 둘 다 이 값에서 나온다.
 */

/**
 * 전국대회가 있던 날. 달력에 표시가 그어져 있고, 컴퓨터 비밀번호의 출처다.
 *
 * 달력이 걸어 둔 장(7~11월) 안에 있어야 한다 — 밖으로 나가면 표시를 볼 수 있는
 * 장이 없어 단서가 사라진다. calendar.test가 그걸 지킨다.
 */
export const NATIONALS_DATE = { month: 8, day: 12 } as const;

const pad = (value: number) => String(value).padStart(2, "0");

/** 컴퓨터 로그인 비밀번호 — 전국대회 날의 월일 네 자리. */
export const COMPUTER_PASSCODE = `${pad(NATIONALS_DATE.month)}${pad(NATIONALS_DATE.day)}`;

export const COMPUTER_PASSCODE_LENGTH = COMPUTER_PASSCODE.length;

/**
 * 들여다볼 수 있는 배경 오브젝트. 클릭하면 화면 가운데에 확대되어 뜬다
 * (src/components/ui/ClueOverlay.tsx).
 *
 * wall-calendar는 성격이 다르다 — 원래 조사 오브젝트(기억)였다가 1바퀴 조사를
 * 마치면 배경 오브젝트로 내려앉는 물건이다. 그래서 수집 전에는 열리지 않는다
 * (store의 openClue).
 */
export const CLUE_IDS = ["drawer-note", "wall-calendar", "shelf-book", "desk-clock"] as const;
export type ClueId = (typeof CLUE_IDS)[number];

/**
 * 2바퀴 미궁 문제의 규칙이 어디에 있는가.
 *
 * 두 문제 모두 화면에 규칙을 한 줄도 적지 않는다. 적는 순간 문제가 아니라 안내가
 * 되기 때문이다. 대신 방에 놓인 물건이 규칙을 들고 있다:
 *
 *   선반 위 놀이책 — 트럼프의 색과 대칭 (게임기 2바퀴, card-odd)
 *   캐비닛 위 시계 — 바늘이 도는 각도 (사인볼 2바퀴, angle-turn)
 *
 * 비밀번호 단서와 같은 원칙을 지킨다: 물건은 규칙까지만 말하고 "저 문제에 써라"는
 * 말하지 않는다. 지시하는 순간 단서가 심부름표가 된다.
 *
 * 못 찾아도 진행은 안 막힌다 — 두 문제 다 일정 시간 뒤 스킵이 나온다.
 */
export const PUZZLE_CLUES = { "card-odd": "shelf-book", "angle-turn": "desk-clock" } as const;

/**
 * 미궁 문제 id. 미니게임 레지스트리(src/minigames)의 id와 같지만, 기억 인터랙션이
 * 아니라 거실 물건(식탁 트럼프·현관 잠금장치)에 붙는다 — 수집·재조사에 안 세어지고
 * 완료는 스토어의 solvedPuzzles에만 남는다.
 */
export type PuzzleId = keyof typeof PUZZLE_CLUES;
export const PUZZLE_IDS = Object.keys(PUZZLE_CLUES) as readonly PuzzleId[];

/**
 * 조사를 마친 뒤 배경 오브젝트로 다시 열리는 기억. 달력이 유일하다 — 1바퀴에
 * "그날 이후로 正자만"을 보여주고 나면, 그 뒤로는 그냥 벽에 걸린 달력이다.
 */
export const CLUE_AFTER_MEMORY = { calendar: "wall-calendar" } as const satisfies Record<
  string,
  ClueId
>;
