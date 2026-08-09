"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { FrequencyTuneMinigame } from "../frequency-tune";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";
import { answerLetters, judgeSlots, parsePool, shufflePool } from "./letters";

const SKIP_AFTER_MS = 30_000;
const SKIP_AFTER_MISSES = 3;
/** 오답 표시가 떠 있는 시간(ms). 지나면 칸을 비우고 다시 고르게 한다. */
const WRONG_HOLD_MS = 700;
/** 정답이 금빛으로 서는 시간(ms). 지나면 판이 끝나고 방송(결과 대사)으로 넘어간다. */
const CORRECT_HOLD_MS = 650;

/**
 * 1바퀴 라디오의 두 번째 단계 — 주파수를 잡았더니 방송이 나오기 전에,
 * 대답해야 하는 질문 하나가 서 있다.
 *
 * 글자 풀에서 하나씩 뽑아 빈칸을 채운다. 정답·풀은 언어별 i18n 리소스에 있다 —
 * 초성 힌트 방식은 한국어에만 있는 개념이라, 세 언어가 같은 규칙으로 돌 수 있는
 * 뽑기 방식을 쓴다 (ko 음절 · en 알파벳 · ja 가타카나).
 */
function QuizBoard({
  onComplete,
  onSettled,
  stage = "play",
}: Pick<MinigameProps, "onComplete" | "onSettled" | "stage">) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const answer = t("minigame.radioQuiz.answer");
  const letters = useMemo(() => answerLetters(answer), [answer]);
  // 풀은 마운트마다 한 번 섞는다 — 리렌더마다 섞이면 누르려던 글자가 도망간다.
  const pool = useMemo(() => shufflePool(parsePool(t("minigame.radioQuiz.pool"))), [t]);
  /** 칸마다 든 풀 인덱스. 글자가 아니라 인덱스라 같은 글자가 풀에 둘 있어도 안 섞인다. */
  const [slots, setSlots] = useState<(number | null)[]>(() => letters.map(() => null));
  const [misses, setMisses] = useState(0);
  /** 판정 연출 중인가 — 이 동안은 입력을 받지 않는다. */
  const [verdict, setVerdict] = useState<"wrong" | "correct" | null>(null);
  const skipByTime = useSkipEligible(SKIP_AFTER_MS);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  const used = new Set(slots.filter((slot) => slot !== null));

  const pick = (index: number) => {
    if (verdict) return;
    const empty = slots.indexOf(null);
    if (empty === -1 || used.has(index)) return;
    playSound("select");
    const next = [...slots];
    next[empty] = index;
    setSlots(next);
  };

  const erase = (slotIndex: number) => {
    if (verdict || slots[slotIndex] === null) return;
    playSound("select");
    const next = [...slots];
    next[slotIndex] = null;
    setSlots(next);
  };

  // 칸이 다 차면 판정만 내린다 — 연출과 뒷정리는 아래 verdict 이펙트가 맡는다.
  useEffect(() => {
    if (verdict) return;
    const right = judgeSlots(slots, pool, answer);
    if (right === null) return;
    setVerdict(right ? "correct" : "wrong");
  }, [slots, pool, answer, verdict]);

  // 판정 연출. verdict가 서 있는 동안만 타이머가 살아 있다.
  useEffect(() => {
    if (verdict === "correct") {
      // 결과가 확정됐다 — 연출이 흐르는 동안 바깥 클릭·Esc로 판이 닫히면 안 된다.
      onSettledRef.current?.();
      playSound("radioLock");
      const timer = setTimeout(() => complete({ cleared: true }), CORRECT_HOLD_MS);
      return () => clearTimeout(timer);
    }
    if (verdict === "wrong") {
      playSound("deny");
      const timer = setTimeout(() => {
        setSlots(letters.map(() => null));
        setMisses((count) => count + 1);
        setVerdict(null);
      }, WRONG_HOLD_MS);
      return () => clearTimeout(timer);
    }
  }, [verdict, letters, complete]);

  // Backspace = 마지막으로 채운 칸 지우기 (키보드 플레이).
  const eraseLastRef = useRef(() => {});
  eraseLastRef.current = () => {
    const filled = slots.reduce<number>((last, slot, i) => (slot !== null ? i : last), -1);
    if (filled >= 0) erase(filled);
  };
  useEffect(() => {
    if (stage === "result") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Backspace") return;
      event.preventDefault();
      eraseLastRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage]);

  const slotTone =
    verdict === "correct" || stage === "result"
      ? "border-memory bg-memory/10 text-ink"
      : verdict === "wrong"
        ? "border-ember bg-ember/10 text-ember"
        : "border-ink/25 bg-paper text-ink";

  const board = (
    <div className="flex flex-col items-center gap-6">
      <p className="break-ko text-pretty text-center text-xl font-bold leading-relaxed text-ink">
        {t("minigame.radioQuiz.question")}
      </p>

      {/* 빈칸 — 결과 화면에서는 정답이 금빛으로 서 있다 */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {letters.map((letter, slotIndex) =>
          stage === "result" ? (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: 고정 길이 정답 칸
              key={slotIndex}
              className={`grid size-14 place-items-center rounded-lg border-2 text-2xl font-bold ${slotTone}`}
            >
              {letter}
            </span>
          ) : (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: 고정 길이 정답 칸
              key={slotIndex}
              type="button"
              aria-label={t("minigame.radioQuiz.slotLabel", { index: slotIndex + 1 })}
              onClick={() => erase(slotIndex)}
              className={`grid size-14 cursor-pointer place-items-center rounded-lg border-2 text-2xl font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory ${slotTone}`}
            >
              {slots[slotIndex] !== null ? pool[slots[slotIndex] as number] : ""}
            </button>
          ),
        )}
      </div>

      {/* 오답 한 줄 — 자리를 미리 잡아 두어 뜨고 질 때 판이 출렁이지 않게 한다 */}
      {stage !== "result" && (
        <p
          aria-live="polite"
          className={`min-h-6 break-ko text-center text-base font-bold text-ember transition-opacity ${
            verdict === "wrong" ? "opacity-100" : "opacity-0"
          }`}
        >
          {t("minigame.radioQuiz.wrong")}
        </p>
      )}

      {/* 글자 풀 */}
      {stage !== "result" && (
        <div className="flex max-w-[26rem] flex-wrap items-center justify-center gap-2.5">
          {pool.map((letter, index) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: 섞인 풀은 마운트 동안 고정이다
              key={index}
              type="button"
              disabled={used.has(index) || verdict !== null}
              onClick={() => pick(index)}
              className="grid size-12 cursor-pointer place-items-center rounded-lg border border-ink/20 bg-paper text-xl font-bold text-ink transition-all hover:border-memory hover:text-ink active:translate-y-px disabled:cursor-default disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
            >
              {letter}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  /*
   * 결과 대사 단계: 패널을 걷고 답이 선 판만 남긴다 — 방송(결과 대사)이 흐르는 동안
   * 화면에 남는 것은 "좀비"라고 대답한 그 자리다 (frequency-tune의 locked와 같은 결).
   */
  if (stage === "result") {
    return (
      <div
        aria-hidden
        className="w-[38rem] max-w-[94vw] animate-fade-rise rounded-xl border border-bone bg-paper p-7"
      >
        {board}
      </div>
    );
  }

  return (
    <MinigameShell
      title={t("minigame.radioQuiz.title")}
      help={hint("minigame.radioQuiz.help")}
      stats={
        <MinigameStat
          label={t("minigame.labelMiss")}
          value={`${misses} / ${SKIP_AFTER_MISSES}`}
          tone="warning"
        />
      }
      skipVisible={skipByTime || misses >= SKIP_AFTER_MISSES}
      onSkip={() => complete({ cleared: true })}
    >
      {board}
    </MinigameShell>
  );
}

/**
 * 1바퀴 라디오 인터랙션 전체 — 주파수 잡기(frequency-tune) 뒤에 글자 맞추기가
 * 이어지는 2단계 미니게임이다. 시나리오 스키마는 기억 하나에 미니게임 하나라,
 * 단계 연결은 엔진이 아니라 이 래퍼가 든다 — 각 단계는 기존 계약(MinigameProps)
 * 그대로의 자기 완결 컴포넌트고, 결과 보고는 여기서 한 번만 나간다.
 *
 * 주파수 단계 실패는 전체 실패로 올린다(재도전 가능). 스킵은 단계별로 그 단계만
 * 건너뛴다 — 접근성 장치가 이야기(질문)까지 건너뛰게 하지는 않는다.
 */
export function RadioQuizMinigame({
  onComplete,
  gamePhase = 1,
  stage = "play",
  onSettled,
}: MinigameProps) {
  const complete = useOnceCompleter(onComplete);
  const [step, setStep] = useState<"tune" | "quiz">("tune");

  // 결과 대사 단계는 항상 퀴즈까지 끝난 뒤다 — 답이 선 판을 배경으로 남긴다.
  if (stage === "result") {
    return <QuizBoard onComplete={complete} stage="result" />;
  }

  if (step === "tune") {
    return (
      <FrequencyTuneMinigame
        gamePhase={gamePhase}
        onComplete={(result) => {
          if (!result.cleared) {
            complete(result);
            return;
          }
          // 주파수는 잡혔다 — 방송 대신 질문이 온다. 성공 소리는 마지막에 한 번만.
          playSound("radioLock");
          setStep("quiz");
        }}
      />
    );
  }

  return <QuizBoard onComplete={complete} onSettled={onSettled} />;
}
