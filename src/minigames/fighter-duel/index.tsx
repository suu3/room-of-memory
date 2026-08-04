"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";
import {
  applyOutcome,
  DUEL_START,
  duelStatus,
  MAX_LOSSES,
  MOVES,
  type Move,
  opponentMove,
  ROUNDS_TO_WIN,
  type RoundOutcome,
  resolveRound,
} from "./duel";
import { Fighter, type Pose } from "./Fighter";
import { preloadSpriteSheet } from "./sprites";

/*
 * 시트가 있는지 없는지를 첫 라운드 전에 미리 확인해 둔다. 게임이 뜬 뒤에 알아보면
 * 블록 캐릭터가 한 프레임 비쳤다가 스프라이트로 바뀌는 게 보인다.
 * 이 모듈 자체가 게이트 도달 직전에 lazy로 로드되므로 여기가 가장 이른 시점이다.
 */
preloadSpriteSheet(ASSETS.images.mgFighterDuelHero);
preloadSpriteSheet(ASSETS.images.mgFighterDuelRival);

/** 예고를 보고 받아칠 시간. 짧으면 반사신경 게임이 되고, 길면 긴장이 없다. */
const TELL_MS = 1600;
/** 결과 자세를 보여주는 시간. */
const RESULT_MS = 800;
const SKIP_AFTER_MS = 30_000;
const SKIP_AFTER_LOSSES = 2;
/** 1/2/3 — MOVES 순서와 같은 자리. */
const MOVE_KEYS = ["1", "2", "3"] as const;

interface Resolved {
  /** 시간 안에 아무것도 안 냈으면 null. */
  player: Move | null;
  opponent: Move;
  outcome: RoundOutcome;
}

const OUTCOME_TONE: Record<RoundOutcome, string> = {
  win: "text-memory",
  lose: "text-ember",
  draw: "text-bone",
};

function playerPose(resolved: Resolved | null): Pose {
  if (!resolved) return "idle";
  if (resolved.outcome === "lose") return "hurt";
  return resolved.player ?? "idle";
}

function opponentPose(resolved: Resolved | null, tell: Move): Pose {
  if (!resolved) return tell;
  return resolved.outcome === "win" ? "hurt" : resolved.opponent;
}

/**
 * 게임기 속 격투 게임. 상대가 다음 수를 자세로 예고하고, 그걸 받아치는 수를 낸다.
 * 때리기 > 잡기 > 막기 > 때리기 — 반사신경이 아니라 읽기 싸움이다.
 */
