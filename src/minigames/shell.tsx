"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MinigameResult } from "@/types/minigame";

/** onComplete를 정확히 한 번만 호출하도록 감싼다 (미니게임 계약). */
export function useOnceCompleter(onComplete: (result: MinigameResult) => void) {
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const completeRef = useRef((result: MinigameResult) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onCompleteRef.current(result);
  });
  return completeRef.current;
}

/** ms 경과 후 true — 스킵 UI 노출 타이밍 (접근성 규칙: 시간 경과 또는 N회 실패). */
export function useSkipEligible(ms: number): boolean {
  const [eligible, setEligible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setEligible(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return eligible;
}

/** 미니게임 공통 프레임: 제목 · 조작법 · 상태 표시 · 스킵 버튼. */
export function MinigameShell({
  title,
  help,
  stats,
  skipVisible,
  onSkip,
  size = "md",
  children,
}: {
  title: string;
  help: string;
  stats?: React.ReactNode;
  skipVisible: boolean;
  onSkip: () => void;
  /** 패널 폭 — 플레이 필드가 넓어야 하는 게임은 "lg". */
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={`${size === "lg" ? "w-[44rem]" : "w-[30rem]"} max-w-[94vw] -rotate-1 animate-fade-rise rounded-lg border-2 border-bone bg-paper p-5 shadow-panel`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-ink">
          <span aria-hidden className="w-4 border-t-2 border-dashed border-ember" />
          {title}
        </h2>
        {skipVisible && (
          <button
            type="button"
            onClick={onSkip}
            className="cursor-pointer rounded-full border-2 border-ink/20 px-2.5 py-0.5 text-xs font-bold tracking-widest text-ink/60 transition-colors hover:border-ink/50 hover:text-ink"
          >
            {t("minigame.skip")}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink/70">{help}</p>
      {stats && <div className="mt-3 flex items-center gap-4 text-xs text-ink/60">{stats}</div>}
      <div className="mt-3">{children}</div>
    </div>
  );
}
