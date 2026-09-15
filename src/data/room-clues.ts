/**
 * 방에 흩어진 단서: 기억도 트리거도 아닌 배경 오브젝트가 들고 있는 것들.
 *
 * 지금은 하나뿐이다: 컴퓨터 로그인 비밀번호. 답은 어디에도 통째로 적혀 있지 않고
 * 세 조각으로 갈라져 있다.
 *
 *   협탁 서랍 속 쪽지: "전국대회 날짜로 해놨다" (아빠가 남긴 메모)
 *   잠금 화면의 힌트 : "전국대회 날" (쪽지를 못 봤을 때의 안전망)
 *   벽에 걸린 달력   : 그 날에 그어둔 표시 (며칠인가)
 *
 * 쪽지든 잠금 화면이든 "무슨 날"까지만 말한다. "달력을 봐라"처럼 다음 행동을
 * 지시하면 단서가 심부름표가 된다. 숫자는 달력만 갖고 있다.
 *
 * 어느 쪽도 진행을 막지 않는다. 못 찾아도 잠금 화면이 일정 시간 뒤 스킵을
 * 내준다 (접근성 규칙, .claude/rules/minigames.md).
 *
 * 날짜를 한곳에 두는 이유: 비밀번호(코드)와 달력에 표시되는 날(화면)이 갈라지면
 * 아무리 뒤져도 안 맞는 단서가 된다. 둘 다 이 값에서 나온다.
 */

/**
 * 전국대회가 있던 날. 달력에 표시가 그어져 있고, 컴퓨터 비밀번호의 출처다.
 *
 * 달력이 걸어 둔 장(7~11월) 안에 있어야 한다. 밖으로 나가면 표시를 볼 수 있는
 * 장이 없어 단서가 사라진다. calendar.test가 그걸 지킨다.
 */
export const NATIONALS_DATE = { month: 8, day: 12 } as const;

const pad = (value: number) => String(value).padStart(2, "0");

/** 컴퓨터 로그인 비밀번호: 전국대회 날의 월일 네 자리. */
export const COMPUTER_PASSCODE = `${pad(NATIONALS_DATE.month)}${pad(NATIONALS_DATE.day)}`;

export const COMPUTER_PASSCODE_LENGTH = COMPUTER_PASSCODE.length;

/**
 * 들여다볼 수 있는 배경 오브젝트. 클릭하면 화면 가운데에 확대되어 뜬다
 * (src/components/ui/ClueOverlay.tsx).
 *
 * wall-calendar는 성격이 다르다. 원래 조사 오브젝트(기억)였다가 1바퀴 조사를
 * 마치면 배경 오브젝트로 내려앉는 물건이다. 그래서 수집 전에는 열리지 않는다
 * (store의 openClue).
 *
 * mirror는 단서가 아니라 거울이다. 무엇도 알려주지 않고, 누르면 거울 속 자기(3D
 * 캐릭터 모델)를 돌려본다. 같은 목록에 있는 이유는 여는 방식이 같아서다: 방의
 * 물건을 누르면 Canvas 밖 화면이 펼쳐진다 (ClueOverlay).
 */
export const CLUE_IDS = [
  "drawer-note",
  "wall-calendar",
  "shelf-book",
  "desk-clock",
  "workbook",
  "mirror",
] as const;
export type ClueId = (typeof CLUE_IDS)[number];

/**
 * 방을 뒤지다 알게 되는 것들: 수첩의 흐린 칸을 열고, 대사창의 이름표를 바꾼다.
 *
 * 기억 수집과 다른 축이다. 기억은 이야기를 밀고, 이것은 **자기 자신에 대한 사실**을
 * 되찾는다. 지금은 하나뿐이다: 책상 위 문제집을 집어 들고 **뒤집어 보면** 뒤표지에
 * 적어 둔 이름이 있다. 앞면만 보고 내려놓으면 모른다. 눈에 띄는 자리에 두지 않는
 * 이유는 한 가지다. 방을 돌려 보는 손이 있어야 나오는 단서가 하나는 있어야 한다.
 *
 * 이름을 알기 전까지 수첩의 이름 칸과 나이 칸은 흐리고, 대사창의 화자는 "나"다.
 * 저장된다 (store의 discoveries).
 */
export const DISCOVERY_IDS = ["hero-name"] as const;
export type DiscoveryId = (typeof DISCOVERY_IDS)[number];

/** 어느 단서를 뒤집어야 무엇을 알게 되는가. 단서 화면(WorkbookClue)이 이 짝을 보고 적는다. */
export const CLUE_DISCOVERY = { workbook: "hero-name" } as const satisfies Partial<
  Record<ClueId, DiscoveryId>
>;

/**
 * 손 쓰는 문제의 규칙이 어디에 있는가.
 *
 * 어느 쪽도 화면에 규칙을 한 줄도 적지 않는다. 적는 순간 문제가 아니라 안내가
 * 되기 때문이다. 대신 방에 놓인 물건이 규칙을 들고 있다:
 *
 *   선반 위 놀이책: 트럼프의 색과 대칭 (거실 식탁 트럼프 = 기억 cards, card-odd)
 *   캐비닛 위 시계: 바늘이 도는 각도 (현관 잠금장치, angle-turn)
 *
 * 비밀번호 단서와 같은 원칙을 지킨다: 물건은 규칙까지만 말하고 "저 문제에 써라"는
 * 말하지 않는다. 지시하는 순간 단서가 심부름표가 된다.
 *
 * 못 찾아도 진행은 안 막힌다. 둘 다 일정 시간 뒤 스킵이 나온다.
 */
export const RULE_CLUES = { "card-odd": "shelf-book", "angle-turn": "desk-clock" } as const;

/**
 * 미궁 문제 id: 기억이 아닌 물건에 붙는 문제다.
 *
 * 지금은 현관 잠금(angle-turn) 하나뿐이다. 식탁 트럼프(card-odd)는 2막 추리
 * 체인의 한 칸이 되면서 기억(`cards`)으로 올라갔다. 대사도 기록도 남는 조사라
 * 별개 축에 둘 이유가 없어졌다 (docs/content-design.md 4-1).
 *
 * 여기 남은 것은 수집·재조사에 안 세어지고 완료는 solvedPuzzles에만 남는다.
 */
export const PUZZLE_IDS = ["angle-turn"] as const;
export type PuzzleId = (typeof PUZZLE_IDS)[number];

/**
 * 조사를 마친 뒤 배경 오브젝트로 다시 열리는 기억. 달력이 유일하다. 1바퀴에
 * "그날 이후로 正자만"을 보여주고 나면, 그 뒤로는 그냥 벽에 걸린 달력이다.
 */
export const CLUE_AFTER_MEMORY = { calendar: "wall-calendar" } as const satisfies Record<
  string,
  ClueId
>;
