import type { Act } from "@/store/memory-room";

/**
 * 혼잣말이 물러날 때 글자가 움직이는 계획 (docs/direction/visual-experiments.md 8장).
 *
 * 등장(타자기)은 손대지 않는다. 물러나는 쪽만 글자 단위다:
 *
 *   1막 (외면)   말끝이 흐려지며 **떨어진다**. 문장의 뒤 N글자가 마지막 글자부터 차례로
 *                아래로 내려가며 사라지고, 앞쪽 나머지는 그 뒤에 한꺼번에 꺼진다.
 *                말을 끝까지 하지 못하고 흘리는 사람의 문장이다.
 *   2막부터 (직면) 글자가 **아래에서 위로 모이며** 사라진다. 첫 글자부터 마지막 글자까지
 *                고르게 계단을 밟아 올라간다. 방향이 반대인 것이 곧 태도의 반전이다.
 *
 * Framer Motion 없이 CSS 애니메이션 + animation-delay다. 여기는 글자마다의 지연만 계산하는
 * 순수 함수라 브라우저 없이 시험한다. 글자 하나의 움직임(밝기·translateY·길이)은
 * globals.css의 .monologue-exit-down / .monologue-exit-up 에 있다.
 */
export type ExitDirection = "down" | "up";

export interface ExitChar {
  /** 글자 하나 (코드포인트 단위. 공백도 그대로 한 글자다: 레이아웃이 흔들리지 않게). */
  char: string;
  /** 이 글자의 애니메이션이 시작되기까지의 지연(ms). 0 이상, totalMs 이하. */
  delayMs: number;
}

/** 글자 하나가 사라지는 데 걸리는 시간(ms). globals.css의 animation 길이와 같아야 한다. */
export const EXIT_CHAR_MS = 260;

/** 첫 글자와 마지막 글자의 시작 시각 차이(ms). 게임의 값. 실험실은 슬라이더로 늘린다. */
export const EXIT_SPREAD_MS = 220;

/**
 * 물러남 전체가 끝나는 시간(ms) = 지연의 폭 + 글자 하나의 길이. DESIGN.md > Motion의
 * 독백 전환 예산(250~350ms)보다 조금 길지만, 마지막 글자가 움직이기 시작하는 시점은
 * 예산 안(220ms)이라 체감 박자는 같다. Monologue의 줄 교체 타이머가 이 값을 쓴다.
 */
export const EXIT_TOTAL_MS = EXIT_SPREAD_MS + EXIT_CHAR_MS;

/** 1막에서 순서대로 떨어지는 뒤 글자 수의 상한. 그 이상은 계단이 아니라 물결로 읽힌다. */
const ACT_ONE_TAIL_MAX = 8;

/** 1막에서 순서대로 떨어지는 뒤 글자의 비율. 짧은 문장은 상한 대신 이 비율이 정한다. */
const ACT_ONE_TAIL_RATIO = 0.4;

export function exitDirection(act: Act): ExitDirection {
  return act === 1 ? "down" : "up";
}

/**
 * 글자마다의 지연. 결과 길이는 `Array.from(text)`의 길이와 같다 (서로게이트 쌍도 한 글자).
 *
 * 1막: 뒤 N글자(N = min(8, ceil(len * 0.4)))가 **마지막 글자부터** 0, ..., totalMs 로
 *      계단을 밟고, 나머지 앞 글자는 전부 totalMs (뒤 글자가 다 떨어진 뒤 함께 꺼진다).
 * 2막·3막: 모든 글자가 **첫 글자부터** 0, ..., totalMs 로 고르게.
 *
 * 계단이 한 글자뿐이면 (N=1 또는 len=1) 지연은 0이다. 0으로 나누지 않는다.
 */
export function exitPlan(text: string, act: Act, totalMs: number): ExitChar[] {
  const chars = Array.from(text);
  const length = chars.length;
  const spread = Math.max(0, totalMs);

  if (act === 1) {
    const tail = Math.min(ACT_ONE_TAIL_MAX, Math.ceil(length * ACT_ONE_TAIL_RATIO));
    const step = tail > 1 ? spread / (tail - 1) : 0;
    return chars.map((char, index) => {
      // 끝에서부터 센 자리. 마지막 글자가 0, 그 앞이 1, ...
      const fromEnd = length - 1 - index;
      const delayMs = fromEnd < tail ? fromEnd * step : spread;
      return { char, delayMs };
    });
  }

  const step = length > 1 ? spread / (length - 1) : 0;
  return chars.map((char, index) => ({ char, delayMs: index * step }));
}
