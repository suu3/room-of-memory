"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keycap, KeyHint } from "@/components/ui/shared/Keycap";
import { BUTTON_QUIET, PANEL_FRAME } from "@/components/ui/shared/ui-classes";
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
 * ms 경과 후 true: 스킵 UI 노출 타이밍 (시간 경과 또는 N회 실패).
 *
 * 이지·보통 모두 스킵이 열린다 (2026-09-28: 스킵을 숨기던 예전 "보통"을 없앴다.
 * 스토어의 Difficulty). 스킵 타이밍을 한곳에 두는 이유는 그대로다: 아홉 게임이
 * 이 훅을 쓰므로, 흩어지면 하나쯤은 반드시 빠뜨린다.
 */
export function useSkipEligible(ms: number): boolean {
  const [eligible, setEligible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setEligible(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return eligible;
}

/**
 * 미니게임 상태 한 칸.
 *
 * 색으로 뜻을 나눈다. 진행은 금빛(이 게임에서 금빛 = 기억을 되찾는 중),
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

/** 안내문 끝에 붙는 키 이름. 이것만 키캡으로 떼어내 조작법이 한눈에 잡히게 한다. */
const KEY_TOKEN = /^(?:Space|Enter|Esc|Shift|Tab|[←→↑↓])$/;

/**
 * "…휘두르세요: Space" / "…지나는 순간 Space" / "…넘겨보세요: ← →" 에서 키를 뗀다.
 * 키가 아닌 말이 섞인 꼬리("1 공격 · 2 방어")는 그대로 둔다. 문장이지 키캡이 아니다.
 */
function splitHelpKeys(help: string): { text: string; keys: string[] } {
  const dashed = help.split(/:\s+/);
  if (dashed.length === 2) {
    const words = dashed[1].split(/\s+/);
    if (words.every((word) => KEY_TOKEN.test(word))) return { text: dashed[0], keys: words };
    return { text: help, keys: [] };
  }
  const words = help.trim().split(/\s+/);
  const last = words.at(-1);
  if (words.length > 1 && last && KEY_TOKEN.test(last)) {
    return { text: words.slice(0, -1).join(" "), keys: [last] };
  }
  return { text: help, keys: [] };
}

/**
 * 조작 안내 한 줄: 끝의 키 이름은 떼어 뒤에 세우고, 문장 속 키는 제자리에서 키캡으로
 * 바꾼다 ("클릭 · Space · →"). 시작 카드와 프레임이 같이 쓴다.
 */
export function MinigameHelp({ help, className }: { help: string; className?: string }) {
  const { text, keys } = splitHelpKeys(help);
  return (
    // 안내문의 줄바꿈(\n)을 살린다: 마우스 조작과 키 조작을 두 줄로 가르는 데 쓴다
    <p className={`whitespace-pre-line ${className ?? ""}`}>
      <KeyHint text={text} />
      {keys.map((key) => (
        <Keycap key={key} className="ml-2">
          {key}
        </Keycap>
      ))}
    </p>
  );
}

/**
 * 미니게임 공통 프레임: 제목 · 조작법 · 상태 표시 · 스킵 버튼.
 *
 * 도구의 틀이다. 게임 화면이 주인공이라 설명 영역은 얇게(18px 24px), 틀은 게임
 * 화면보다 한 톤 밝은 청회색(panel)으로 경계를 또렷하게 세운다. 대사창(자막)·혼잣말
 * (배경 없음)과 같은 팔레트를 쓰되 역할이 다르다는 게 모양에서 읽혀야 한다.
 */
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
  /** 패널 폭: 플레이 필드가 넓어야 하는 게임은 "lg". */
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    /*
     * 세로도 창 안에 가둔다. 폭만 잡아 두면 낮은 창(짧은 노트북 · 가로로 돌린 폰)에서
     * 패널이 화면보다 커져 게임 화면의 아래쪽이 잘린다. 설명 칸은 제 높이를 지키고
     * 게임 화면만 남은 높이를 받도록 세로 flex로 세운다 (min-h-0이 없으면 flex 자식이
     * 제 내용보다 작아지지 않아 제한이 먹지 않는다).
     */
    <div
      className={`${size === "lg" ? "w-[54rem]" : "w-[38rem]"} flex max-h-[94svh] max-w-[94vw] flex-col animate-fade-rise ${PANEL_FRAME}`}
    >
      <div className="shrink-0 px-6 pt-[18px]">
        {/* 오른쪽 끝은 호스트의 닫기 버튼 자리(44px)다. 스킵이 그 밑에 깔리지 않게 비운다 */}
        <div className="flex items-baseline justify-between gap-3 pr-12">
          {/* 제목은 좁아지면 접히고, 스킵 버튼은 접근성 장치라 절대 눌리지 않는다 */}
          <h2 className="min-w-0 break-ko text-lg font-semibold leading-snug text-ivory">
            {title}
          </h2>
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
        <MinigameHelp
          help={help}
          className="mt-1 break-ko text-pretty text-[13px] leading-[1.6] text-fog"
        />
        {stats && (
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-base font-medium text-fog">
            {stats}
          </div>
        )}
      </div>
      {/* 게임 화면: 설명과 14px 띄운다. 남은 높이를 받고, 넘치면 게임 쪽이 줄어든다 */}
      <div className="mt-3.5 min-h-0 flex-1 px-6 pb-6">{children}</div>
    </div>
  );
}
