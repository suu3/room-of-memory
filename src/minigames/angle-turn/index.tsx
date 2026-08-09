"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { AnswerKeypad, AnswerSlots } from "../answer-input";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";
import { ANSWER_LENGTH, isCorrect, PAIRS } from "./rotation";

/** 미궁 문제는 붙잡고 들여다보는 시간이 길다 — 스킵은 한참 뒤에야 내민다. */
const SKIP_AFTER_MS = 90_000;
const SETTLE_MS = 900;
const NUDGE_MS = 320;

/**
 * 한 쌍. 왼쪽 글자 → 화살표 → 오른쪽 글자.
 *
 * 두 글자를 같은 크기·같은 서체로 세우는 게 문제의 전부다. 크기가 다르면 겹쳐
 * 보는 눈이 흔들리고, 서체가 다르면 돌려도 안 맞는 것처럼 보인다.
 */
function TurnRow({ from, to }: { from: string; to: string }) {
  return (
    <li className="flex items-center justify-center gap-4 sm:gap-6">
      <span className="w-16 text-center text-5xl leading-none text-ink sm:w-20 sm:text-6xl">
        {from}
      </span>
      <ArrowRight size={24} weight="bold" className="shrink-0 text-ink/30" />
      <span className="w-16 text-center text-5xl leading-none text-ink sm:w-20 sm:text-6xl">
        {to}
      </span>
    </li>
  );
}

/**
 * 사인볼 2바퀴의 회전 미궁.
 *
 * 화면에 규칙이 없다. 무엇을 어떻게 돌리라는 말도, 답이 각도라는 말도 없이 글자
 * 세 쌍과 빈칸만 세운다 — "시계 방향으로 몇 도"를 읽는 법은 캐비닛 위 시계가
 * 들고 있다 (src/data/room-clues.ts).
 *
 * 시간을 재지 않는다. 들여다보는 시간이 곧 이 문제의 내용이다.
 */
export function AngleTurnMinigame({ onComplete, onSettled }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const [input, setInput] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [solved, setSolved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const skipEligible = useSkipEligible(SKIP_AFTER_MS);

  const submit = () => {
    if (solved || input.trim() === "") return;

    if (!isCorrect(input)) {
      // 어느 쌍이 틀렸는지 말해주지 않는다. 말해주는 순간 세 쌍이 따로 풀린다.
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

  // 틀린 답은 흔들림이 끝나면 통째로 비운다 — 지워서 고치는 게 아니라 처음부터
  // 다시 적는 문제다. 남겨두면 어느 자리가 틀렸는지 맞춰보라는 힌트가 된다.
  useEffect(() => {
    if (!rejected) return;
    const timer = window.setTimeout(() => {
      setRejected(false);
      setInput("");
    }, NUDGE_MS);
    return () => window.clearTimeout(timer);
  }, [rejected]);

  // 슬롯을 다 채우면 스스로 확인한다 — 슬롯 UI에는 제출 버튼이 없다.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (input.length === ANSWER_LENGTH) submitRef.current();
  }, [input]);

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
      title={t("minigame.angleTurn.title")}
      help={hint("minigame.angleTurn.help")}
      stats={
        attempts > 0 ? (
          <MinigameStat label={t("minigame.angleTurn.attempts")} value={attempts} tone="warning" />
        ) : undefined
      }
      skipVisible={skipEligible && !solved}
      onSkip={() => complete({ cleared: true, score: attempts })}
    >
      <div className="rounded-lg border border-bone bg-paper/60 p-5 sm:p-6">
        <ul className="flex flex-col gap-4 sm:gap-5">
          {PAIRS.map((pair) => (
            <TurnRow key={pair.from} from={pair.from} to={pair.to} />
          ))}
        </ul>
        {/* 답이 몇 자리인지만 알려주는 빈칸. 원본 미궁게임이 쓰던 표기 그대로다. */}
        <p className="mt-6 border-t border-ink/10 pt-5 text-center text-2xl tracking-[0.5em] text-ink/40">
          {/* 밑줄이 읽히면 "언더바 일곱 개"가 되므로, 소리로는 자릿수만 말한다 */}
          <span aria-hidden="true">{"_".repeat(ANSWER_LENGTH)}</span>
          <span className="sr-only">
            {t("minigame.angleTurn.blanks", { count: ANSWER_LENGTH })}
          </span>
        </p>
      </div>

      {/*
       * 자리수가 보이는 슬롯 + 화면 키패드. 빈 칸 수까지는 공짜 힌트다 — 각도의
       * 규칙은 탁상시계가 들고 있다. 다 채우면 스스로 확인하므로 제출 버튼이 없다.
       */}
      <form
        className="mx-auto mt-4 flex w-full max-w-md flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <AnswerSlots
          length={ANSWER_LENGTH}
          value={input}
          onChange={setInput}
          label={t("minigame.angleTurn.answerLabel")}
          rejected={rejected}
          solved={solved}
          disabled={solved}
        />
        <AnswerKeypad length={ANSWER_LENGTH} value={input} onChange={setInput} disabled={solved} />
      </form>
    </MinigameShell>
  );
}
