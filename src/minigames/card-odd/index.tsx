"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";
import { BOARD, type Card, isCorrect, isIndexFlipped, printedColor, SUIT_GLYPH } from "./cards";

/** 미궁 문제는 붙잡고 들여다보는 시간이 길다 — 스킵은 한참 뒤에야 내민다. */
const SKIP_AFTER_MS = 90_000;
/** 맞힌 판을 잠깐 보여준 뒤 결과 대사로 넘긴다. */
const SETTLE_MS = 900;
const NUDGE_MS = 320;

const RANK_LABEL = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

function rankLabel(rank: number): string {
  return RANK_LABEL[rank - 1] ?? String(rank);
}

/**
 * 카드 한 귀퉁이의 인덱스 — 숫자 위에 문양.
 *
 * 뒤집기는 **이 요소 자체**에 건다. 자리를 잡는 바깥 상자(justify-end)에 걸면 상자가
 * 통째로 돌아가면서 오른쪽에 붙여 둔 내용이 왼쪽으로 넘어간다 — 정상 카드가 전부
 * 어긋나 보이고, 정작 대칭이 깨진 카드만 멀쩡해 보였다.
 */
function CardIndex({ card, tone, flipped }: { card: Card; tone: string; flipped?: boolean }) {
  return (
    <span
      data-flipped={flipped ? "true" : "false"}
      className={`flex flex-col items-center leading-none ${tone} ${flipped ? "rotate-180" : ""}`}
    >
      <span className="text-sm font-bold tabular-nums sm:text-base">{rankLabel(card.rank)}</span>
      <span className="text-xs sm:text-sm">{SUIT_GLYPH[card.suit]}</span>
    </span>
  );
}

/**
 * 2차 조사의 카드 미궁.
 *
 * 미니게임이 아니라 미궁 문제다 — 화면은 그림 한 장과 입력칸뿐이고, 무엇이 틀렸는지
 * 알려주는 문구가 없다. 카드가 지키는 규칙은 방의 다른 곳에 흩어져 있어서,
 * 플레이어가 그걸 모아 와야 그림이 읽힌다.
 *
 * 시간을 재지 않는다. 들여다보는 시간이 곧 이 문제의 내용이고, 2바퀴는 서두르는
 * 국면이 아니다. 접근성 장치인 스킵만 한참 뒤에 뜬다.
 */
export function CardOddMinigame({ onComplete, onSettled }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const [input, setInput] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [solved, setSolved] = useState(false);
  /** 방금 틀렸다는 표시. 흔들림이 끝나면 스스로 지워진다. */
  const [rejected, setRejected] = useState(false);
  const skipEligible = useSkipEligible(SKIP_AFTER_MS);

  const submit = () => {
    if (solved || input.trim() === "") return;

    if (!isCorrect(input)) {
      // 어디가 틀렸는지 말해주지 않는다. 말해주는 순간 문제가 아니라 안내가 된다.
      setAttempts((count) => count + 1);
      setRejected(true);
      playSound("deny");
      return;
    }

    setSolved(true);
    setRejected(false);
    onSettled?.();
    playSound("success");
  };

  useEffect(() => {
    if (!rejected) return;
    const timer = window.setTimeout(() => setRejected(false), NUDGE_MS);
    return () => window.clearTimeout(timer);
  }, [rejected]);

  const attemptsRef = useRef(attempts);
  attemptsRef.current = attempts;
  useEffect(() => {
    if (!solved) return;
    const timer = window.setTimeout(
      () => complete({ cleared: true, score: attemptsRef.current }),
      SETTLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [solved, complete]);

  return (
    <MinigameShell
      title={t("minigame.cardOdd.title")}
      help={hint("minigame.cardOdd.help")}
      stats={
        attempts > 0 ? (
          <MinigameStat label={t("minigame.cardOdd.attempts")} value={attempts} tone="warning" />
        ) : undefined
      }
      skipVisible={skipEligible && !solved}
      onSkip={() => complete({ cleared: true, score: attempts })}
      size="lg"
    >
      {/*
       * 문제 그림. 누를 수 있는 게 아니라 들여다보는 것이라 버튼이 아니다 —
       * 카드를 클릭하게 두면 "골라내는 게임"으로 읽혀서 입력칸이 장식이 된다.
       *
       * 두 줄로 편다. 카드는 세로로 긴 물건이라 4×3으로 깔면 판이 화면보다 높아지고,
       * 높이에 맞춰 줄이면 단서(귀퉁이 인덱스)가 읽을 수 없을 만큼 작아진다.
       */}
      <ul className="mx-auto grid w-[min(100%,105svh)] grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
        {BOARD.map((card) => {
          // 색이 틀린 카드도 인쇄된 색을 그대로 보여준다 — 여기서 티를 내면 문제가 없어진다
          const ink = printedColor(card);
          const tone = ink === "red" ? "text-ember" : "text-ink";
          const flipped = isIndexFlipped(card);

          return (
            <li
              key={`${card.suit}-${card.rank}`}
              aria-label={t("minigame.cardOdd.cardLabel", {
                ink: t(`minigame.cardOdd.ink.${ink}`),
                suit: t(`minigame.cardOdd.suit.${card.suit}`),
                rank: rankLabel(card.rank),
                orientation: t(`minigame.cardOdd.orientation.${flipped ? "flipped" : "upright"}`),
              })}
              className={`flex aspect-[5/7] flex-col justify-between rounded-md border border-bone bg-paper p-1.5 sm:p-2 ${
                solved ? "opacity-70 transition-opacity duration-500" : ""
              }`}
            >
              <span className="flex justify-start">
                <CardIndex card={card} tone={tone} />
              </span>
              <span className={`text-center text-2xl leading-none sm:text-3xl ${tone}`}>
                {SUIT_GLYPH[card.suit]}
              </span>
              <span className="flex justify-end">
                <CardIndex card={card} tone={tone} flipped={flipped} />
              </span>
            </li>
          );
        })}
      </ul>

      <form
        className="mx-auto mt-4 flex w-[min(100%,105svh)] items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          // 폰에서 숫자판이 먼저 뜨게 하되, 붙여넣기·구분기호는 isCorrect가 흘려 넘긴다
          inputMode="numeric"
          autoComplete="off"
          disabled={solved}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-label={t("minigame.cardOdd.answerLabel")}
          placeholder={t("minigame.cardOdd.placeholder")}
          className={`min-w-0 flex-1 rounded-md border bg-paper px-3 py-2 text-lg tabular-nums tracking-[0.3em] text-ink outline-none transition-colors placeholder:tracking-normal placeholder:text-ink/35 focus-visible:border-memory ${
            rejected ? "animate-page-nudge border-ember" : "border-bone"
          } ${solved ? "border-memory text-memory" : ""}`}
        />
        <button
          type="submit"
          disabled={solved || input.trim() === ""}
          className="shrink-0 cursor-pointer rounded-md border border-ink/15 px-5 py-2 text-base font-bold tracking-widest text-ink/70 transition-all hover:border-ink/40 hover:text-ink active:translate-y-px active:bg-ink/5 disabled:cursor-default disabled:opacity-40"
        >
          {t("minigame.cardOdd.submit")}
        </button>
      </form>
    </MinigameShell>
  );
}
