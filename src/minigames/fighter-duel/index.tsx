"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";
import {
  type Attack,
  advance,
  DUEL_START,
  DUEL_TUNINGS,
  type DuelEvent,
  duelStatus,
  type FighterState,
  type Intent,
  isEnraged,
  jumpHeight,
  MATCH_MS,
  RIVAL_MIND_START,
  STAGE_SPAN,
  stepRival,
} from "./duel";
import { Fighter, type Pose } from "./Fighter";
import { HealthBar } from "./HealthBar";

/** "FIGHT!"가 떠 있는 동안은 판이 멈춰 있다. 시작 신호 없이 맞고 시작하지 않게. */
const INTRO_MS = 900;
/** K.O. 뒤 결과를 넘기기까지. 쓰러지는 모습을 볼 시간. */
const KO_MS = 1600;
/** 이지 모드에서 건너뛰기가 뜨기까지. */
const SKIP_AFTER_MS = 30_000;
/** 외침(카운터·콤보)이 화면에 남는 시간. */
const CALLOUT_MS = 700;
/** 맞은 표시(플래시·흔들림)가 남는 시간. */
const HIT_FLASH_MS = 180;
/**
 * 플레이어를 아래로 내리는 폭(px).
 *
 * 두 시트는 프레임 안에서 발이 앉은 높이가 조금씩 다르다. 같은 바닥선에 세우면
 * 한쪽만 떠 보이므로 그림을 다시 그리는 대신 여기서 맞춘다 (Fighter의 offsetY).
 */
const HERO_OFFSET_Y = 7;

/** 규칙에 보내는 한 걸음(ms). 60fps 한 프레임. 화면이 느려도 이 간격은 그대로다. */
const FIXED_STEP_MS = 16;
/** 한 프레임에 몰아서 따라잡을 수 있는 최대 시간(ms). 탭이 잠들었다 깨도 순간이동은 없다. */
const MAX_CATCHUP_MS = 250;

/** 키 한 벌. 방향키로 걷고, 뒤로 걷는 것이 곧 가드다 (격투 게임의 관용구). */
const WALK_BACK_KEYS = ["ArrowLeft", "KeyA"] as const;
const WALK_IN_KEYS = ["ArrowRight", "KeyD"] as const;
const WALK_KEYS = new Set<string>([...WALK_BACK_KEYS, ...WALK_IN_KEYS]);
/** 점프. 누르는 순간 한 번 뜬다: 붙잡고 있어도 계속 뛰지 않는다. */
const JUMP_KEYS = new Set<string>(["ArrowUp", "KeyW", "Space"]);
/** 가장 높이 떴을 때 화면에서 올라가는 높이(px). */
const JUMP_LIFT_PX = 74;
/** 기술은 눌린 순간 한 번만 먹는다. 붙잡고 있어도 연타가 되지 않는다. */
const ATTACK_KEYS: Record<string, Attack> = {
  KeyJ: "jab",
  KeyZ: "jab",
  Digit1: "jab",
  KeyK: "heavy",
  KeyX: "heavy",
  Digit2: "heavy",
  KeyL: "throw",
  KeyC: "throw",
  Digit3: "throw",
};

/** 무대 위 발밑의 자리(%). 캐릭터는 이 자리를 중심으로 선다. */
function stageLeft(x: number): string {
  return `${(x / STAGE_SPAN) * 100}%`;
}

/** 뜬 만큼 화면에서 떠오른다. 땅에 있으면 0. */
function liftOf(fighter: FighterState): number {
  return fighter.airMs === null ? 0 : jumpHeight(fighter.airMs) * JUMP_LIFT_PX;
}

/**
 * 상태를 자세로 옮긴다. 스프라이트 시트의 일곱 칸(sprites.ts)과 같은 이름이다.
 *
 * 예고(telegraph)는 아직 기술이 나가기 전이라 상태에는 없다. 그런데도 자세는
 * 바뀌어야 한다: 플레이어가 읽는 것이 바로 그 자세다.
 */
function poseOf(fighter: FighterState, telegraph: Attack | null, ended: "win" | "ko" | null): Pose {
  if (ended === "ko") return "ko";
  if (ended === "win") return "win";
  if (fighter.stun !== null) return "hurt";
  const move = fighter.attack ?? telegraph;
  if (move === "throw") return "throw";
  if (move !== null) return "strike";
  if (fighter.guarding) return "guard";
  return "idle";
}

interface Callout {
  key: number;
  text: string;
  tone: "memory" | "ember";
}

