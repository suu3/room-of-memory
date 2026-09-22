"use client";

import type { CSSProperties } from "react";
import { clampStrokes, strokeDelays, TALLY_GLYPH_GAP_MS, TALLY_STROKES } from "./tally-glyph";

export interface TallyGlyphProps {
  /** 그릴 획 수 (1~5). 5면 正 하나, 그보다 적으면 아직 正이 못 된 마지막 글자다. */
  strokes: number;
  /** 줄에서 몇 번째 글자인가. 앞 글자의 획이 다 그어진 뒤에 제 차례가 온다. */
  glyphIndex?: number;
  /** 획 하나를 긋는 시간. tallyPace가 글자 수에서 계산해 준다. */
  perStrokeMs?: number;
  /** 줄 전체가 첫 획 전에 기다리는 시간 (장이 들려 드러나는 동안 등). */
  delayMs?: number;
  /**
   * false면 획이 그어지지 않고 그냥 있다. 효과 예산(useEffectEnabled)이 끈 기기의
   * 폴백이 이것이다. 정적인 SVG는 움직임이 아니라 폰트 글리프로 되돌아갈 이유가 없다.
   */
  animate?: boolean;
  className?: string;
}

/**
 * SVG 획으로 그린 正자 하나.
 *
 * path마다 pathLength=1을 박아 두어 길이가 다른 다섯 획이 같은 dash 한 칸(1)으로
 * 다뤄진다. 그어지는 애니메이션은 globals.css의 .tally-stroke가 맡고, 여기서는 획마다
 * 지연과 길이만 인라인으로 준다. 획 순서는 TALLY_STROKES가 이미 긋는 순서다.
 *
 * 글자는 장식이라 aria-hidden이다. 버틴 날 수는 옆의 문장(label)이 읽어 준다.
 */
export function TallyGlyph({
  strokes,
  glyphIndex = 0,
  perStrokeMs = 80,
  delayMs = 0,
  animate = true,
  className,
}: TallyGlyphProps) {
  const shown = clampStrokes(strokes);
  const delays = animate ? strokeDelays(glyphIndex, shown, perStrokeMs, TALLY_GLYPH_GAP_MS) : [];

  return (
    // 장식이다. 버틴 날 수는 옆의 문장이 글자로 읽어 준다 (icons.tsx와 같은 규약)
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      role="presentation"
      className={`tally-glyph ${className ?? ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {TALLY_STROKES.slice(0, shown).map((d, stroke) => {
        const style: CSSProperties | undefined = animate
          ? {
              animationDelay: `${delayMs + delays[stroke]}ms`,
              animationDuration: `${perStrokeMs}ms`,
            }
          : undefined;
        return (
          <path
            key={d}
            d={d}
            pathLength={1}
            className={animate ? "tally-stroke" : undefined}
            style={style}
          />
        );
      })}
    </svg>
  );
}
