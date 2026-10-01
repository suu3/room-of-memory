"use client";

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { LabFrame } from "@/app/lab/LabFrame";
import { MonologueExitText } from "@/components/ui/dialogue/Monologue";
import {
  EXIT_CHAR_MS,
  EXIT_SPREAD_MS,
  exitDirection,
} from "@/components/ui/dialogue/monologue-exit";
import type { Act } from "@/store/memory-room";

/** 게임 1막 첫 줄과 같은 결의 문장. 어절이 여럿이라 줄바꿈이 공백에서만 꺾이는지도 본다. */
const SAMPLE = "불을 켜지 않아도 어디에 뭐가 있는지 안다. 그게 좋은 건지는 모르겠다.";

/**
 * 혼잣말 물러남 데모 (docs/direction/visual-experiments.md 8장 "혼잣말 1막·2막").
 *
 * Monologue가 구간을 넘길 때 하는 일을 버튼 하나로 돌려 본다. 1차 = 1막(말끝부터 떨어짐),
 * 2차 = 2막(아래에서 위로 모임). intensity는 계단의 폭이다: 1이 게임의 220ms, 0으로 갈수록
 * 네 배까지 벌어져 글자 순서를 눈으로 셀 수 있다. disabled에서는 게임의 폴백 그대로,
 * 문단 전체가 opacity로 물러난다.
 */
export function MonologueExitLab() {
  const [leaving, setLeaving] = useState(false);
  // 다시 세울 때마다 올라가는 번호. 문단의 key로 써서 등장(fade-rise)부터 새로 마운트시킨다.
  const [replay, setReplay] = useState(0);

  return (
    <LabFrame
      title="혼잣말 물러남 · 글자 단위"
      note="물러나기를 누르면 문장이 글자마다 사라진다. 1차는 말끝의 여덟 글자가 마지막부터 아래로 떨어지고 나머지는 뒤따라 꺼진다. 2차는 첫 글자부터 위로 올라가며 모인다. disabled에서는 문단 전체가 그냥 흐려진다."
    >
      {({ intensity, gamePhase, enabled }) => {
        const act: Act = gamePhase === 1 ? 1 : 2;
        // intensity 1이 게임의 폭, 0으로 갈수록 네 배까지 벌어진다
        const spreadMs = EXIT_SPREAD_MS * (1 + 3 * (1 - intensity));
        const totalMs = spreadMs + EXIT_CHAR_MS;

        return (
          <div className="flex flex-col items-center gap-8 py-10">
            {/* 게임의 Monologue와 같은 글자·그림자·접기 규칙. 폭도 방 화면의 기둥과 비슷하게 좁힌다 */}
            <div className="relative w-full max-w-2xl text-center">
              <span aria-hidden className="monologue-veil absolute -inset-x-10 -inset-y-5 -z-10" />
              <p
                key={`line-${replay}`}
                aria-hidden={leaving || undefined}
                className={`monologue-text animate-fade-rise break-ko text-pretty font-pixel text-monologue leading-normal text-ivory transition-opacity duration-300 ${
                  leaving && !enabled ? "opacity-0" : "opacity-100"
                }`}
              >
                {leaving && enabled ? (
                  <MonologueExitText text={SAMPLE} act={act} spreadMs={spreadMs} />
                ) : (
                  SAMPLE
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              {leaving ? (
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-sm border border-fog/30 px-3 py-1.5 hover:border-memory focus-visible:outline-memory"
                  onClick={() => {
                    setReplay((value) => value + 1);
                    setLeaving(false);
                  }}
                >
                  <ArrowCounterClockwiseIcon size={14} weight="bold" />
                  다시 세우기
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-sm border border-fog/30 px-3 py-1.5 hover:border-memory focus-visible:outline-memory"
                  onClick={() => setLeaving(true)}
                >
                  물러나기
                </button>
              )}
              <p className="tabular-nums text-fog">
                {act}막 · {exitDirection(act) === "down" ? "떨어짐" : "모임"} · 폭{" "}
                {Math.round(spreadMs)}ms · 글자 {EXIT_CHAR_MS}ms · 끝 {Math.round(totalMs)}ms
              </p>
            </div>
          </div>
        );
      }}
    </LabFrame>
  );
}
