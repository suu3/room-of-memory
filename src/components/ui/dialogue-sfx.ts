import type { PlayOptions, VoiceId } from "@/lib/audio";
import type { CharacterId } from "@/types/scenario";

/**
 * 대사가 찍힐 때 어떤 소리를 낼지 고른다. 소리를 내지는 않는다: 고르는 일만 순수하게
 * 떼어 두어야 브라우저 없이 테스트할 수 있다 (voices.ts와 같은 이유).
 */

/**
 * 화자마다 틱의 높이가 다르다. 초상이 없는 화자(아빠·엄마)도 귀로는 갈린다.
 * 비율은 라단조 5음계 안에서 고른다: 기준 A3에서 아빠는 4도 아래(E3), 엄마는
 * 4도 위(D4). 어느 화자가 이어 말해도 앞 사람의 틱과 부딪히지 않는다.
 * 내레이터는 도해와 같은 음에서 반음도 안 되게만 낮춘다: 다른 사람이 아니라 거리다.
 */
const SPEAKER_PITCH: Partial<Record<CharacterId, number>> = {
  hero: 1,
  dad: 0.75,
  mom: 1.335,
  narrator: 0.96,
};

/** 전파 너머의 화자. 사람의 음정 대신 잡음 틱(typeRadio)으로 찍힌다. */
const RADIO_SPEAKERS: readonly CharacterId[] = ["broadcast", "signal"];

/**
 * 몇 글자마다 한 번 울리는가. 글자당 70ms라 매 글자면 초당 14번이다. 그 속도의 틱은
 * 목소리가 아니라 모터로 들린다. 둘에 하나로 솎는다.
 */
const TICK_EVERY = 2;

/** 소리 나는 글자: 문자와 숫자. 공백·문장부호·말줄임표는 침묵이다. 쉼이 들려야 말이다. */
const SOUNDING = /[\p{L}\p{N}]/u;

export interface TypeTick {
  id: VoiceId;
  options: PlayOptions;
}

/**
 * 방금 찍힌 글자에 붙일 틱. 없으면 null.
 *
 * @param char 방금 찍힌 글자 하나
 * @param count 그 글자까지 찍힌 글자 수 (1부터)
 */
export function typeTick(speaker: CharacterId, char: string, count: number): TypeTick | null {
  // 첫 글자에서 울려야 말이 시작되는 순간과 소리가 붙는다 (count 1, 3, 5, ...)
  if (count % TICK_EVERY !== 1) return null;
  if (!SOUNDING.test(char)) return null;
  if (RADIO_SPEAKERS.includes(speaker)) return { id: "typeRadio", options: { variation: 0.12 } };
  // 살짝 흔든다. 완전히 같은 음의 연타는 말이 아니라 알람이다
  return { id: "type", options: { pitch: SPEAKER_PITCH[speaker] ?? 1, variation: 0.04 } };
}
