"use client";

import { useState } from "react";
import { LabFrame } from "@/app/lab/LabFrame";
import { CutDissolve } from "@/components/ui/playback/CutDissolve";
import { grainForCut } from "@/components/ui/playback/cut-dissolve";

/** 컷 셋. 그림 대신 씬 토큰의 단색 판이라 장막이 걷히는 결이 그대로 보인다. */
const PANELS = [
  { className: "bg-scene-storm", label: "storm" },
  { className: "bg-scene-khaki", label: "khaki" },
  { className: "bg-scene-olive", label: "olive" },
] as const;

/** 결 이름의 한글. 판 아래 읽는 사람용이다. */
const GRAIN_LABEL = { paper: "종이 섬유", film: "필름 그레인", water: "물 얼룩" } as const;

/** intensity(0~1) → 장막이 걷히는 시간. 0이 가장 짧고(300ms) 1이 가장 길다(1200ms). */
function durationFor(intensity: number): number {
  return Math.round(300 + intensity * 900);
}

const button =
  "rounded-sm border border-fog/30 px-3 py-1.5 text-sm hover:border-memory focus-visible:outline-memory";

/**
 * 컷 dissolve의 단독 데모 (docs/visual-experiments.md 7장 "회상 컷 간" · 10장 11번).
 *
 * 16:9 판 위에 단색 컷 셋이 돌아가며 선다. "다음 컷"을 누르면 PlaybackScene에서 컷이
 * 바뀔 때와 같은 열쇠로 CutDissolve가 새 판을 덮고 결을 따라 걷어낸다. 결은 컷 번호가
 * 정하니(grainForCut) 세 번 누르면 세 결을 한 바퀴 본다. `intensity`는 걷히는 시간이다.
 * `gamePhase`는 이 효과에 물려 있지 않다(컷씬은 1차·2차가 같다). `enabled`를 끄면
 * 컷이 그냥 바뀐다: 본편에서 모션을 끈 사람이 보는 화면이다.
 */
export function CutDissolveLab() {
  const [cutIndex, setCutIndex] = useState(0);
  const panel = PANELS[cutIndex % PANELS.length];
  const grain = grainForCut(cutIndex);

  return (
    <LabFrame
      title="회상 컷 간 · 노이즈 threshold dissolve"
      note="다음 컷을 누르면 새 판이 scene-void 장막에 덮인 채 서고, 노이즈 판을 문턱값으로 잘라 결을 따라 걷힌다. 컷마다 결이 다르다(종이 → 필름 → 물). intensity가 걷히는 시간(300~1200ms). 2차 토글은 물려 있지 않다."
    >
      {({ intensity, enabled }) => (
        <div className="space-y-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-xs border-2 border-night bg-scene-void">
            {/* 컷: 단색 판과 번호. 장막이 걷히면서 번호가 결 사이로 드러나는 것을 본다 */}
            <div
              className={`absolute inset-0 grid place-items-center ${panel.className}`}
              key={cutIndex}
            >
              <span className="font-pixel text-4xl tracking-[0.2em] text-ivory/80">
                CUT {cutIndex + 1}
              </span>
            </div>
            <CutDissolve
              cutKey={`lab:${cutIndex}`}
              grain={grain}
              durationMs={durationFor(intensity)}
              enabled={enabled}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className={button} onClick={() => setCutIndex((i) => i + 1)}>
              다음 컷
            </button>
            <p className="text-sm text-fog">
              컷 {cutIndex + 1} ({panel.label}) · 결 {GRAIN_LABEL[grain]} ({grain}) ·{" "}
              {durationFor(intensity)}ms
            </p>
          </div>
        </div>
      )}
    </LabFrame>
  );
}