export function FighterDuelMinigame({ onComplete, onSettled }: MinigameProps) {
  const { t } = useTranslation();
  const complete = useOnceCompleter(onComplete);
  // 판마다 순서가 달라야 외워서 이기지 않는다. 판 안에서는 고정 (읽는 재미).
  const [salt] = useState(() => Math.floor(Math.random() * 1000));
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(DUEL_START);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const skipByTime = useSkipEligible(SKIP_AFTER_MS);

  const timerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(0);
  const lockedRef = useRef(false);
  const pendingRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const tell = opponentMove(round, salt);

  // rAF·전역 키 리스너에서 최신 값을 보게 ref에 담아 둔다 (매 렌더 갱신).
  const answerRef = useRef((_move: Move | null) => {});
  answerRef.current = (move) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    // 시간 안에 못 내면 그대로 맞는다.
    const outcome: RoundOutcome = move ? resolveRound(move, tell) : "lose";
    const next = applyOutcome(score, outcome);
    setResolved({ player: move, opponent: tell, outcome });
    setScore(next);
    playSound(outcome === "win" ? "success" : outcome === "lose" ? "deny" : "select");

    const status = duelStatus(next);
    // 승부가 났으면 결과 자세를 보여주는 동안 닫히지 않게 잠근다
    if (status !== "playing") onSettled?.();
    const timeout = setTimeout(() => {
      pendingRef.current.delete(timeout);
      if (status === "playing") {
        setRound((current) => current + 1);
        return;
      }
      complete({ cleared: status === "won", score: next.wins });
    }, RESULT_MS);
    pendingRef.current.add(timeout);
  };

  // 새 라운드 — 예고가 뜨는 순간부터 시간을 잰다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: round는 값이 아니라 "새 라운드가 시작됐다"는 신호로만 쓴다.
  useEffect(() => {
    startRef.current = performance.now();
    lockedRef.current = false;
    setResolved(null);
    playSound("flip");
  }, [round]);

  // 남은 시간 바 — setState 없이 ref를 직접 민다.
  useEffect(() => {
    let frame = 0;
    const loop = (now: number) => {
      if (!lockedRef.current) {
        const progress = Math.min(1, (now - startRef.current) / TELL_MS);
        if (timerRef.current) timerRef.current.style.transform = `scaleX(${1 - progress})`;
        if (progress >= 1) answerRef.current(null);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const index = MOVE_KEYS.indexOf(event.key as (typeof MOVE_KEYS)[number]);
      if (index < 0 || event.repeat) return;
      event.preventDefault();
      answerRef.current(MOVES[index]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(
    () => () => {
      for (const timeout of pendingRef.current) clearTimeout(timeout);
      pendingRef.current.clear();
    },
    [],
  );

  const skip = useCallback(() => complete({ cleared: true, score: score.wins }), [complete, score]);

  return (
    <MinigameShell
      title={t("minigame.fighterDuel.title")}
      help={t("minigame.fighterDuel.help")}
      stats={
        <>
          <MinigameStat
            label={t("minigame.fighterDuel.labelWins")}
            value={`${score.wins} / ${ROUNDS_TO_WIN}`}
          />
          <MinigameStat
            label={t("minigame.fighterDuel.labelLosses")}
            value={`${score.losses} / ${MAX_LOSSES}`}
            tone="warning"
          />
        </>
      }
      skipVisible={skipByTime || score.losses >= SKIP_AFTER_LOSSES}
      onSkip={skip}
      size="lg"
    >
      <div className="overflow-hidden rounded-md border-2 border-night bg-scene-abyss">
        <div
          className="relative flex h-64 items-end justify-between bg-cover bg-center px-10 pb-6"
          style={{
            // 무대 그림이 리포에 없으면 그 레이어만 못 그리고 아래 그라디언트가 남는다 —
            // 배경은 이 폴백만으로도 충분해서 존재 확인을 따로 하지 않는다.
            backgroundImage: `url(${ASSETS.images.mgFighterDuelStage}), linear-gradient(var(--color-scene-storm), var(--color-scene-abyss) 78%)`,
          }}
        >
          <span className="absolute inset-x-0 bottom-0 h-6 bg-night/50" aria-hidden />
          <div className="relative">
            <Fighter
              pose={playerPose(resolved)}
              tone="memory"
              facing="right"
              sprite={ASSETS.images.mgFighterDuelHero}
              shake={resolved?.outcome === "lose"}
            />
          </div>

          {/* 예고와 결과는 자세만으로 전하지 않는다 — 글로도 읽히고, 바뀌면 알린다 */}
          <div
            role="status"
            aria-live="polite"
            className="relative flex flex-col items-center gap-3 pb-10 text-center"
          >
            {resolved ? (
              <span
                key={`${round}-outcome`}
                className={`animate-fade-rise font-pixel text-xl tracking-widest ${OUTCOME_TONE[resolved.outcome]}`}
              >
                {t(
                  resolved.player === null
                    ? "minigame.fighterDuel.outcome.late"
                    : `minigame.fighterDuel.outcome.${resolved.outcome}`,
                )}
              </span>
            ) : (
              <span className="font-pixel text-xs leading-relaxed tracking-widest text-bone/80">
                {t(`minigame.fighterDuel.tell.${tell}`)}
              </span>
            )}
          </div>

          <div className="relative">
            <Fighter
              pose={opponentPose(resolved, tell)}
              tone="bone"
              facing="left"
              sprite={ASSETS.images.mgFighterDuelRival}
              shake={resolved?.outcome === "win"}
            />
          </div>
        </div>

        {/* 남은 시간 — 색이 아니라 길이로 읽히게 */}
        <div className="h-1.5 w-full bg-night/60">
          <div ref={timerRef} className="h-full w-full origin-left bg-memory" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        {MOVES.map((move, index) => (
          <button
            key={move}
            type="button"
            onClick={() => answerRef.current(move)}
            className={`cursor-pointer rounded-md border border-ink/15 px-4 py-3 text-base font-bold tracking-wide text-ink transition-all hover:border-ink/40 hover:bg-ink/5 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory ${
              resolved?.player === move ? "border-ink/40 bg-ink/5" : ""
            }`}
          >
            <span className="font-pixel text-xs text-ink/45">{MOVE_KEYS[index]}</span>{" "}
            {t(`minigame.fighterDuel.move.${move}`)}
          </button>
        ))}
      </div>
      <p className="mt-2.5 text-center text-sm text-ink/55">{t("minigame.fighterDuel.hint")}</p>
    </MinigameShell>
  );
}
