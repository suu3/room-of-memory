"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { FrequencyTuneMinigame } from "../frequency-tune";
import { useOnceCompleter, useSkipEligible } from "../shell";
import {
  answerLetters,
  hintCount,
  hintedSlots,
  judgeSlots,
  parsePool,
  separateAnswer,
  shufflePool,
} from "./letters";

const SKIP_AFTER_MS = 30_000;
const SKIP_AFTER_MISSES = 3;
/** 오답 표시가 떠 있는 시간(ms). 지나면 칸을 비우고 다시 고르게 한다. */
const WRONG_HOLD_MS = 700;
/** 정답이 금빛으로 서는 시간(ms). 지나면 판이 끝나고 방송(결과 대사)으로 넘어간다. */
const CORRECT_HOLD_MS = 650;

/**
 * 1바퀴 라디오의 두 번째 단계: 주파수를 잡았더니 방송이 나오기 전에,
 * 대답해야 하는 질문 하나가 서 있다.
 *
 * 글자 풀에서 하나씩 뽑아 빈칸을 채운다. 정답·풀은 언어별 i18n 리소스에 있다.
 * 초성 힌트 방식은 한국어에만 있는 개념이라, 세 언어가 같은 규칙으로 돌 수 있는
 * 뽑기 방식을 쓴다 (ko 음절 · en 알파벳 · ja 가타카나).
 */
