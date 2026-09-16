"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { playSound, playTone } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";
import {
  barVisible,
  isComplete,
  isPrefix,
  MELODY_BARS,
  NOTE_HZ,
  noteForKey,
  SOLFEGE,
  type Solfege,
} from "./melody";

/** 미궁 문제는 붙잡고 들여다보는 시간이 길다. 스킵은 한참 뒤에야 내민다. */
const SKIP_AFTER_MS = 60_000;
/** 마지막 음이 울린 뒤 결과를 내주기까지. 음이 채 끝나기 전에 창이 닫히지 않게. */
const SETTLE_MS = 900;
/** 틀린 뒤 건반이 잠기는 시간. 손이 멈출 만큼만. */
const REJECT_MS = 420;

/** 악보에 적힌 한 음. 지워진 마디에서는 글자 대신 번진 자국이 선다. */
function SheetNote({ label }: { label: string | null }) {
  return (
    <li
      className={`grid size-9 place-items-center rounded-sm border text-sm font-medium ${
        label === null
          ? "border-ink/10 bg-ink/10 text-transparent"
          : "border-ink/15 bg-paper text-ink"
      }`}
    >
      {label ?? "·"}
    </li>
  );
}

/**
 * 거실 피아노의 멜로디 자물쇠.
 *
 * 악보에 적힌 계이름을 그대로 누르면 열린다. 듣고 맞히는 문제가 아니다: 절대음감을
 * 요구하면 못 푸는 사람이 확실히 생기고, 그건 난이도가 아니라 벽이다. 대신 악보의 한
 * 마디가 물에 번져 안 보이고, 그 마디는 안방 책상의 찢어진 조각이 들고 있다. 문제의
 * 내용은 연주가 아니라 **저쪽 공간에서 이쪽으로 가져오는 일**이다.
 *
 * 조각이 없어도 칠 수는 있다. 막아 두면 순서가 하나뿐인 길이 되어, 조각을 못 찾은
 * 사람은 피아노 앞에서 할 일이 없어진다. 세 음을 찍는 건 가능하되 지루하도록 둔다.
 */
export function PianoMelodyMinigame({ onComplete, onSettled, carrying = [] }: MinigameProps) {
  /** 찢어진 악보 조각을 들고 있으면 지워진 마디가 드러난다 (src/data/items.ts). */
  const hasScrap = carrying.includes("piano-sheet");
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const [played, setPlayed] = useState<Solfege[]>([]);
  const [misses, setMisses] = useState(0);
  const [rejected, setRejected] = useState(false);
  const [solved, setSolved] = useState(false);
  const skipEligible = useSkipEligible(SKIP_AFTER_MS);

  const pressRef = useRef<(note: Solfege) => void>(() => {});
  pressRef.current = (note: Solfege) => {
    if (solved || rejected) return;
    playTone(NOTE_HZ[note]);
    const next = [...played, note];

    if (!isPrefix(next)) {
      setMisses((count) => count + 1);
      setRejected(true);
      playSound("fail");
      window.setTimeout(() => {
        setPlayed([]);
        setRejected(false);
      }, REJECT_MS);
      return;
    }

    setPlayed(next);
    if (!isComplete(next)) return;

    setSolved(true);
    onSettled?.();
    // 마지막 음이 울리는 동안은 화면을 남겨 둔다. 소리가 끊기면 푼 느낌도 끊긴다
    window.setTimeout(() => complete({ cleared: true, score: misses }), SETTLE_MS);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const note = noteForKey(event.key);
      if (note === null) return;
      event.preventDefault();
      pressRef.current(note);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <MinigameShell
      title={t("minigame.pianoMelody.title")}
      help={hint("minigame.pianoMelody.help")}
      stats={<MinigameStat label={t("minigame.pianoMelody.played")} value={played.length} />}
      skipVisible={skipEligible && !solved}
      onSkip={() => complete({ cleared: true, score: misses })}
    >
      {/* 악보: 마디마다 계이름 세 개. 지워진 마디는 조각을 들고 있을 때만 드러난다 */}
      <div className="rounded-md border border-ink/10 bg-bone/70 px-4 py-3.5">
        <p className="text-xs font-medium tracking-[0.12em] text-graphite">
          {t("minigame.pianoMelody.sheetLabel")}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-3">
          {MELODY_BARS.map((bar, index) => {
            const shown = barVisible(index, hasScrap);
            return (
              <ul
                // biome-ignore lint/suspicious/noArrayIndexKey: 마디의 자리가 곧 마디다
                key={index}
                className="flex items-center gap-1.5"
              >
                {bar.map((note, noteIndex) => (
                  <SheetNote
                    // biome-ignore lint/suspicious/noArrayIndexKey: 같은 음이 한 마디에 두 번 온다
                    key={noteIndex}
                    label={shown ? t(`minigame.pianoMelody.notes.${note}` as const) : null}
                  />
                ))}
              </ul>
            );
          })}
        </div>
        {!barVisible(1, hasScrap) && (
          <p className="mt-2.5 break-ko text-xs text-graphite">
            {t("minigame.pianoMelody.missing")}
          </p>
        )}
      </div>

      {/* 건반: 흰 건반 일곱. 누른 만큼 왼쪽부터 금빛으로 남는다 */}
      <div
        className={`mt-4 flex gap-1 transition-transform duration-150 ${rejected ? "translate-x-1" : ""}`}
      >
        {SOLFEGE.map((note, index) => {
          const name = t(`minigame.pianoMelody.notes.${note}` as const);
          return (
            <button
              key={note}
              type="button"
              disabled={solved || rejected}
              aria-label={t("minigame.pianoMelody.keyLabel", { name })}
              onClick={() => pressRef.current(note)}
              className="flex h-28 flex-1 cursor-pointer flex-col items-center justify-end gap-1 rounded-b-sm border border-ink/15 bg-paper pb-2 text-ink transition-colors duration-100 hover:bg-card active:bg-bone disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
            >
              <span className="text-sm font-medium">{name}</span>
              <span className="text-[10px] tabular-nums text-graphite">{index + 1}</span>
            </button>
          );
        })}
      </div>

      {/* 친 음: 지금까지 어디까지 왔는지. 틀리면 통째로 비워진다 */}
      <p className="mt-3 flex min-h-6 items-center gap-1.5">
        {played.map((note, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 같은 음을 연달아 친다
            key={index}
            className="grid size-6 place-items-center rounded-sm bg-memory/20 text-xs font-medium text-memory"
          >
            {t(`minigame.pianoMelody.notes.${note}` as const)}
          </span>
        ))}
        {solved && (
          <span className="ml-1 break-ko text-sm text-memory">
            {t("minigame.pianoMelody.solved")}
          </span>
        )}
      </p>
    </MinigameShell>
  );
}
