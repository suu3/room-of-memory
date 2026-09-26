/**
 * 글자 뽑기 퀴즈의 순수 로직: 글자 풀 파싱·섞기·정답 판정.
 *
 * 정답과 풀은 i18n 리소스(minigame.radioQuiz.answer / pool)에서 온다.
 * 언어마다 글자 단위가 다르므로(한글 음절·알파벳·가타카나) 풀은 공백으로
 * 구분된 토큰 문자열이고, 정답은 한 글자씩 쪼개 빈칸 수를 만든다.
 */

/** 공백 구분 풀 문자열 → 글자 배열. 빈 토큰은 버린다. */
export function parsePool(pool: string): string[] {
  return pool.split(/\s+/).filter((letter) => letter.length > 0);
}

/** 정답 → 빈칸에 들어갈 글자 배열. */
export function answerLetters(answer: string): string[] {
  return [...answer];
}

/**
 * 풀이 정답을 만들 수 있는지: 리소스가 어긋나면 풀 수 없는 퀴즈가 되므로
 * 세 언어 리소스 전부를 테스트가 이걸로 지킨다 (letters.test.ts).
 */
export function poolCoversAnswer(pool: string[], answer: string): boolean {
  const remaining = [...pool];
  for (const letter of answerLetters(answer)) {
    const index = remaining.indexOf(letter);
    if (index === -1) return false;
    remaining.splice(index, 1);
  }
  return true;
}

/** Fisher-Yates 셔플. 원본은 건드리지 않는다. 리소스 배열이 계속 섞이면 안 된다. */
export function shufflePool(pool: string[], random: () => number = Math.random): string[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 정답 글자끼리 풀에서 붙어 있지 않게 떼어 놓는다. 섞은 결과에 "좀 비"가 나란히 서면
 * 퀴즈가 아니라 읽기가 된다. 붙은 쌍의 뒤 글자를, 양옆에 정답 글자가 없는 자리의
 * 다른 글자와 바꾼다. 원본은 건드리지 않는다.
 */
export function separateAnswer(pool: readonly string[], answer: string): string[] {
  const letters = new Set(answerLetters(answer));
  const spread = [...pool];
  const isAnswer = (index: number) =>
    index >= 0 && index < spread.length && letters.has(spread[index]);
  const fits = (index: number) =>
    !letters.has(spread[index]) && !isAnswer(index - 1) && !isAnswer(index + 1);
  for (let index = 0; index < spread.length - 1; index++) {
    if (!isAnswer(index) || !isAnswer(index + 1)) continue;
    // 바꿔 넣을 자리: 붙은 쌍에서 멀리 떨어진 곳부터 찾는다
    const candidates = spread.map((_, at) => at).filter((at) => Math.abs(at - (index + 1)) > 1);
    const target = candidates.find(fits);
    if (target === undefined) break;
    [spread[index + 1], spread[target]] = [spread[target], spread[index + 1]];
  }
  return spread;
}

/** 채워진 칸들이 정답을 이루는가. 빈칸이 남아 있으면 아직 판정하지 않는다(null). */
export function judgeSlots(
  slots: readonly (number | null)[],
  pool: readonly string[],
  answer: string,
): boolean | null {
  if (slots.some((slot) => slot === null)) return null;
  return slots.map((slot) => pool[slot as number]).join("") === answer;
}

/** 몇 번 틀릴 때마다 글자 하나를 드러내는가 (v4 설계서 3-3). */
export const MISSES_PER_HINT = 3;

/**
 * 지금까지 드러난 글자 수. 마지막 한 글자는 끝까지 드러내지 않는다: 답을 통째로
 * 보여주면 대답한 게 아니라 읽은 것이 된다. 그 너머는 스킵이 맡는다.
 */
export function hintCount(misses: number, answerLength: number): number {
  return Math.max(0, Math.min(answerLength - 1, Math.floor(misses / MISSES_PER_HINT)));
}

/**
 * 힌트로 드러난 앞쪽 칸을 채운 빈칸 배열. 칸에는 글자가 아니라 풀 인덱스가 든다.
 * 같은 글자가 풀에 둘 있으면 앞의 것을 쓴다.
 */
export function hintedSlots(
  pool: readonly string[],
  answer: string,
  hints: number,
): (number | null)[] {
  const letters = answerLetters(answer);
  const taken = new Set<number>();
  return letters.map((letter, index) => {
    if (index >= hints) return null;
    const found = pool.findIndex(
      (candidate, poolIndex) => candidate === letter && !taken.has(poolIndex),
    );
    if (found === -1) return null;
    taken.add(found);
    return found;
  });
}
