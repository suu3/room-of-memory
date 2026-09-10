"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";
import {
  applyRound,
  beats,
  CRITICAL_MS,
  canUseSpecial,
  counterTo,
  DUEL_START,
  DUEL_TUNINGS,
  type DuelState,
  damageOf,
  duelStatus,
  FEINT_AT,
  hpRatio,
  isCritical,
  isEnraged,
  MOVES,
  type Move,
  planRound,
  type RoundOutcome,
  type RoundPlan,
  resolveRound,
  SPECIAL_USES,
} from "./duel";
import { Fighter, type Pose } from "./Fighter";
import { HealthBar } from "./HealthBar";
import { preloadSpriteSheet } from "./sprites";

/*
 * 시트가 있는지 없는지를 첫 라운드 전에 미리 확인해 둔다. 게임이 뜬 뒤에 알아보면
 * 블록 캐릭터가 한 프레임 비쳤다가 스프라이트로 바뀌는 게 보인다.
 * 이 모듈 자체가 게이트 도달 직전에 lazy로 로드되므로 여기가 가장 이른 시점이다.
 */
preloadSpriteSheet(ASSETS.images.mgFighterDuelHero);
preloadSpriteSheet(ASSETS.images.mgFighterDuelRival);

/** 결과 자세를 보여주는 시간. */
const RESULT_MS = 850;
/** 승부가 난 뒤 KO 연출을 보여주는 시간. */
const KO_MS = 1500;
/** 첫 라운드 전에 "FIGHT!"가 떠 있는 시간. */
const INTRO_MS = 900;
/**
 * 프레임이 이만큼 끊기면 라운드 시계를 그만큼 뒤로 민다 (탭 전환·긴 로드).
 * 60fps에서 프레임 간격은 16ms라, 이 값에 걸리는 건 화면이 실제로 멈춘 경우뿐이다.
 */
const STALL_MS = 400;
const SKIP_AFTER_MS = 30_000;
/** 이 체력 아래로 떨어지면 스킵을 열어 둔다 (접근성: 어느 난이도든 두 번 맞으면 보인다). */
const SKIP_AT_HP = 0.78;
/** 1/2/3: MOVES 순서와 같은 자리. */
const MOVE_KEYS = ["1", "2", "3"] as const;
/**
 * 도해 시트는 프레임 안에서 발이 상대 시트보다 높이 앉아 있어, 그대로 두면
 * 혼자 바닥에서 떠 보인다. 시트를 다시 그리는 대신 그리는 자리를 내린다.
 */
const HERO_OFFSET_Y = 16;

/** 점 개수는 고정이고 자리가 곧 정체성이라, 키를 미리 박아 둔다. */
const SPECIAL_SLOTS = Array.from({ length: SPECIAL_USES }, (_, slot) => `special-${slot}`);

/**
 * 남은 필살기 횟수. 숫자가 아니라 점으로 보여준다. 판이 도는 중에 읽어야 해서
 * "두 번 남았다"보다 "두 개 켜져 있다"가 빠르다. 쓰면 꺼지고 다시 켜지지 않는다.
 */
function SpecialMeter({ charged }: { charged: number }) {
  return (
    <span aria-hidden className="flex gap-0.5">
      {SPECIAL_SLOTS.map((key, slot) => (
        <span
          key={key}
          className={`size-1.5 rounded-full ${slot < charged ? "bg-memory" : "bg-ivory/20"}`}
        />
      ))}
    </span>
  );
}

/** 한 라운드가 끝난 자리에 남는 것: 화면이 읽어서 자세·숫자·문구로 옮긴다. */
interface Resolved {
  /** 시간 안에 아무것도 안 냈으면 null. */
  player: Move | null;
  opponent: Move;
  outcome: RoundOutcome;
  critical: boolean;
  /** 이번 라운드에 깎인 체력. 무승부면 0. */
  damage: number;
}

const OUTCOME_TONE: Record<RoundOutcome, string> = {
  win: "text-memory",
  lose: "text-ember",
  draw: "text-bone",
};

function playerPose(resolved: Resolved | null, over: boolean): Pose {
  if (!resolved) return "idle";
  if (over) return resolved.outcome === "win" ? "win" : "ko";
  if (resolved.outcome === "lose") return "hurt";
  return resolved.player ?? "idle";
}

