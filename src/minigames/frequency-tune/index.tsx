"use client";

import { StarIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { ASSETS } from "@/lib/assets";
import { type NoiseBed, playSound, startNoiseBed } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";
import {
  bandBonusFor,
  bandWidthAt,
  goalHitsFor,
  MAX_MISSES,
  needlePeriodAt,
  randomBandLeft,
  staticLevel,
} from "./difficulty";

const SKIP_AFTER_MS = 30_000;
/** 실패(MAX_MISSES)보다 한 번 먼저: 스킵이 실패와 같은 순간에 뜨면 누를 틈이 없다. */
const SKIP_AFTER_MISSES = 2;
/** 다이얼 눈금 범위 (MHz): position 0~100% 를 이 범위로 매핑. */
const FREQ_MIN = 88;
const FREQ_MAX = 108;

/** 라디오 일러스트 원본 크기(px). */
const FRAME = { width: 1597, height: 1159 };
/** 그 안에서 알파로 뚫려 있는 표시창(px): 이미지에서 실측한 값. */
const GLASS = { x: 66, y: 84, width: 1470, height: 416 };
/**
 * 표시창 바탕을 프레임 뒤로 물려 그리는 여유(px, 원본 기준).
 * 창 모서리가 둥글어서 딱 맞게 그리면 라운드 틈으로 뒷배경이 비친다.
 */
const GLASS_BLEED = 14;
/** 프레임에 그려진 TUNING 램프의 중심(%). 주파수가 맞을수록 여기가 밝아진다. */
const LAMP = { left: "8.77%", top: "86.95%" };

/** 원본 px 좌표 → 프레임 기준 inset 스타일. */
function glassInset(bleed = 0): React.CSSProperties {
  const pct = (value: number, total: number) => `${((value / total) * 100).toFixed(3)}%`;
  return {
    left: pct(GLASS.x - bleed, FRAME.width),
    right: pct(FRAME.width - GLASS.x - GLASS.width - bleed, FRAME.width),
    top: pct(GLASS.y - bleed, FRAME.height),
    bottom: pct(FRAME.height - GLASS.y - GLASS.height - bleed, FRAME.height),
  };
}

/** position(0~100%) → 표시 주파수 문자열. */
function freqAt(position: number): string {
  return (FREQ_MIN + (position / 100) * (FREQ_MAX - FREQ_MIN)).toFixed(1);
}

/** 맞춘 뒤 남는 잡음의 바닥·최대치와, 튀는 간격(ms). */
const LOCKED_STATIC = { floor: 0.09, spike: 0.32, everyMs: 220 };

/**
 * 좌우로 흔들리는 바늘이 목표 대역을 지나는 순간 Space: 3회 맞추면 클리어.
 * 맞출수록 대역이 좁아지고 바늘이 빨라진다 (./difficulty.ts).
 */
export function FrequencyTuneMinigame({
  onComplete,
  gamePhase = 1,
  difficulty = "easy",
  stage = "play",
}: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  // 2바퀴는 판이 짧고 대역이 넓다. 이유는 ./difficulty.ts 참고
  // 3차 조사는 이 판을 쓰지 않지만, 쓰더라도 2바퀴 수치를 따른다
  const round = gamePhase === 1 ? 1 : 2;
  const goalHits = goalHitsFor(round);
  const bandBonus = bandBonusFor(round);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [bandLeft, setBandLeft] = useState(() =>
    randomBandLeft(bandWidthAt(0, bandBonus, difficulty)),
  );
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  /**
   * 결과 대사 단계: 판은 끝났고 화면만 남았다. 여기서는 바늘도 입력도 멈추고
   * 주파수가 잡힌 라디오 한 대만 치지직거린다 (src/types/minigame.ts의 stage).
   */
  const locked = stage === "result";
  /** 마지막으로 맞춘 지점과 그때의 대역: 멈춘 화면은 이 한 장면을 그대로 붙든다. */
  const lockedAtRef = useRef<{ position: number; bandLeft: number; bandWidth: number } | null>(
    null,
  );
  const needleRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const lampRef = useRef<HTMLSpanElement>(null);
  const positionRef = useRef(0);
  const skipByTime = useSkipEligible(SKIP_AFTER_MS);

  /** 주 눈금(2MHz)·보조 눈금(0.4MHz)을 % 위치로 미리 계산. */
  const ticks = useMemo(() => {
    const out: { pct: number; major: boolean; label?: number }[] = [];
    for (let f = FREQ_MIN; f <= FREQ_MAX + 1e-6; f += 0.4) {
      const freq = Math.round(f * 10) / 10;
      const major = Math.abs(freq % 2) < 1e-6;
      out.push({
        pct: ((freq - FREQ_MIN) / (FREQ_MAX - FREQ_MIN)) * 100,
        major,
        label: major ? freq : undefined,
      });
    }
    return out;
  }, []);

  /**
   * 계속 깔리는 라디오 잡음. 판이 열려 있는 동안만 살아 있다.
   *
   * 이건 Voice로 못 만든다. Voice는 0.6초를 넘지 않는다는 계약이 걸려 있어서
   * 지속음은 별도 노드로 간다 (src/lib/audio/engine.ts의 startNoiseBed).
   */
  const bedRef = useRef<NoiseBed | null>(null);
  useEffect(() => {
    // 계속 깔리는 소리는 한 번 튀는 소리와 같은 값이어도 훨씬 크게 들린다.
    // 효과음 게인(0.15~0.34)보다 한참 아래로 내려야 배경으로 남는다.
    // 0.06은 폰 스피커에서 여전히 귀를 긁었다. 약 -2.5dB 내린다 (2026-09-27)
    bedRef.current = startNoiseBed({ gain: 0.045, highpass: 1200, lowpass: 7000 });
    return () => {
      bedRef.current?.stop();
      bedRef.current = null;
    };
  }, []);

  /** 이번 판의 목표 대역 폭: 명중할수록 좁아진다. 폭과 속도는 난이도가 정한다 (./difficulty.ts) */
  const bandWidth = bandWidthAt(hits, bandBonus, difficulty);

  // 대역과 속도는 명중할 때마다 바뀐다. rAF 루프는 한 번만 도므로 최신 값을 ref로 받는다.
  const bandLeftRef = useRef(bandLeft);
  bandLeftRef.current = bandLeft;
  const bandWidthRef = useRef(bandWidth);
  bandWidthRef.current = bandWidth;
  const periodRef = useRef(needlePeriodAt(hits, difficulty));
  periodRef.current = needlePeriodAt(hits, difficulty);

  // 바늘 애니메이션: setState 대신 ref 직접 변이 (60fps)
  useEffect(() => {
    if (locked) return;
    let frame = 0;
    let last = performance.now();
    // 경과 시간이 아니라 위상을 누적한다. 주기가 바뀌는 순간 바늘이 순간이동하지 않게.
    let phase = 0;
    const loop = (now: number) => {
      phase = (phase + (now - last) / periodRef.current) % 1;
      last = now;
      const position = (Math.sin(phase * Math.PI * 2) + 1) * 50;
      positionRef.current = position;
      if (needleRef.current) needleRef.current.style.left = `${position}%`;
      if (pointerRef.current) pointerRef.current.style.left = `${position}%`;
      if (readoutRef.current) readoutRef.current.textContent = freqAt(position);
      // setState 없이 게인만 민다. 매 프레임 리렌더가 나면 60fps가 안 나온다.
      const level = staticLevel(position, bandLeftRef.current, bandWidthRef.current);
      bedRef.current?.setLevel(level);
      // 잡음이 걷히는 만큼 TUNING 램프가 밝아진다. 소리와 같은 값을 눈으로도 준다.
      if (lampRef.current) lampRef.current.style.opacity = (1 - level).toFixed(3);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [locked]);

  /**
   * 멈춘 화면. 바늘은 맞춘 자리에 서고, 잡음만 남아 불규칙하게 튄다.
   * 주파수는 잡혔지만 방송이 깨끗하지는 않다는 소리.
   *
   * 바늘이 멈춘 뒤에는 rAF가 없으므로 게인을 밀어 줄 곳도 여기뿐이다.
   */
  useEffect(() => {
    if (!locked) return;
    const position = lockedAtRef.current?.position ?? positionRef.current;
    positionRef.current = position;
    if (needleRef.current) needleRef.current.style.left = `${position}%`;
    if (pointerRef.current) pointerRef.current.style.left = `${position}%`;
    if (readoutRef.current) readoutRef.current.textContent = freqAt(position);
    if (lampRef.current) lampRef.current.style.opacity = "1";
    const timer = setInterval(() => {
      const level =
        LOCKED_STATIC.floor + Math.random() * (LOCKED_STATIC.spike - LOCKED_STATIC.floor);
      bedRef.current?.setLevel(level);
    }, LOCKED_STATIC.everyMs);
    return () => clearInterval(timer);
  }, [locked]);

  const attemptRef = useRef(() => {});
  attemptRef.current = () => {
    const position = positionRef.current;
    const hit = position >= bandLeft && position <= bandLeft + bandWidth;
    setFlash(hit ? "hit" : "miss");
    playSound(hit ? "radioLock" : "deny");
    if (hit) {
      const next = hits + 1;
      setHits(next);
      if (next >= goalHits) {
        // 마지막 판은 대역을 다시 뽑지 않는다. 멈춘 화면에서 바늘과 대역이 어긋난다.
        lockedAtRef.current = { position, bandLeft, bandWidth };
        complete({ cleared: true, score: next });
        return;
      }
      // 다음 대역은 좁아진 폭 기준으로 놓는다. 넓은 폭으로 뽑으면 다이얼 끝에 걸린다.
      setBandLeft(randomBandLeft(bandWidthAt(next, bandBonus, difficulty)));
      return;
    }
    const next = misses + 1;
    setMisses(next);
    if (next >= MAX_MISSES) complete({ cleared: false, score: hits });
  };

  // 멈춘 화면에서는 Space를 먹지 않는다. 그 키는 이제 대사를 넘기는 키다.
  useEffect(() => {
    if (locked) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      event.preventDefault();
      attemptRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 300);
    return () => clearTimeout(timer);
  }, [flash]);

  // 멈춘 화면의 대역은 마지막 판의 것 그대로: 판이 끝나며 좁아진 폭을 쓰면 바늘이 밖으로 밀린다.
  const shownBand = (locked && lockedAtRef.current) || { bandLeft, bandWidth };

  /*
   * 라디오 한 대. 플레이 중에는 이게 통째로 버튼이고, 결과 대사 단계에서는
   * 같은 그림이 멈춘 채 배경으로만 남는다. 그림은 하나로 두고 껍데기만 바꾼다.
   */
  const face = (
    <>
      {/* 표시창 바탕: 프레임 뒤로 물려 깐다 (둥근 모서리 틈 방지) */}
      <span aria-hidden className="absolute rounded-md bg-paper" style={glassInset(GLASS_BLEED)} />

      {/* 표시창 안쪽: 여기 있는 건 전부 창 좌표계(0~100%) */}
      <span aria-hidden className="@container absolute block overflow-hidden" style={glassInset()}>
        {/* 명중·실패 순간의 유리 물들임 */}
        <span
          className={`absolute inset-0 transition-opacity duration-300 ${
            flash === "hit"
              ? "bg-memory/35 opacity-100"
              : flash === "miss"
                ? "bg-ember/20 opacity-100"
                : "opacity-0"
          }`}
        />

        {/* 주파수 표시 + 성공 진행 별 (멈춘 화면에서는 별을 뺀다. 게임이 아니라 라디오다) */}
        <span className="absolute inset-x-[4%] top-[3%] flex items-baseline justify-between">
          <span className="flex items-baseline gap-[1.5cqw]">
            <span
              ref={readoutRef}
              className="font-mono text-[7cqw] font-bold leading-none tabular-nums text-ink"
            >
              {freqAt(0)}
            </span>
            <span className="font-mono text-[2.6cqw] font-medium tracking-widest text-ink/45">
              MHz
            </span>
          </span>
          {!locked && (
            <span className="flex items-center gap-[1cqw]">
              {Array.from({ length: goalHits }, (_, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: 고정 길이 진행 표시
                  key={i}
                  className={`block w-[4cqw] ${i < hits ? "text-memory" : "text-ink/20"}`}
                >
                  <StarIcon size="100%" weight={i < hits ? "fill" : "regular"} />
                </span>
              ))}
            </span>
          )}
        </span>

        {/* 다이얼 트랙: 바늘이 끝까지 가도 잘리지 않게 좌우를 띄운다 */}
        <span className="absolute inset-y-0 inset-x-[4%] block">
          {/* 목표 대역: 멈춘 화면에서는 "여기에 맞춰졌다"는 표시로 남는다 */}
          <span
            className="absolute top-[38%] h-[36%] rounded-xs border border-memory bg-memory/25 transition-all duration-300"
            style={{ left: `${shownBand.bandLeft}%`, width: `${shownBand.bandWidth}%` }}
          />

          {/* 눈금 */}
          {ticks.map((tick) => (
            <span
              key={tick.pct}
              className={`absolute w-px -translate-x-1/2 ${
                tick.major ? "top-[58%] h-[16%] bg-ink/45" : "top-[66%] h-[8%] bg-ink/25"
              }`}
              style={{ left: `${tick.pct}%` }}
            />
          ))}

          {/* 베이스라인 */}
          <span className="absolute inset-x-0 top-[74%] h-px bg-ink/20" />

          {/* 주파수 숫자 */}
          {ticks
            .filter((tick) => tick.label !== undefined)
            .map((tick) => (
              <span
                key={`label-${tick.pct}`}
                className="absolute top-[78%] -translate-x-1/2 font-mono text-[2.6cqw] font-bold leading-none tabular-nums text-ink/55"
                style={{ left: `${tick.pct}%` }}
              >
                {tick.label}
              </span>
            ))}

          {/* 삼각 포인터 (바늘 위치 추적) */}
          <span
            ref={pointerRef}
            className="absolute top-[30%] size-0 -translate-x-1/2 border-x-[0.9cqw] border-t-[1.2cqw] border-x-transparent border-t-ember"
            style={{ left: "0%" }}
          />

          {/* 바늘 */}
          <span
            ref={needleRef}
            className="absolute top-[33%] h-[43%] w-[max(1px,0.4cqw)] -translate-x-1/2 rounded-full bg-ember"
            style={{ left: "0%" }}
          />
        </span>

        {/* 잡힌 방송이 지직거리는 결. 소리(잡음 베드)와 같은 것을 눈으로 준다 */}
        {locked && (
          <span
            aria-hidden
            className="film-grain animate-signal-static pointer-events-none absolute inset-0"
          />
        )}
      </span>

      {/* 라디오 본체: 바깥 배경과 표시창이 뚫려 있어 위에 얹으면 창 안에 든 것처럼 보인다 */}
      {/* biome-ignore lint/performance/noImgElement: 표시창을 정확히 덮어야 해서 원본 비율 그대로 쓴다. */}
      <img
        src={ASSETS.images.mgFrequencyTuneFrame}
        alt=""
        width={FRAME.width}
        height={FRAME.height}
        draggable={false}
        className="relative z-10 block h-auto w-full select-none"
      />

      {/* TUNING 램프: 프레임에 그려진 빨간 점 위에 얹는 빛 */}
      <span
        ref={lampRef}
        aria-hidden
        className="absolute z-20 block w-[3.6%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember opacity-0 blur-[3px]"
        style={{ left: LAMP.left, top: LAMP.top, aspectRatio: "1" }}
      />
    </>
  );

  /*
   * 결과 대사 단계: 패널(제목·조작법·스킵)을 통째로 걷어낸다. 대사창 위에 게임 카드가
   * 남아 있으면 방송을 듣는 장면이 아니라 "게임이 끝나지 않은 화면"으로 읽힌다.
   * 대사창 자리는 호스트가 아래쪽을 비워 준다 (MinigameHost의 resultStage).
   */
  if (locked) {
    return (
      <div
        aria-hidden
        className="relative mx-auto block w-[min(88vw,calc(38svh*1.361))] animate-fade-rise"
      >
        {face}
      </div>
    );
  }

  return (
    <MinigameShell
      title={t("minigame.frequencyTune.title")}
      help={hint("minigame.frequencyTune.help")}
      stats={
        <>
          <MinigameStat label={t("minigame.labelSuccess")} value={`${hits} / ${goalHits}`} />
          <MinigameStat
            label={t("minigame.labelMiss")}
            value={`${misses} / ${MAX_MISSES}`}
            tone="warning"
          />
          {flash && (
            <span
              className={`rounded-full px-2 py-0.5 font-bold ${
                flash === "hit" ? "bg-memory text-night" : "bg-ember text-paper"
              }`}
            >
              {t(flash === "hit" ? "minigame.feedback.hit" : "minigame.feedback.miss")}
            </span>
          )}
        </>
      }
      skipVisible={skipByTime || misses >= SKIP_AFTER_MISSES}
      onSkip={() => {
        // 스킵도 "맞춘 것"으로 친다. 멈춘 화면의 바늘은 대역 한가운데 세운다.
        lockedAtRef.current = { position: bandLeft + bandWidth / 2, bandLeft, bandWidth };
        complete({ cleared: true, score: hits });
      }}
    >
      {/*
       * 폭은 화면 높이에서도 잘라준다. 오버레이는 스크롤되지 않아서(MinigameHost),
       * 세로가 짧으면 라디오 아래가 잘린다.
       */}
      <button
        type="button"
        onPointerDown={() => attemptRef.current()}
        aria-label={hint("minigame.frequencyTune.help")}
        className="relative mx-auto block w-[min(100%,calc(44svh*1.361))] cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-memory"
      >
        {face}
      </button>
    </MinigameShell>
  );
}
