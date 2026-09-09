"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BUTTON_QUIET, PANEL_DARK } from "@/components/ui/ui-classes";
import { useMemoryRoomStore } from "@/store/memory-room";
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

/**
 * ms 경과 후 true — 스킵 UI 노출 타이밍 (시간 경과 또는 N회 실패).
 *
 * 난이도 게이트가 여기 하나뿐이다: 보통 모드에서는 시간이 아무리 지나도 스킵이
 * 열리지 않는다. 미니게임 쪽에서 난이도를 따로 읽지 않는다 — 아홉 게임이 이
 * 훅을 쓰므로, 게이트가 흩어지면 하나쯤은 반드시 빠뜨린다.
 */
export function useSkipEligible(ms: number): boolean {
  const difficulty = useMemoryRoomStore((state) => state.difficulty);
  const [eligible, setEligible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setEligible(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return eligible && difficulty === "easy";
}

/**
 * 미니게임 상태 한 칸.
 *
 * 색으로 뜻을 나눈다 — 진행은 금빛(이 게임에서 금빛 = 기억을 되찾는 중),
 * 실패·시간압박은 벽돌빛. 진행까지 빨갛게 하면 잘 하고 있는데도 경고처럼 읽힌다.
 */
export function MinigameStat({
  label,
  value,
  tone = "progress",
}: {
  label: string;
  value: string | number;
  tone?: "progress" | "warning";
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-sm font-medium text-fog">{label}</span>
      <span
        className={`text-xl font-medium tabular-nums ${
          tone === "warning" ? "text-ember" : "text-memory"
        }`}
      >
        {value}
      </span>
    </span>
  );
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
      className={`${size === "lg" ? "w-[54rem]" : "w-[38rem]"} max-w-[94vw] animate-fade-rise p-5 sm:p-6 ${PANEL_DARK}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        {/* 제목은 좁아지면 접히고, 스킵 버튼은 접근성 장치라 절대 눌리지 않는다 */}
        <h2 className="min-w-0 break-ko text-xl font-medium leading-snug text-ivory">{title}</h2>
        {skipVisible && (
          <button
            type="button"
            onClick={onSkip}
            className={`${BUTTON_QUIET} shrink-0 whitespace-nowrap px-3 py-1.5`}
          >
            {t("minigame.skip")}
          </button>
        )}
      </div>
      <p className="mt-2 break-ko text-pretty text-[0.9375rem] leading-normal text-fog">{help}</p>
      {stats && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-base font-medium text-fog">
          {stats}
        </div>
      )}
      <div className="mt-3">{children}</div>
    </div>
  );
}