function opponentPose(resolved: Resolved | null, tell: Move, over: boolean): Pose {
  if (!resolved) return tell;
  if (over) return resolved.outcome === "win" ? "ko" : "win";
  return resolved.outcome === "win" ? "hurt" : resolved.opponent;
}

/**
 * 게임기 속 격투 게임. 상대가 다음 수를 자세로 예고하고, 그걸 받아치는 수를 낸다.
 * 공격 > 필살기 > 방어 > 공격: 반사신경이 아니라 읽기 싸움이다.
 * 필살기만 횟수가 있어 세 수가 대등하지 않다. 방어 예고를 이기려면 필살기가 남아 있어야 한다.
 *
 * 읽기만으로 끝나지 않게 세 가지가 얹혀 있다(규칙은 ./duel.ts):
 * 연속으로 읽어내면 세게 들어가고(콤보), 빨리 읽으면 한 방이 커지고(간파),
 * 대신 상대는 예고를 도중에 바꾼다(페인트). 서두를수록 크게 이기고 크게 당한다.
 */
export function FighterDuelMinigame({ onComplete, onSettled, difficulty = "easy" }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  // 상대의 손맛만 난이도를 탄다 (./duel.ts의 DUEL_TUNINGS)
  const tuning = DUEL_TUNINGS[difficulty];
  // 판마다 순서가 달라야 외워서 이기지 않는다. 판 안에서는 고정 (읽는 재미).
  const [salt] = useState(() => Math.floor(Math.random() * 1000));
  const [state, setState] = useState<DuelState>(DUEL_START);
  const [plan, setPlan] = useState<RoundPlan>(() => planRound(DUEL_START, salt, [], 1));
  /** 지금 화면에 걸려 있는 예고. 페인트가 들어오면 바뀐다. */
  const [shown, setShown] = useState<Move>(plan.tell);
  /** 페인트가 들어온 라운드를 표시로 남긴다 (0이면 아직 없음). */
  const [feintAt, setFeintAt] = useState(0);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [criticals, setCriticals] = useState(0);
  /** 라운드 진행 열쇠: 결과 연출이 끝나면 올라가고, 그때 다음 라운드가 짜인다. */
  const [roundKey, setRoundKey] = useState(0);
  const [live, setLive] = useState(false);
  const [over, setOver] = useState<"won" | "lost" | null>(null);
  const skipByTime = useSkipEligible(SKIP_AFTER_MS);

  const timerRef = useRef<HTMLDivElement>(null);
  /** 이번 라운드의 시계. 0이면 "아직 첫 프레임을 못 봤다". 그때까진 시간이 안 간다. */
  const roundStartRef = useRef(0);
  /** 직전 프레임 시각. 프레임 사이가 벌어지면 그만큼 화면이 멈춰 있었다는 뜻이다. */
  const lastFrameRef = useRef(0);
  /** 지금 걸린 예고가 뜬 시각: 간파는 여기서부터 잰다 (페인트면 다시 0). */
  const tellShownRef = useRef(0);
  const feintDoneRef = useRef(false);
  const lockedRef = useRef(true);
  const liveRef = useRef(false);
  liveRef.current = live;
  /** 플레이어가 낸 수의 이력: 상대의 페인트가 이걸 읽는다. */
  const historyRef = useRef<Move[]>([]);
  const pendingRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // rAF·전역 키 리스너에서 최신 값을 보게 ref에 담아 둔다 (매 렌더 갱신).
  const planRef = useRef(plan);
  planRef.current = plan;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const stateRef = useRef(state);
  stateRef.current = state;

  const schedule = (callback: () => void, delay: number) => {
    const timeout = setTimeout(() => {
      pendingRef.current.delete(timeout);
      callback();
    }, delay);
    pendingRef.current.add(timeout);
  };

  const answerRef = useRef((_move: Move | null) => {});
  answerRef.current = (move) => {
    if (lockedRef.current || !liveRef.current) return;
    /*
     * 게이지가 빈 필살기는 낸 것으로 치지 않는다. 잠그지 않고 그대로 돌아가므로
     * 같은 라운드에 다른 수를 낼 수 있다. 여기서 라운드를 잡아먹으면 "눌렀는데
     * 아무 일도 없이 한 판을 날렸다"가 된다.
     */
    if (move === "throw" && !canUseSpecial(stateRef.current)) return;
    lockedRef.current = true;
    const opponent = shownRef.current;
    // 시간 안에 못 내면 그대로 맞는다.
    const outcome: RoundOutcome = move ? resolveRound(move, opponent) : "lose";
    // 예고가 아직 안 그려졌으면(첫 프레임 전) 흐른 시간은 0이다. 못 본 시간은 안 센다.
    const sinceTell = tellShownRef.current === 0 ? 0 : performance.now() - tellShownRef.current;
    const critical = outcome === "win" && isCritical(sinceTell);
    const resolution = { player: move, opponent, outcome, critical };
    const damage = damageOf(state, resolution, tuning);
    const next = applyRound(state, resolution, tuning);
    if (move) historyRef.current.push(move);
    setResolved({ ...resolution, damage });
    setState(next);
    if (critical) setCriticals((count) => count + 1);
    // 라운드 결과는 타격으로 말한다. 승패 스팅어(success/fail)는 판 전체가 끝날 때
    // 호스트가 한 번만 울린다. 여기서까지 울리면 매 라운드가 결승처럼 들린다.
    playSound(
      outcome === "win"
        ? critical
          ? "punchHeavy"
          : "punch"
        : outcome === "lose"
          ? "hurt"
          : "guard",
      { variation: 0.05 },
    );

    const status = duelStatus(next);
    if (status === "playing") {
      schedule(() => setRoundKey((key) => key + 1), RESULT_MS);
      return;
    }
    // 승부가 났으면 KO 연출이 도는 동안 판이 닫히지 않게 잠근다
    setLive(false);
    setOver(status === "won" ? "won" : "lost");
    onSettled?.();
    schedule(() => playSound("punchHeavy", { variation: 0.05 }), 120);
    schedule(
      () =>
        complete({
          cleared: status === "won",
          // 이겼으면 얼마나 덜 맞고 이겼는지, 졌으면 얼마나 깎았는지가 점수다.
          score: Math.round(status === "won" ? next.heroHp : 100 - next.rivalHp),
        }),
      KO_MS,
    );
  };

  // 시작 배너가 걷히면 첫 라운드가 선다.
  useEffect(() => {
    const timer = setTimeout(() => setLive(true), INTRO_MS);
    return () => clearTimeout(timer);
  }, []);

  // 새 라운드: 예고가 뜨는 순간부터 시간을 잰다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: roundKey는 값이 아니라 "다음 라운드로 넘어간다"는 신호로만 쓴다.
  useEffect(() => {
    if (!live) return;
    const nextPlan = planRound(stateRef.current, salt, historyRef.current, Math.random());
    setPlan(nextPlan);
    setShown(nextPlan.tell);
    setResolved(null);
    setFeintAt(0);
    // 시계는 여기서 시작하지 않는다. 예고가 실제로 그려진 첫 프레임에 시작한다.
    roundStartRef.current = 0;
    tellShownRef.current = 0;
    feintDoneRef.current = false;
    lockedRef.current = false;
    // 예고 모션에 붙는 소리. 종이 넘김(flip)이 아니라 상대가 팔을 당기는 바람 소리다.
    playSound("swingMiss", { variation: 0.08 });
  }, [roundKey, live, salt]);

  // 남은 시간 바: setState 없이 ref를 직접 민다. 페인트만 예외로 한 번 상태를 건드린다.
  useEffect(() => {
    let frame = 0;
    const loop = (now: number) => {
      /*
       * 화면이 멈춰 있던 시간은 라운드 시간으로 세지 않는다.
       *
       * 프레임 사이가 벌어지는 건 탭이 가려졌거나(rAF 자체가 멈춘다) 3D 씬·청크
       * 로드가 메인 스레드를 붙잡고 있었다는 뜻이다. 그 시간을 그냥 흘려보내면
       * 돌아온 첫 프레임에서 progress가 1을 넘어, 플레이어가 예고를 보지도 못한 채
       * 라운드가 통째로 지나간다. "시작하자마자 연패"가 이렇게 만들어졌다.
       */
      const gap = lastFrameRef.current === 0 ? 0 : now - lastFrameRef.current;
      lastFrameRef.current = now;
      if (gap > STALL_MS && roundStartRef.current > 0) roundStartRef.current += gap;

      if (!lockedRef.current && liveRef.current) {
        const { durationMs, feint } = planRef.current;
        // 예고가 처음 그려지는 프레임: 여기가 이 라운드의 0초다
        if (roundStartRef.current === 0) {
          roundStartRef.current = now;
          tellShownRef.current = now;
        }
        const progress = Math.min(1, (now - roundStartRef.current) / durationMs);
        if (feint && !feintDoneRef.current && progress >= FEINT_AT) {
          feintDoneRef.current = true;
          tellShownRef.current = now;
          setShown(feint);
          setFeintAt(now);
          playSound("feint");
        }
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

  const skip = useCallback(
    () => complete({ cleared: true, score: Math.round(state.heroHp) }),
    [complete, state.heroHp],
  );

  const enraged = over === null && isEnraged(state.rivalHp);
  /**
   * 첫 라운드는 튜토리얼이다: 정답 버튼이 빛난다. 규칙을 세 줄로 읽고 곧장 2초 안에
   * 받아치라는 건 배우기 전에 시험을 치르는 것이었다. 첫 판에는 페인트가 없으므로
   * (FEINT_FROM_ROUND) 빛나는 버튼이 바뀔 일도 없다. 두 번째 라운드부터는 혼자 읽는다.
   */
  const tutorial = live && over === null && resolved === null && state.round === 0;
  const tutorialAnswer = tutorial ? counterTo(shown) : null;
  const heroHit = resolved?.outcome === "lose";
  const rivalHit = resolved?.outcome === "win";
  /** 간파 판정이 살아 있는 구간: 게이지 오른쪽 끝의 눈금으로 보여준다. */
  const criticalZone = Math.min(100, (CRITICAL_MS / plan.durationMs) * 100);

  return (
    <MinigameShell
      title={t("minigame.fighterDuel.title")}
      help={hint("minigame.fighterDuel.help")}
      stats={
        <>
          <MinigameStat label={t("minigame.fighterDuel.labelCombo")} value={state.combo} />
          <MinigameStat label={t("minigame.fighterDuel.labelCritical")} value={criticals} />
        </>
      }
      skipVisible={skipByTime || hpRatio(state.heroHp) <= SKIP_AT_HP}
      onSkip={skip}
      size="lg"
    >
      {/* 체력 게이지: 게임기 화면의 상단 띠. 무대와 붙어 하나의 화면으로 읽힌다 */}
      <div className="flex items-start gap-4 rounded-t-md border-2 border-b-0 border-night bg-night/85 px-3 pb-2 pt-2 sm:px-5">
        <HealthBar
          hp={state.heroHp}
          label={t("minigame.fighterDuel.nameHero")}
          side="left"
          tone="memory"
        />
        <span className="mt-3 shrink-0 font-pixel text-[0.65rem] tracking-widest text-bone/45">
          {t("minigame.fighterDuel.round", { value: state.round + 1 })}
        </span>
        <HealthBar
          hp={state.rivalHp}
          label={t("minigame.fighterDuel.nameRival")}
          side="right"
          tone="bone"
          enraged={enraged}
        />
      </div>

      <div className="overflow-hidden rounded-b-md border-2 border-night bg-scene-abyss">
        <div
          // 예고 글자가 위쪽 띠로 빠졌으니 둘 사이는 간격으로 벌린다.
          // justify-between이면 넓은 패널에서 양 끝으로 밀려 마주 본다는 느낌이 사라진다
          className={`relative flex h-64 items-end justify-center gap-8 bg-cover bg-center px-3 pb-6 sm:gap-40 sm:px-10 ${
            resolved && resolved.outcome !== "draw" ? "animate-batting-field-shake" : ""
          }`}
          style={{
            // 무대 그림이 리포에 없으면 그 레이어만 못 그리고 아래 그라디언트가 남는다.
            // 배경은 이 폴백만으로도 충분해서 존재 확인을 따로 하지 않는다.
            backgroundImage: `url(${ASSETS.images.mgFighterDuelStage}), linear-gradient(var(--color-scene-storm), var(--color-scene-abyss) 78%)`,
          }}
        >
          <span className="absolute inset-x-0 bottom-0 h-6 bg-night/50" aria-hidden />
          {/* 게임기 화면이라는 신호. 무대 위에만 얹고 UI 패널로는 넘기지 않는다 */}
          <span
            className="duel-scanline pointer-events-none absolute inset-0 opacity-25"
            aria-hidden
          />
          {/* 각성한 상대 쪽에서 번지는 기색 */}
          {enraged && (
            <span
              className="pointer-events-none absolute inset-y-0 right-0 w-1/3 animate-duel-rage bg-gradient-to-l from-ember/25 to-transparent"
              aria-hidden
            />
          )}

          <div className="relative">
            <Fighter
              pose={playerPose(resolved, over !== null)}
              tone="memory"
              facing="right"
              sprite={ASSETS.images.mgFighterDuelHero}
              offsetY={HERO_OFFSET_Y}
              shake={heroHit}
              flash={heroHit}
            />
            {heroHit && resolved && (
              <span
                key={`${roundKey}-hero-damage`}
                className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 animate-duel-damage font-pixel text-lg text-ember"
                aria-hidden
              >
                -{resolved.damage}
              </span>
            )}
            {/* 콤보는 도해 쪽에 쌓인다. 내가 이어가고 있다는 표시라 내 쪽에 붙어야 한다 */}
            {state.combo >= 2 && over === null && (
              <span
                key={`${state.combo}-combo`}
                className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 animate-duel-combo whitespace-nowrap font-pixel text-xs tracking-widest text-memory"
                aria-hidden
              >
                {t("minigame.fighterDuel.combo", { value: state.combo })}
              </span>
            )}
          </div>

          {/*
            예고와 결과는 자세만으로 전하지 않는다. 글로도 읽히고, 바뀌면 알린다.

            두 파이터 사이에 끼워 두면 좁은 화면에서 가운데 칸이 눌려 "상대가 어깨를
            뒤로 뺀다"가 네 줄로 접히고 스프라이트에 가린다. 무대 위쪽 띠로 띄워
            폭을 화면 전체로 쓰게 하고, 파이터는 아래에서 마주 보게 둔다.
          */}
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute inset-x-3 top-4 flex flex-col items-center gap-2 text-center sm:top-6"
          >
            {resolved ? (
              <>
                <span
                  key={`${roundKey}-outcome`}
                  className={`animate-fade-rise whitespace-nowrap font-pixel text-lg tracking-widest sm:text-xl ${OUTCOME_TONE[resolved.outcome]}`}
                >
                  {t(
                    resolved.player === null
                      ? "minigame.fighterDuel.outcome.late"
                      : `minigame.fighterDuel.outcome.${resolved.outcome}`,
                  )}
                </span>
                {resolved.critical && (
                  <span className="animate-fade-rise font-pixel text-xs tracking-widest text-memory">
                    {t("minigame.fighterDuel.critical")}
                  </span>
                )}
              </>
            ) : (
              <>
                {/*
                  자세 그림에서 수 이름까지 가는 길을 없앤다.

                  전에는 "상대가 어깨를 뒤로 뺀다"만 띄우고 그게 무슨 수인지는
                  플레이어가 옮겨야 했다. 자세를 읽고 → 수로 옮기고 → 상성을
                  떠올리고 → 버튼을 찾는 네 걸음을 2초 안에 하는 셈이라, 규칙을
                  아는 사람도 손이 먼저 갔다. 이름을 크게 못박아 두 걸음을 지운다.
                  남는 건 "이 수를 이기는 버튼 찾기" 하나다.
                */}
                <span
                  key={`${shown}-name`}
                  className="animate-fade-rise font-pixel text-lg tracking-widest text-paper sm:text-xl"
                >
                  {t(`minigame.fighterDuel.move.${shown}`)}
                </span>
                <span className="-mt-1 font-pixel text-[0.6rem] tracking-[0.2em] text-bone/45">
                  {t("minigame.fighterDuel.tellLabel")}
                </span>
                <span className="break-ko text-pretty font-pixel text-xs leading-relaxed tracking-widest text-bone/80">
                  {t(`minigame.fighterDuel.tell.${shown}`)}
                </span>
                {feintAt > 0 && (
                  <span
                    key={feintAt}
                    className="animate-duel-alert break-ko text-pretty font-pixel text-xs tracking-widest text-ember"
                  >
                    {t("minigame.fighterDuel.feint")}
                  </span>
                )}
              </>
            )}
          </div>

          <div className="relative">
            <Fighter
              pose={opponentPose(resolved, shown, over !== null)}
              tone="bone"
              facing="left"
              sprite={ASSETS.images.mgFighterDuelRival}
              shake={rivalHit}
              flash={rivalHit}
            />
            {rivalHit && resolved && (
              <span
                key={`${roundKey}-rival-damage`}
                className={`pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 animate-duel-damage font-pixel text-memory ${
                  resolved.critical ? "text-2xl" : "text-lg"
                }`}
                aria-hidden
              >
                -{resolved.damage}
              </span>
            )}
          </div>

          {/* 시작·KO 배너. 화면 한가운데를 잠깐 차지하는 유일한 글자다 */}
          {(!live || over) && (
            <span
              key={over ?? "fight"}
              className={`pointer-events-none absolute inset-0 flex items-center justify-center animate-duel-banner font-pixel text-3xl tracking-[0.3em] sm:text-4xl ${
                over === "lost" ? "text-ember" : "text-memory"
              }`}
            >
              {t(
                over === "won"
                  ? "minigame.fighterDuel.banner.ko"
                  : over === "lost"
                    ? "minigame.fighterDuel.banner.down"
                    : "minigame.fighterDuel.banner.fight",
              )}
            </span>
          )}
        </div>

        {/* 남은 시간: 색이 아니라 길이로 읽히게. 오른쪽 끝 눈금 안에서 내면 간파다 */}
        <div className="relative h-1.5 w-full bg-night/60">
          <div ref={timerRef} className="h-full w-full origin-left bg-memory" />
          <span
            className="pointer-events-none absolute inset-y-0 right-0 border-l border-paper/50 bg-paper/20"
            style={{ width: `${criticalZone}%` }}
            aria-hidden
          />
        </div>
      </div>

      {/*
        예고가 걸려 있지 않은 동안(시작 배너·결과 연출)은 버튼을 잠근다. 눌러도
        아무 일이 없는 버튼은 "고장난 게임"으로 읽힌다. 지금은 낼 차례가 아니라는
        걸 커서와 색으로 먼저 말해 준다.
      */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        {MOVES.map((move, index) => {
          /*
            버튼마다 "무엇을 이기는가"를 적는다. 삼각 상성을 외워서 떠올리는
            대신, 위에 뜬 상대 수와 같은 글자를 버튼에서 찾으면 되는 일이 된다.
            상성을 화면 밖(머리)에 두면 아는 사람만 아는 게임이 된다.

            정답 버튼을 대신 짚어 주지는 않는다. 짚어 주면 페인트가 무의미해지고
            (자세가 바뀌면 표시도 따라 바뀌므로) 읽기 싸움이 통째로 사라진다.
          */
          /** 필살기만 게이지를 쓴다. 빈 게이지면 낼 수 없다는 걸 버튼이 먼저 말한다. */
          const costsMeter = move === "throw";
          const spent = costsMeter && !canUseSpecial(state);
          const guided = tutorialAnswer === move;

          return (
            <button
              key={move}
              type="button"
              disabled={!live || resolved !== null || spent}
              onClick={() => answerRef.current(move)}
              className={`rounded-sm border border-line px-4 py-2.5 text-ivory transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-memory focus-visible:outline-offset-2 enabled:cursor-pointer enabled:hover:border-fog/40 enabled:hover:bg-ivory/8 disabled:opacity-45 ${
                resolved?.player === move ? "border-fog/50 bg-ivory/10 opacity-100" : ""
              } ${guided ? "animate-hotspot-glow border-memory bg-memory/15 shadow-slot-glow" : ""}`}
            >
              <span className="flex items-center justify-center gap-2 font-bold text-base">
                <span>
                  <span className="font-pixel text-fog/80 text-xs">{MOVE_KEYS[index]}</span>{" "}
                  {t(`minigame.fighterDuel.move.${move}`)}
                </span>
                {costsMeter && <SpecialMeter charged={state.special} />}
              </span>
              <span className="mt-0.5 block break-ko text-[0.6875rem] text-fog">
                {t("minigame.fighterDuel.beats", {
                  move: t(`minigame.fighterDuel.move.${beats(move)}`),
                })}
              </span>
              {costsMeter && (
                <span className="sr-only">
                  {t("minigame.fighterDuel.specialLeft", { left: state.special })}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 break-ko text-pretty text-center text-sm text-fog">
        {t(tutorial ? "minigame.fighterDuel.tutorialHint" : "minigame.fighterDuel.hint")}
      </p>
    </MinigameShell>
  );
}
