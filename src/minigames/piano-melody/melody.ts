/**
 * 피아노 멜로디 퍼즐의 규칙. 브라우저 없이 검사할 수 있는 계산만 여기 둔다.
 *
 * 절대음감을 요구하지 않는다. 보면대의 악보에 오선지와 계이름이 있고, 건반에도 같은
 * 글자가 남아 있다. 푸는 일은 "듣고 맞히기"가 아니라 **적힌 대로 누르기**다. 다만
 * 그렇게 하라고 화면이 일러 주지는 않는다: 물건 둘을 나란히 두고 사람이 잇는다.
 */

/** 흰 건반 일곱. 1~7 키와 순서가 그대로 맞는다. */
export const SOLFEGE = ["do", "re", "mi", "fa", "sol", "la", "ti"] as const;
export type Solfege = (typeof SOLFEGE)[number];

/**
 * 계이름 → 주파수(Hz). C4부터 시작하는 한 옥타브.
 *
 * 12평균율 그대로다. 방의 다른 소리(voices.ts의 라단조 5음계)와 조가 다르지만,
 * 이건 배경음이 아니라 사람이 치는 악기라 조를 맞출 이유가 없다.
 */
export const NOTE_HZ: Record<Solfege, number> = {
  do: 261.63,
  re: 293.66,
  mi: 329.63,
  fa: 349.23,
  sol: 392.0,
  la: 440.0,
  ti: 493.88,
};

/**
 * 쳐야 하는 곡. 누구나 아는 동요의 첫 두 마디다 (솔미미 / 파레레).
 *
 * 여섯 음으로 끊는다. 곡을 끝까지 다 치게 하면 외우는 게 아니라 옮겨 적는 일이 되고,
 * 한 음이라도 틀리면 처음부터인 규칙에서 그 길이는 벌이 된다.
 */
export const MELODY_BARS = [
  ["sol", "mi", "mi"],
  ["fa", "re", "re"],
] as const satisfies readonly (readonly Solfege[])[];

export const MELODY: readonly Solfege[] = MELODY_BARS.flat();

/**
 * 악보에서 지워진 마디. 물에 번져 안 보이고, 안방 책상의 찢어진 악보 조각이 그 마디를
 * 들고 있다 (src/data/items.ts의 piano-sheet). 이쪽 공간의 단서를 저쪽에서 찾게 하는
 * 자리라, 조각 없이도 칠 수는 있지만 세 음을 찍어야 한다.
 */
export const MISSING_BAR = 1;

/** 이 마디가 악보에 보이는가. 지워진 마디는 조각을 들고 있을 때만 드러난다. */
export function barVisible(bar: number, hasScrap: boolean): boolean {
  return bar !== MISSING_BAR || hasScrap;
}

/** 여기까지 친 것이 아직 곡을 따라가고 있는가. 한 음이라도 어긋나면 처음부터다. */
export function isPrefix(played: readonly Solfege[]): boolean {
  if (played.length > MELODY.length) return false;
  return played.every((note, index) => note === MELODY[index]);
}

/** 곡을 끝까지 쳤는가. */
export function isComplete(played: readonly Solfege[]): boolean {
  return played.length === MELODY.length && isPrefix(played);
}

/** 1~7 숫자 키 → 계이름. 그 밖의 키는 null. */
export function noteForKey(key: string): Solfege | null {
  const index = Number(key) - 1;
  return Number.isInteger(index) && index >= 0 && index < SOLFEGE.length ? SOLFEGE[index] : null;
}