export function FighterDuelMinigame({ onComplete, onSettled, difficulty = "easy" }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const tuning = DUEL_TUNINGS[difficulty];

  /*
   * 판은 ref가 굴리고, 화면은 프레임마다 그 사본을 받는다. 상태를 직접 굴리면
   * 리렌더 한 번을 기다리는 사이에 프레임이 지나가 입력이 씹힌다.
   */
  const stateRef = useRef(DUEL_START);
  const mindRef = useRef(RIVAL_MIND_START);
  /** 지금 눌려 있는 키. 걷기·가드는 누르고 있는 동안 이어진다. */
  const heldRef = useRef(new Set<string>());
  /** 다음 프레임에 낼 기술. 눌린 순간 한 번만 담긴다. */
  const queuedRef = useRef<Attack | null>(null);
  /** 다음 프레임에 뜰 것인가. 기술과 같은 규칙으로 한 번만 담긴다. */
  const jumpRef = useRef(false);
  const lastFrameRef = useRef(0);

  const [view, setView] = useState(DUEL_START);
  const [telegraph, setTelegraph] = useState<Attack | null>(null);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState<"won" | "lost" | null>(null);
  const [callout, setCallout] = useState<Callout | null>(null);
  const [hitAt, setHitAt] = useState({ hero: 0, rival: 0 });
  const [counters, setCounters] = useState(0);

  const skipByTime = useSkipEligible(SKIP_AFTER_MS);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  // 시작 신호. 배너가 걷히면 그때부터 판이 돈다
  useEffect(() => {
    const timer = window.setTimeout(() => setRunning(true), INTRO_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // 키는 창에서 듣는다. 패널 안 버튼에 포커스가 가 있어도 손이 멈추지 않게
  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const attack = ATTACK_KEYS[event.code];
      if (attack) {
        event.preventDefault();
        queuedRef.current = attack;
        return;
      }
      if (JUMP_KEYS.has(event.code)) {
        event.preventDefault();
        jumpRef.current = true;
        return;
      }
      if (WALK_KEYS.has(event.code)) {
        event.preventDefault();
        heldRef.current.add(event.code);
      }
    };
    const onUp = (event: KeyboardEvent) => heldRef.current.delete(event.code);
    const onBlur = () => heldRef.current.clear();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  /** 이번 프레임의 내 뜻. 눌린 키에서 곧장 읽는다. */
  const readIntent = useCallback((): Intent => {
    const held = heldRef.current;
    const back = WALK_BACK_KEYS.some((key) => held.has(key));
    const forward = WALK_IN_KEYS.some((key) => held.has(key));
    const attack = queuedRef.current;
    const jump = jumpRef.current;
    queuedRef.current = null;
    jumpRef.current = false;
    return { walk: back === forward ? 0 : back ? -1 : 1, attack, jump };
  }, []);

  const showEvents = useCallback((events: readonly DuelEvent[], now: number) => {
    for (const event of events) {
      if (event.kind === "ko") continue;
      const mine = event.by === "hero";
      if (event.kind === "whiff") {
        if (mine) playSound("swingMiss", { variation: 0.08 });
        continue;
      }
      if (event.kind === "break") {
        playSound("feint");
        setCallout({ key: now, text: "broken", tone: mine ? "ember" : "memory" });
        continue;
      }
      if (event.kind === "block") {
        playSound("guard");
        continue;
      }
      // 맞았다: 때린 쪽 소리와 맞은 쪽 플래시
      playSound(event.attack === "heavy" ? "punchHeavy" : mine ? "punch" : "hurt", {
        variation: 0.05,
      });
      setHitAt((previous) => ({ ...previous, [mine ? "rival" : "hero"]: now }));
      if (event.kind === "counter") {
        if (mine) setCounters((count) => count + 1);
        setCallout({ key: now, text: "counter", tone: mine ? "memory" : "ember" });
      } else if (mine && event.combo >= 2) {
        setCallout({ key: now, text: `${event.combo}`, tone: "memory" });
      }
    }
  }, []);

  // 판. 흐른 시간을 고정 간격으로 쪼개 보낸다
  useEffect(() => {
    if (!running || over !== null) return;
    lastFrameRef.current = performance.now();
    let spare = 0;
    let frame = requestAnimationFrame(function tick(now) {
      /*
       * 프레임이 얼마나 자주 오든 판은 같은 속도로 흐른다: 흐른 시간을 모아 두었다가
       * FIXED_STEP_MS씩 끊어 보낸다. 프레임 하나에 실제 시간을 통째로 실으면 느린
       * 기기에서 한 걸음이 성큼 뛰어 발동 프레임을 통째로 건너뛰고, 반대로 걸음을
       * 프레임 수로 세면 느린 기기에서 판이 슬로모션이 된다.
       */
      spare = Math.min(spare + (now - lastFrameRef.current), MAX_CATCHUP_MS);
      lastFrameRef.current = now;

      let ended: "won" | "lost" | null = null;
      let first = true;
      while (spare >= FIXED_STEP_MS && ended === null) {
        spare -= FIXED_STEP_MS;
        // 기술은 눌린 순간 한 번뿐이라 첫 걸음에서만 읽는다. 나머지 걸음은 걷기만 잇는다
        const intent = first ? readIntent() : { ...readIntent(), attack: null, jump: false };
        first = false;
        const rival = stepRival(
          stateRef.current,
          mindRef.current,
          FIXED_STEP_MS,
          Math.random(),
          tuning,
        );
        mindRef.current = rival.mind;
        const step = advance(stateRef.current, intent, rival.intent, FIXED_STEP_MS, tuning);
        stateRef.current = step.state;
        showEvents(step.events, now);
        const status = duelStatus(step.state);
        if (status !== "playing") ended = status;
      }

      setView(stateRef.current);
      setTelegraph(mindRef.current.telegraph);

      if (ended !== null) {
        playSound(ended === "won" ? "success" : "fail");
        onSettledRef.current?.();
        setOver(ended);
        return;
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, over, tuning, readIntent, showEvents]);

  // 쓰러지는 모습을 보여주고 결과를 넘긴다
  useEffect(() => {
    if (over === null) return;
    const timer = window.setTimeout(() => complete({ cleared: over === "won" }), KO_MS);
    return () => window.clearTimeout(timer);
  }, [over, complete]);

  // 외침은 잠깐 떴다 사라진다
  useEffect(() => {
    if (!callout) return;
    const timer = window.setTimeout(() => setCallout(null), CALLOUT_MS);
    return () => window.clearTimeout(timer);
  }, [callout]);

  const now = performance.now();
  const heroHit = now - hitAt.hero < HIT_FLASH_MS;
  const rivalHit = now - hitAt.rival < HIT_FLASH_MS;
  const enraged = isEnraged(view.rival.hp);
  const secondsLeft = Math.max(0, Math.ceil((MATCH_MS - view.elapsedMs) / 1000));

  /** 터치로도 같은 손을 쓴다: 누르는 동안 걷고, 떼면 선다. */
  const holdProps = (code: string) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      heldRef.current.add(code);
    },
    onPointerUp: () => heldRef.current.delete(code),
    onPointerLeave: () => heldRef.current.delete(code),
    onPointerCancel: () => heldRef.current.delete(code),
  });

  return (
    <MinigameShell
      title={t("minigame.fighterDuel.title")}
      help={hint("minigame.fighterDuel.help")}
      stats={
        <>
          <MinigameStat label={t("minigame.fighterDuel.labelCombo")} value={view.hero.combo} />
          <MinigameStat label={t("minigame.fighterDuel.labelCounter")} value={counters} />
          <MinigameStat
            label={t("minigame.fighterDuel.labelTime")}
            value={secondsLeft}
            tone={secondsLeft <= 10 ? "warning" : "progress"}
          />
        </>
      }
      skipVisible={skipByTime}
      onSkip={() => complete({ cleared: true })}
      size="lg"
    >
      {/* 체력 게이지: 게임기 화면의 상단 띠. 무대와 붙어 하나의 화면으로 읽힌다 */}
      <div className="flex items-start gap-4 rounded-t-md border-2 border-b-0 border-night bg-night/85 px-3 pb-2 pt-2 sm:px-5">
        <HealthBar
          hp={view.hero.hp}
          label={t("minigame.fighterDuel.nameHero")}
          side="left"
          tone="memory"
        />
        <span className="mt-3 shrink-0 font-pixel text-[0.65rem] tracking-widest text-bone/45">
          {secondsLeft}
        </span>
        <HealthBar
          hp={view.rival.hp}
          label={t("minigame.fighterDuel.nameRival")}
          side="right"
          tone="bone"
          enraged={enraged}
        />
      </div>

      <div className="overflow-hidden rounded-b-md border-2 border-night bg-scene-abyss">
        <div
          className={`relative h-64 bg-cover bg-center ${
            heroHit || rivalHit ? "animate-batting-field-shake" : ""
          }`}
          style={{
            // 무대 그림이 리포에 없으면 그 레이어만 못 그리고 아래 그라디언트가 남는다
            backgroundImage: `url(${ASSETS.images.mgFighterDuelStage}), linear-gradient(var(--color-scene-storm), var(--color-scene-abyss) 78%)`,
          }}
        >
          <span className="absolute inset-x-0 bottom-0 h-6 bg-night/50" aria-hidden />
          <span
            className="duel-scanline pointer-events-none absolute inset-0 opacity-25"
            aria-hidden
          />
          {enraged && (
            <span
              className="pointer-events-none absolute inset-y-0 right-0 w-1/3 animate-duel-rage bg-gradient-to-l from-ember/25 to-transparent"
              aria-hidden
            />
          )}

          {/* 두 사람은 무대 좌표 위에 선다. 거리가 곧 이 게임의 판돈이다 */}
          <div
            className="absolute bottom-6 -translate-x-1/2"
            style={{ left: stageLeft(view.hero.x), marginBottom: liftOf(view.hero) }}
          >
            <Fighter
              pose={poseOf(view.hero, null, over === null ? null : over === "won" ? "win" : "ko")}
              tone="memory"
              facing="right"
              sprite={ASSETS.images.mgFighterDuelHero}
              offsetY={HERO_OFFSET_Y}
              shake={heroHit}
              flash={heroHit}
            />
          </div>
          <div
            className="absolute bottom-6 -translate-x-1/2"
            style={{ left: stageLeft(view.rival.x), marginBottom: liftOf(view.rival) }}
          >
            <Fighter
              pose={poseOf(
                view.rival,
                telegraph,
                over === null ? null : over === "lost" ? "win" : "ko",
              )}
              tone="bone"
              facing="left"
              sprite={ASSETS.images.mgFighterDuelRival}
              shake={rivalHit}
              flash={rivalHit}
            />
          </div>

          {callout && (
            <span
              key={callout.key}
              className={`pointer-events-none absolute left-1/2 top-8 -translate-x-1/2 animate-duel-damage whitespace-nowrap font-pixel text-lg tracking-widest ${
                callout.tone === "memory" ? "text-memory" : "text-ember"
              }`}
              aria-hidden
            >
              {callout.text === "counter" || callout.text === "broken"
                ? t(`minigame.fighterDuel.callout.${callout.text}`)
                : t("minigame.fighterDuel.combo", { value: callout.text })}
            </span>
          )}

          {(!running || over !== null) && (
            <span
              className={`pointer-events-none absolute inset-0 flex items-center justify-center animate-duel-banner font-pixel text-3xl tracking-[0.3em] sm:text-4xl ${
                over === "lost" ? "text-ember" : "text-paper"
              }`}
              aria-hidden
            >
              {over === null
                ? t("minigame.fighterDuel.banner.fight")
                : over === "won"
                  ? t("minigame.fighterDuel.banner.ko")
                  : t("minigame.fighterDuel.banner.down")}
            </span>
          )}
        </div>
      </div>

      {/*
        조작판. 키보드가 본체이고 이 버튼은 터치의 손이다. 두 줄로 나누지 않는 이유는
        걷기와 치기가 동시에 일어나는 게임이라 손이 한 줄 안에 있어야 하기 때문이다.
      */}
      <div className="mt-3 flex flex-wrap items-stretch justify-center gap-2">
        <ControlKey
          cap="←"
          label={t("minigame.fighterDuel.control.back")}
          {...holdProps("ArrowLeft")}
        />
        <ControlKey
          cap="→"
          label={t("minigame.fighterDuel.control.forward")}
          {...holdProps("ArrowRight")}
        />
        <ControlKey
          cap="↑"
          label={t("minigame.fighterDuel.control.jump")}
          onPointerDown={(event) => {
            event.preventDefault();
            jumpRef.current = true;
          }}
        />
        {(["jab", "heavy", "throw"] as const).map((attack, index) => (
          <ControlKey
            key={attack}
            cap={["J", "K", "L"][index]}
            label={t(`minigame.fighterDuel.move.${attack}`)}
            accent
            onPointerDown={(event) => {
              event.preventDefault();
              queuedRef.current = attack;
            }}
          />
        ))}
      </div>
    </MinigameShell>
  );
}

/** 조작 한 칸: 키 모양과 그 키가 하는 일. 화면 밖 도움말 없이 여기서 다 말한다. */
function ControlKey({
  cap,
  label,
  accent,
  ...handlers
}: {
  cap: string;
  label: string;
  accent?: boolean;
} & React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="button"
      // 게임의 손은 키보드다. 이 버튼은 터치용이라 포커스 순서에서 빠진다
      tabIndex={-1}
      className={`flex min-w-16 select-none flex-col items-center gap-0.5 rounded-sm border px-2.5 py-1.5 transition-colors ${
        accent ? "border-memory/45 bg-memory/10" : "border-bone/25 bg-night/60"
      }`}
      {...handlers}
    >
      <span className="font-pixel text-sm text-ivory">{cap}</span>
      <span className="break-ko text-[0.7rem] leading-tight text-fog">{label}</span>
    </button>
  );
}
