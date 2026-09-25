"use client";

import { CaretDown, CaretUp, LockSimpleOpen } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SINK_DIAL_CODE } from "@/data/room-clues";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";

/** 몇 번 틀리면 스킵을 내주는가. 시간 경과 쪽이 먼저 오면 그쪽이 이긴다. */
const FAILS_BEFORE_SKIP = 4;
const SKIP_AFTER_MS = 60_000;
/** 맞춘 뒤 자물쇠가 풀린 모습으로 머무는 시간(ms). */
const SETTLE_MS = 800;

/** 다이얼 한 칸을 한 눈금 돌린다. 0~9를 돌아서 순환한다. */
export function turnDigit(value: number, step: 1 | -1): number {
  return (value + step + 10) % 10;
}

/** 두 칸이 비밀번호와 맞는가. */
export function dialMatches(digits: readonly number[], code: string = SINK_DIAL_CODE): boolean {
  return digits.join("") === code;
}

/**
 * 세면대 하부장의 2자리 다이얼 자물쇠 (v4 3-5). 답은 도해의 등번호 11.
 *
 * 화면에는 번호가 무엇인지 적지 않는다. 아빠 메일이 "네 번호로 해놨다"까지만
 * 말하고, 숫자는 방의 유니폼·트로피가 들고 있다. 이 판은 아빠 힌트를 본 뒤에만
 * 열린다 (store의 openPuzzle). 그 전에 하부장을 누르면 혼잣말만 흐른다.
 *
 * 조작: 칸을 고르고(←/→) 돌린다(↑/↓). 맞으면 저절로 열린다. 버튼으로도 된다.
 */
export function SinkDialMinigame({ onComplete, onSettled }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const [digits, setDigits] = useState<number[]>(() => SINK_DIAL_CODE.split("").map(() => 0));
  const [focus, setFocus] = useState(0);
  const [fails, setFails] = useState(0);
  const [solved, setSolved] = useState(false);
  const skipByTime = useSkipEligible(SKIP_AFTER_MS);

  const turn = useCallback(
    (index: number, step: 1 | -1) => {
      if (solved) return;
      playSound("select", { variation: 0.06 });
      setDigits((current) =>
        current.map((value, i) => (i === index ? turnDigit(value, step) : value)),
      );
    },
    [solved],
  );

  const tryOpen = useCallback(() => {
    if (solved) return;
    if (dialMatches(digits)) {
      setSolved(true);
      onSettled?.();
      playSound("success");
      return;
    }
    playSound("deny");
    setFails((count) => count + 1);
  }, [digits, solved, onSettled]);

  useEffect(() => {
    if (!solved) return;
    const timer = window.setTimeout(() => complete({ cleared: true }), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [solved, complete]);

  const keyRef = useRef<(event: KeyboardEvent) => void>(() => {});
  keyRef.current = (event) => {
    if (solved) return;
    if (event.code === "ArrowUp") turn(focus, 1);
    else if (event.code === "ArrowDown") turn(focus, -1);
    else if (event.code === "ArrowLeft") setFocus((index) => Math.max(0, index - 1));
    else if (event.code === "ArrowRight")
      setFocus((index) => Math.min(digits.length - 1, index + 1));
    else if (event.code === "Enter") tryOpen();
    else return;
    event.preventDefault();
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => keyRef.current(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <MinigameShell
      title={t("minigame.sinkDial.title")}
      help={hint("minigame.sinkDial.help")}
      stats={
        fails > 0 ? (
          <MinigameStat label={t("minigame.sinkDial.fails")} value={fails} tone="warning" />
        ) : undefined
      }
      skipVisible={!solved && (fails >= FAILS_BEFORE_SKIP || skipByTime)}
      onSkip={() => complete({ cleared: true })}
    >
      <div className="flex flex-col items-center gap-5 rounded-md border border-ink/12 bg-paper px-5 py-6">
        <div className="flex items-center gap-4">
          {digits.map((value, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: 고정 자리수 다이얼
              key={index}
              className="flex flex-col items-center gap-1"
            >
              <button
                type="button"
                aria-label={t("minigame.sinkDial.up", { index: index + 1 })}
                onClick={() => {
                  setFocus(index);
                  turn(index, 1);
                }}
                className="grid size-10 cursor-pointer place-items-center rounded-sm text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <CaretUp size={20} weight="bold" />
              </button>
              <span
                className={`grid h-20 w-16 place-items-center rounded-md border-2 text-5xl font-bold tabular-nums ${
                  solved
                    ? "border-memory bg-memory/15 text-ink"
                    : focus === index
                      ? "border-ink/60 bg-ink/5 text-ink"
                      : "border-ink/20 text-ink"
                }`}
              >
                {value}
              </span>
              <button
                type="button"
                aria-label={t("minigame.sinkDial.down", { index: index + 1 })}
                onClick={() => {
                  setFocus(index);
                  turn(index, -1);
                }}
                className="grid size-10 cursor-pointer place-items-center rounded-sm text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <CaretDown size={20} weight="bold" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={tryOpen}
          disabled={solved}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-ink px-6 py-2 text-sm font-bold tracking-widest text-paper transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-default disabled:opacity-60"
        >
          <LockSimpleOpen size={16} weight="bold" />
          {t("minigame.sinkDial.open")}
        </button>
      </div>
    </MinigameShell>
  );
}
