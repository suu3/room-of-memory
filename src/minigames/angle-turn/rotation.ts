/**
 * 회전 미궁: 왼쪽 글자를 시계 방향으로 몇 도 돌리면 오른쪽 글자가 되는가.
 *
 * 5년 전 미궁게임(첫html코딩 - maze)의 1층 문제를 그대로 가져왔다. 원본은
 * `m 3 / 곡 눈 / | /` 세 쌍에 답이 9018045였다.
 *
 * **글자를 읽을 필요가 없다.** 한글이 섞여 있지만 뜻도 소리도 쓰이지 않고, 도형이
 * 겹치는지만 보면 된다. 그래서 en/ja에서도 그대로 선다. 번역해야 할 것은 문제가
 * 아니라 문제를 감싼 안내 문구뿐이다.
 */

export interface TurnPair {
  /** 돌리기 전 글자. */
  from: string;
  /** 시계 방향으로 돌린 뒤의 글자. */
  to: string;
  /** 시계 방향 각도. 답의 한 토막이 된다. */
  degrees: number;
}

/**
 * 문제. 원본의 세 쌍을 순서까지 그대로 쓴다.
 *
 *   m  → 90°  → 3     (오른쪽으로 눕히면 3이 된다)
 *   곡 → 180° → 눈    (거꾸로 뒤집으면 눈이 된다)
 *   |  → 45°  → /     (반만 눕히면 빗금이 된다)
 *
 * 90 → 180 → 45 순서라 답이 자릿수로 갈리지 않는다. 각을 크기순으로 늘어놓으면
 * 45·90·180이 되어 "작은 것부터"라는 없는 규칙이 보이므로 원본 순서를 지킨다.
 */
export const PAIRS: readonly TurnPair[] = [
  { from: "m", to: "3", degrees: 90 },
  { from: "곡", to: "눈", degrees: 180 },
  { from: "|", to: "/", degrees: 45 },
];

/** 왼쪽부터 각도를 이어 붙인 것. 이게 답이다. */
export const ANSWER = PAIRS.map((pair) => pair.degrees).join("");

/** 답의 자릿수. 문제에 빈칸으로 세워 "몇 자리인가"만 알려준다. */
export const ANSWER_LENGTH = ANSWER.length;

/**
 * 입력이 답인가.
 *
 * 숫자만 남기고 본다. "90 180 45"처럼 띄어 적은 사람은 답을 안 것이지 틀린 것이
 * 아니다. 미궁 문제에서 형식으로 사람을 되돌리면 답을 알고도 막힌다.
 */
export function isCorrect(input: string): boolean {
  return input.replace(/[^0-9]/g, "") === ANSWER;
}
