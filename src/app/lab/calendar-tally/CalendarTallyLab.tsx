"use client";

import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { useState } from "react";
import { LabFrame } from "@/app/lab/LabFrame";
import { TALLY_PER_MARK, tallyGroups } from "@/minigames/calendar-flip/calendar";
import { TallyGlyph } from "@/minigames/calendar-flip/TallyGlyph";
import { tallyEndMs, tallyPace } from "@/minigames/calendar-flip/tally-glyph";

/**
 * 달력 正자 획 데모 (docs/visual-experiments.md 4장 "달력+벽 메모").
 *
 * 미니게임의 TallySheet가 하는 일을 그대로 종이 한 장 위에 세운다. 날 수 슬라이더로
 * 마지막 글자의 미완 획(remainder)을 바꿔 보고, 다시 긋기로 마운트를 새로 해 처음부터
 * 그어지는 걸 본다. 2차 표시는 없다 (스펙에 2차 없음). intensity는 획 속도다: 1이
 * 게임의 박자, 낮출수록 느려져 획 순서를 눈으로 셀 수 있다.
 */
export function CalendarTallyLab() {
  const [days, setDays] = useState(30);
  // 다시 긋기마다 올라가는 번호. 글자 줄의 key로 써서 매번 새로 마운트시킨다.
  const [replay, setReplay] = useState(0);

  return (
    <LabFrame
      title="달력 正자 획"
      note="正은 글리프가 아니라 SVG 다섯 획이다. 장이 드러날 때 획이 순서대로 그어지고, 마지막 글자의 미완 획 수는 버틴 날의 나머지다. disabled에서는 같은 획이 그냥 서 있다."
    >
      {({ intensity, enabled }) => {
        const { full, remainder } = tallyGroups(days);
        const glyphCount = full + (remainder > 0 ? 1 : 0);
        // intensity 1이 게임 박자, 0으로 갈수록 네 배까지 느려진다
        const slow = 1 + 3 * (1 - intensity);
        const perStrokeMs = tallyPace(glyphCount) * slow;

        return (
          <div className="flex flex-col items-center gap-6 py-6">
            <div className="w-[19rem] max-w-[80vw] rounded-md bg-paper p-4 shadow-panel">
              <div
                key={`row-${replay}-${days}-${enabled ? "on" : "off"}`}
                className="flex min-h-40 max-w-[16rem] flex-wrap items-center justify-center gap-x-2 gap-y-1 mx-auto"
              >
                {Array.from({ length: full }, (_, index) => (
                  <TallyGlyph
                    // biome-ignore lint/suspicious/noArrayIndexKey: 같은 글자의 반복이라 인덱스 말고 구분할 값이 없다.
                    key={`mark-${index}`}
                    strokes={TALLY_PER_MARK}
                    glyphIndex={index}
                    perStrokeMs={perStrokeMs}
                    animate={enabled}
                    className="h-6 w-6 text-ink/80"
                  />
                ))}
                {remainder > 0 ? (
                  <TallyGlyph
                    strokes={remainder}
                    glyphIndex={full}
                    perStrokeMs={perStrokeMs}
                    animate={enabled}
                    className="h-6 w-6 text-ink/80"
                  />
                ) : null}
              </div>
              <p className="pt-3 text-center text-xs tracking-widest text-ink/45">
                {days}일 · 正 {full}
                {remainder > 0 ? ` + ${remainder}획` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <label className="flex items-center gap-3" htmlFor="lab-tally-days">
                <span className="text-fog">days</span>
                <input
                  id="lab-tally-days"
                  type="range"
                  min={1}
                  max={45}
                  step={1}
                  value={days}
                  className="accent-memory"
                  onChange={(event) => setDays(Number(event.target.value))}
                />
                <output className="w-8 tabular-nums text-fog">{days}</output>
              </label>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-sm border border-fog/30 px-3 py-1.5 hover:border-memory focus-visible:outline-memory"
                onClick={() => setReplay((value) => value + 1)}
              >
                <ArrowCounterClockwise size={14} weight="bold" />
                다시 긋기
              </button>
              <p className="tabular-nums text-fog">
                획 {Math.round(perStrokeMs)}ms · 끝{" "}
                {Math.round(tallyEndMs(glyphCount, perStrokeMs))}
                ms
              </p>
            </div>
          </div>
        );
      }}
    </LabFrame>
  );
}