function QuizBoard({
  onComplete,
  onSettled,
  stage = "play",
}: Pick<MinigameProps, "onComplete" | "onSettled" | "stage">) {
  const { t } = useTranslation();
  const complete = useOnceCompleter(onComplete);
  const answer = t("minigame.radioQuiz.answer");
  const letters = useMemo(() => answerLetters(answer), [answer]);
  // 풀은 마운트마다 한 번 섞는다. 리렌더마다 섞이면 누르려던 글자가 도망간다.
  // 섞은 뒤 정답 글자끼리는 떼어 놓는다: "좀 비"가 나란히 서면 읽는 것이지 답하는 게 아니다
  const pool = useMemo(
    () => separateAnswer(shufflePool(parsePool(t("minigame.radioQuiz.pool"))), answer),
    [t, answer],
  );
  /** 칸마다 든 풀 인덱스. 글자가 아니라 인덱스라 같은 글자가 풀에 둘 있어도 안 섞인다. */
  const [slots, setSlots] = useState<(number | null)[]>(() => letters.map(() => null));
  const [misses, setMisses] = useState(0);
  /** 오답 세 번마다 앞에서부터 한 글자씩 드러난다. 드러난 칸은 지울 수 없다. */
  const hints = hintCount(misses, letters.length);
  /** 판정 연출 중인가: 이 동안은 입력을 받지 않는다. */
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
    if (verdict || slots[slotIndex] === null || slotIndex < hints) return;
    playSound("select");
    const next = [...slots];
    next[slotIndex] = null;
    setSlots(next);
  };

  // 칸이 다 차면 판정만 내린다. 연출과 뒷정리는 아래 verdict 이펙트가 맡는다.
  useEffect(() => {
    if (verdict) return;
    const right = judgeSlots(slots, pool, answer);
    if (right === null) return;
    setVerdict(right ? "correct" : "wrong");
  }, [slots, pool, answer, verdict]);

  // 판정 연출. verdict가 서 있는 동안만 타이머가 살아 있다.
  useEffect(() => {
    if (verdict === "correct") {
      // 결과가 확정됐다. 연출이 흐르는 동안 바깥 클릭·Esc로 판이 닫히면 안 된다.
      onSettledRef.current?.();
      playSound("radioLock");
      const timer = setTimeout(() => complete({ cleared: true }), CORRECT_HOLD_MS);
      return () => clearTimeout(timer);
    }
    if (verdict === "wrong") {
      playSound("deny");
      const timer = setTimeout(() => {
        const nextMisses = misses + 1;
        setSlots(hintedSlots(pool, answer, hintCount(nextMisses, letters.length)));
        setMisses(nextMisses);
        setVerdict(null);
      }, WRONG_HOLD_MS);
      return () => clearTimeout(timer);
    }
  }, [verdict, letters, complete, misses, pool, answer]);

  // Backspace = 마지막으로 채운 칸 지우기 (키보드 플레이).
  const eraseLastRef = useRef(() => {});
  eraseLastRef.current = () => {
    const filled = slots.reduce<number>((last, slot, i) => (slot !== null ? i : last), -1);
    if (filled >= hints) erase(filled);
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

  /*
   * 카드·제목·설명이 없다. 이 화면은 미니게임 패널이 아니라 연출이다. 어두운 방
   * 위에 질문 하나가 서 있어야지, "글자 맞추기"라는 제목이 먼저 서면 긴장이 죽는다.
   * 색도 종이 카드가 아니라 방의 어둠 위에 밝은 글자로 얹는다.
   */
  const slotTone =
    verdict === "correct" || stage === "result"
      ? "border-memory bg-memory/15 text-memory"
      : verdict === "wrong"
        ? "border-ember bg-ember/15 text-ember"
        : "border-bone/40 bg-scene-void/40 text-paper";

  const board = (
    <div className="flex flex-col items-center gap-8">
      {/*
        질문은 픽셀 서체다. 방송 대신 튀어나온 "문제"라 방의 글자(Pretendard)와 다른 결이어야
        하고, 옛 게임의 퀴즈 화면처럼 읽혀야 긴장이 놀이로 넘어간다. 크기는 14의 배수(28px):
        Galmuri14는 그 배수가 아니면 획이 뭉개진다 (globals.css의 .title-logo 참고).
        굵은 웨이트가 없는 서체라 font-bold를 걸지 않는다.
      */}
      <p className="break-ko text-pretty text-center font-pixel text-[1.75rem] leading-relaxed text-paper">
        {t("minigame.radioQuiz.question")}
      </p>

      {/* 빈칸: 결과 화면에서는 정답이 금빛으로 서 있다 */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {letters.map((letter, slotIndex) =>
          stage === "result" ? (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: 고정 길이 정답 칸
              key={slotIndex}
              className={`grid size-16 place-items-center rounded-lg border-2 text-3xl font-bold ${slotTone}`}
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
              // 힌트로 드러난 칸은 금빛 점선: 내가 채운 글자와 구별된다
              className={`grid size-16 cursor-pointer place-items-center rounded-lg border-2 text-3xl font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory ${
                slotIndex < hints && verdict === null
                  ? "border-dashed border-memory/70 text-memory"
                  : slotTone
              }`}
            >
              {slots[slotIndex] !== null ? pool[slots[slotIndex] as number] : ""}
            </button>
          ),
        )}
      </div>

      {/* 오답 한 줄: 자리를 미리 잡아 두어 뜨고 질 때 판이 출렁이지 않게 한다 */}
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
      {/*
        힌트가 막 열렸다는 한 줄. 오답 줄과 자리를 나눠 쓰지 않는다.
        자리는 처음부터 잡아 두고 투명도만 바꾼다. 판이 화면 가운데 서 있어서 줄 하나가
        생기고 없어질 때마다(판정 연출 동안 숨는다) 판 전체가 위아래로 출렁였다.
      */}
      {stage !== "result" && (
        <p
          aria-live="polite"
          aria-hidden={hints === 0 || verdict !== null}
          className={`-mt-6 min-h-5 break-ko text-center text-sm text-memory/80 transition-opacity ${
            hints > 0 && verdict === null ? "opacity-100" : "opacity-0"
          }`}
        >
          {hints > 0 && t("minigame.radioQuiz.hint", { value: hints })}
        </p>
      )}

      {/* 글자 풀 */}
      {stage !== "result" && (
        <div className="flex max-w-[30rem] flex-wrap items-center justify-center gap-3">
          {pool.map((letter, index) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: 섞인 풀은 마운트 동안 고정이다
              key={index}
              type="button"
              disabled={used.has(index) || verdict !== null}
              onClick={() => pick(index)}
              className="grid size-13 cursor-pointer place-items-center rounded-lg border border-bone/30 bg-scene-void/50 text-2xl font-bold text-paper transition-all hover:border-memory hover:text-memory active:translate-y-px disabled:cursor-default disabled:opacity-20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory"
            >
              {letter}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  /*
   * 결과 대사 단계: 답이 선 판만 남긴다. 방송(결과 대사)이 흐르는 동안
   * 화면에 남는 것은 "좀비"라고 대답한 그 자리다 (frequency-tune의 locked와 같은 결).
   */
  if (stage === "result") {
    return (
      <div aria-hidden className="animate-fade-rise">
        {board}
      </div>
    );
  }

  return (
    /*
      pt-14: 틀이 없는 판이라 호스트의 닫기(X, 오른쪽 위 모서리)가 질문 글자 위에 얹혔다.
      닫기 몫의 줄을 비워 두어 질문이 그 아래에서 시작한다.
    */
    <div className="flex w-[min(40rem,94vw)] animate-fade-rise flex-col items-center gap-9 pt-14">
      {board}
      {/*
        스킵은 접근성 장치라 연출을 위해서도 없애지 않는다. 조건이 차면 조용히 선다.
        자리는 처음부터 잡아 둔다 (invisible): 뒤늦게 끼어들면 가운데 선 판이 통째로 올라간다.
      */}
      <button
        type="button"
        onClick={() => complete({ cleared: true })}
        className={`cursor-pointer whitespace-nowrap rounded-full border border-bone/40 px-5 py-1.5 text-sm font-bold tracking-widest text-bone/70 transition-all hover:border-bone hover:text-paper active:translate-y-px ${
          skipByTime || misses >= SKIP_AFTER_MISSES ? "" : "invisible"
        }`}
      >
        {t("minigame.skip")}
      </button>
    </div>
  );
}

/**
 * 1바퀴 라디오 인터랙션 전체: 주파수 잡기(frequency-tune) 뒤에 글자 맞추기가
 * 이어지는 2단계 미니게임이다. 시나리오 스키마는 기억 하나에 미니게임 하나라,
 * 단계 연결은 엔진이 아니라 이 래퍼가 든다. 각 단계는 기존 계약(MinigameProps)
 * 그대로의 자기 완결 컴포넌트고, 결과 보고는 여기서 한 번만 나간다.
 *
 * 주파수 단계 실패는 전체 실패로 올린다(재도전 가능). 스킵은 단계별로 그 단계만
 * 건너뛴다. 접근성 장치가 이야기(질문)까지 건너뛰게 하지는 않는다.
 */
export function RadioQuizMinigame({
  onComplete,
  gamePhase = 1,
  difficulty = "easy",
  stage = "play",
  onSettled,
}: MinigameProps) {
  const complete = useOnceCompleter(onComplete);
  const [step, setStep] = useState<"tune" | "quiz">("tune");

  // 결과 대사 단계는 항상 퀴즈까지 끝난 뒤다. 답이 선 판을 배경으로 남긴다.
  if (stage === "result") {
    return <QuizBoard onComplete={complete} stage="result" />;
  }

  if (step === "tune") {
    return (
      <FrequencyTuneMinigame
        gamePhase={gamePhase}
        difficulty={difficulty}
        onComplete={(result) => {
          if (!result.cleared) {
            complete(result);
            return;
          }
          // 주파수는 잡혔다. 방송 대신 질문이 온다. 성공 소리는 마지막에 한 번만.
          playSound("radioLock");
          setStep("quiz");
        }}
      />
    );
  }

  return <QuizBoard onComplete={complete} onSettled={onSettled} />;
}
