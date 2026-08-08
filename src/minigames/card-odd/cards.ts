/**
 * 카드 미궁 — 펼쳐진 한 벌에서 잘못 인쇄된 카드를 찾아 그 숫자를 이어 적는다.
 *
 * 미궁 문제라 판은 **고정이다.** 매번 다르게 깔면 방 곳곳에 흩어 둔 단서가
 * 무엇도 가리킬 수 없다 — 단서가 답을 향하려면 답이 한 개여야 한다.
 *
 * 그래서 규칙은 이 파일 어디에도 화면 문구로 적히지 않는다. 카드가 지키는 두 가지
 * (문양의 색, 180° 회전 대칭)는 다른 오브젝트의 대사에 흩어져 있고, 플레이어는
 * 그걸 모아서 스스로 규칙을 세운다.
 */

export const SUITS = ["spade", "heart", "diamond", "club"] as const;
export type Suit = (typeof SUITS)[number];

export const SUIT_GLYPH: Record<Suit, string> = {
  spade: "♠",
  heart: "♥",
  diamond: "♦",
  club: "♣",
};

export type InkColor = "black" | "red";

/** 문양의 본래 색. 스페이드·클로버는 검정, 하트·다이아는 빨강이다. */
export function suitColor(suit: Suit): InkColor {
  return suit === "spade" || suit === "club" ? "black" : "red";
}

/**
 * 카드가 어긴 규칙.
 * - "color"      문양이 반대 색으로 인쇄됐다
 * - "asymmetry"  아래쪽 인덱스가 뒤집히지 않았다 (트럼프는 180° 회전 대칭이다)
 */
export type Flaw = "color" | "asymmetry";

export interface Card {
  suit: Suit;
  /** 1(A)~10. 그림 카드(J·Q·K)는 도안이 있어야 대칭이 읽혀서 쓰지 않는다. */
  rank: number;
  flaw?: Flaw;
}

/**
 * 문제. 6열 2줄로 깔린다.
 *
 * 틀린 카드는 셋이고, 색 오류 둘 사이에 대칭 오류 하나를 끼웠다. 색은 눈에 먼저
 * 들어오고 대칭은 한참 들여다봐야 보인다 — 쉬운 둘이 "여기엔 틀린 게 섞여 있다"를
 * 먼저 알려주고, 어려운 하나가 판을 붙잡는다.
 *
 * 같은 (문양, 숫자)는 두 번 나오지 않는다. 한 벌에서 뽑은 카드니까 중복이 있으면
 * 그것부터 오류로 읽힌다.
 */
export const BOARD: readonly Card[] = [
  { suit: "spade", rank: 5 },
  { suit: "heart", rank: 9 },
  { suit: "club", rank: 2, flaw: "color" },
  { suit: "diamond", rank: 10 },
  { suit: "spade", rank: 1 },
  { suit: "heart", rank: 7 },
  { suit: "club", rank: 4 },
  { suit: "diamond", rank: 6 },
  { suit: "spade", rank: 3, flaw: "asymmetry" },
  { suit: "heart", rank: 8 },
  { suit: "club", rank: 10 },
  { suit: "diamond", rank: 7, flaw: "color" },
];

/** 실제로 인쇄된 색. 색이 틀린 카드만 본래 색의 반대가 나온다. */
export function printedColor(card: Card): InkColor {
  const natural = suitColor(card.suit);
  if (card.flaw !== "color") return natural;
  return natural === "black" ? "red" : "black";
}

/** 아래쪽 인덱스가 180° 돌아가 있는가. 대칭이 깨진 카드만 바로 서 있다. */
export function isIndexFlipped(card: Card): boolean {
  return card.flaw !== "asymmetry";
}

/** 왼쪽부터 읽은 틀린 카드의 숫자. 이게 답이다. */
export const ANSWER = BOARD.filter((card) => card.flaw)
  .map((card) => card.rank)
  .join("");

/**
 * 입력이 답인가.
 *
 * 공백과 구분기호는 흘려 넘긴다 — "2 3 7"이나 "2,3,7"로 적은 사람은 답을 안 것이지
 * 틀린 것이 아니다. 미궁 문제에서 형식으로 사람을 되돌리면 답을 알고도 막힌다.
 */
export function isCorrect(input: string): boolean {
  return input.replace(/[^0-9]/g, "") === ANSWER;
}
