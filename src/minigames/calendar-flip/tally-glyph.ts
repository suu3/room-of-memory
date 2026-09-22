/**
 * 正자 한 글자의 다섯 획과 긋는 박자 (calendar-flip의 TallySheet).
 *
 * 폰트 글리프 대신 SVG path 다섯 개로 그린다. 장을 넘겨 正자 장이 드러날 때 획이
 * 하나씩 **그어져야** 해서다 (docs/visual-experiments.md 4장 "달력+벽 메모"). 글자가
 * 아니라 획이 단위라, 마지막 글자의 미완 획(tallyGroups의 remainder)도 같은 path를
 * 앞에서부터 잘라 쓰면 된다. 획 하나가 버틴 하루다.
 *
 * 좌표는 100×100 viewBox. path마다 pathLength=1로 맞춰 두면 dash 한 칸이 획 하나가
 * 되어, stroke-dashoffset 1→0이 곧 획이 그어지는 것이다 (globals.css의 tally-stroke).
 * 여기는 브라우저 없이 도는 순수 값과 함수만 둔다. 그리는 쪽은 TallyGlyph.tsx.
 */

/**
 * 正의 다섯 획, 긋는 순서대로. 세는 사람이 종이에 긋는 순서 그대로다.
 *
 *   1  위 가로획
 *   2  가운데 세로획: 위 가로획에서 바닥까지
 *   3  가운데 짧은 가로획: 세로획에서 오른쪽으로
 *   4  왼쪽 짧은 세로획
 *   5  아래 가로획: 가장 길어 글자를 받친다
 *
 * 획 굵기 9에 둥근 끝(round cap)을 쓰므로 끝점은 테두리에서 굵기의 반만큼 안쪽이다.
 */
export const TALLY_STROKES: readonly string[] = [
  "M14 18H86",
  "M50 18V84",
  "M50 51H80",
  "M24 48V84",
  "M10 84H90",
];

/** 글자 사이의 숨. 목록이 한 항목씩 놓이는 55ms 계단과 같은 박자다 (DESIGN.md Motion). */
export const TALLY_GLYPH_GAP_MS = 55;
/**
 * 한 줄이 다 그어지기까지의 상한. 11월은 30일이라 正 여섯이 서는데, 그 여섯이 넘김
 * 뒤 1.6초 안에 끝나야 "다음 장" 손이 기다리지 않는다. 글자 수가 늘면 획이 빨라진다.
 */
export const TALLY_TOTAL_MS = 1600;
/** 획 하나의 시간 범위. 아래로는 획이 튀어나오는 것처럼 보이고, 위로는 늘어진다. */
export const TALLY_STROKE_MIN_MS = 36;
export const TALLY_STROKE_MAX_MS = 140;

/** 획 수를 0~5로 자른다. remainder(0~4)와 完 글자(5) 둘 다 여기로 들어온다. */
export function clampStrokes(strokes: number): number {
  return Math.min(TALLY_STROKES.length, Math.max(0, Math.floor(strokes)));
}

/**
 * 글자 수에 맞춘 획 하나의 시간. 줄 전체가 totalMs 안에 끝나도록 나눈다.
 *
 * 마지막 글자가 미완이어도 다섯 획으로 친다. 약간 일찍 끝날 뿐 늦지는 않는다.
 * 한계값에 걸리면 상한을 어길 수 있는데(正 아홉 이상), 그건 획이 눈에 안 보일
 * 만큼 빨라지는 것보다 낫다.
 */
export function tallyPace(glyphCount: number, totalMs = TALLY_TOTAL_MS): number {
  const glyphs = Math.max(1, Math.floor(glyphCount));
  const strokes = glyphs * TALLY_STROKES.length;
  const gaps = (glyphs - 1) * TALLY_GLYPH_GAP_MS;
  const perStroke = (totalMs - gaps) / strokes;
  return Math.min(TALLY_STROKE_MAX_MS, Math.max(TALLY_STROKE_MIN_MS, perStroke));
}

/** index번째 글자의 첫 획이 시작하는 시각. 앞 글자들의 다섯 획과 숨을 다 지난 뒤다. */
export function glyphStartMs(
  index: number,
  perStrokeMs: number,
  glyphGapMs = TALLY_GLYPH_GAP_MS,
): number {
  return Math.max(0, Math.floor(index)) * (TALLY_STROKES.length * perStrokeMs + glyphGapMs);
}

/**
 * index번째 글자의 획마다 애니메이션 지연. 획 순서대로 perStrokeMs씩 늦다.
 *
 * strokesShown만큼만 돌려준다. 미완 글자는 있는 획만 긋는 것이지, 없는 획을 감추는
 * 것이 아니다.
 */
export function strokeDelays(
  index: number,
  strokesShown: number,
  perStrokeMs: number,
  glyphGapMs = TALLY_GLYPH_GAP_MS,
): number[] {
  const start = glyphStartMs(index, perStrokeMs, glyphGapMs);
  return Array.from(
    { length: clampStrokes(strokesShown) },
    (_, stroke) => start + stroke * perStrokeMs,
  );
}

/** 줄 전체의 마지막 획이 다 그어지는 시각. 상한(TALLY_TOTAL_MS) 검사용. */
export function tallyEndMs(
  glyphCount: number,
  perStrokeMs: number,
  glyphGapMs = TALLY_GLYPH_GAP_MS,
): number {
  const glyphs = Math.max(1, Math.floor(glyphCount));
  return glyphStartMs(glyphs - 1, perStrokeMs, glyphGapMs) + TALLY_STROKES.length * perStrokeMs;
}
