/**
 * 글자 뽑기 퀴즈의 순수 로직 — 글자 풀 파싱·섞기·정답 판정.
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
 * 풀이 정답을 만들 수 있는지 — 리소스가 어긋나면 풀 수 없는 퀴즈가 되므로
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

/** Fisher–Yates 셔플. 원본은 건드리지 않는다 — 리소스 배열이 계속 섞이면 안 된다. */
export function shufflePool(pool: string[], random: () => number = Math.random): string[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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
