"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";

/**
 * 시각 실험의 단독 데모 틀 (docs/visual-experiments.md 9장).
 *
 * 효과 하나를 `intensity`(0~1) 슬라이더, `gamePhase`(1차/2차) 토글, `enabled` 토글로
 * 돌려 본다. 실험이 완료로 인정되는 기준이 이 세 조작이다: 1차와 2차가 다르게 보이고,
 * enabled=false에서 폴백이 서야 한다.
 *
 * `*.dev.tsx` 라우트 안에서만 쓰인다. 프로덕션 빌드에는 이 페이지들이 없다.
 */
export interface LabControls {
  intensity: number;
  gamePhase: 1 | 2;
  enabled: boolean;
}

const button =
  "rounded-sm border border-fog/30 px-3 py-1.5 text-sm hover:border-memory focus-visible:outline-memory";

export function LabFrame({
  title,
  note,
  children,
}: {
  title: string;
  /** 무엇을 보면 되는지 한두 줄. */
  note: string;
  children: (controls: LabControls) => ReactNode;
}) {
  const [intensity, setIntensity] = useState(1);
  const [gamePhase, setGamePhase] = useState<1 | 2>(1);
  const [enabled, setEnabled] = useState(true);

  return (
    <main className="flex min-h-dvh flex-col bg-night text-ivory">
      <header className="mx-auto w-full max-w-5xl space-y-2 p-6">
        <p className="text-sm text-memory">
          <Link href="/lab" className="hover:underline">
            기억의 방 · 시각 실험실
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-fog">{note}</p>
      </header>
      <section className="relative mx-auto w-full max-w-5xl flex-1 px-6">
        {children({ intensity, gamePhase, enabled })}
      </section>
      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-4 p-6 text-sm">
        <label className="flex min-w-64 flex-1 items-center gap-3" htmlFor="lab-intensity">
          <span className="text-fog">intensity</span>
          <input
            id="lab-intensity"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={intensity}
            className="min-w-0 flex-1 accent-memory"
            onChange={(event) => setIntensity(Number(event.target.value))}
          />
          <output className="w-10 tabular-nums text-fog">{intensity.toFixed(2)}</output>
        </label>
        <div className="flex gap-2">
          {([1, 2] as const).map((phase) => (
            <button
              key={phase}
              type="button"
              aria-pressed={gamePhase === phase}
              className={`${button} ${gamePhase === phase ? "border-memory text-memory" : ""}`}
              onClick={() => setGamePhase(phase)}
            >
              {phase}차
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={enabled}
          className={`${button} ${enabled ? "border-memory text-memory" : ""}`}
          onClick={() => setEnabled((value) => !value)}
        >
          {enabled ? "enabled" : "disabled (폴백)"}
        </button>
      </footer>
    </main>
  );
}
