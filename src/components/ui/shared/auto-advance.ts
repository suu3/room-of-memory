/**
 * 오토가 한 줄을 붙들고 있는 시간(ms) = 기본 + 글자당. 대사창과 웹툰 말풍선이 같이 쓴다.
 *
 * 길이와 무관하게 같은 시간을 주면 긴 줄은 읽다 말고 넘어가고 짧은 줄은 늘어진다.
 * 한국어 기준 한 글자에 60ms면 소리 내어 읽는 속도보다 조금 빠르다. 위로 한 번 자른다:
 * 여덟 줄짜리 대사에서 7초를 기다리면 오토가 아니라 멈춘 화면이다.
 */
const AUTO_BASE_MS = 900;
const AUTO_PER_CHAR_MS = 60;
const AUTO_MAX_MS = 5200;

export const autoAdvanceWaitMs = (textLength: number) =>
  Math.min(AUTO_MAX_MS, AUTO_BASE_MS + textLength * AUTO_PER_CHAR_MS);
