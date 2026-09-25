"use client";

import { CaretDown, CaretUp, LockSimpleOpen } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { SINK_DIAL_CODE } from "@/data/room-clues";
import { useControlHint } from "@/i18n/control-hint";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";

/** 드럼은 Canvas라 클라이언트에서만 뜬다 (.claude/rules/r3f.md). */
const DialDrums = dynamic(() => import("@/components/canvas/DialDrums"), { ssr: false });

/** 세로로 이만큼 끌면 한 눈금 넘어간다(px). */
const DRAG_PX_PER_STEP = 34;

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
 * 3D 드럼 (v4.1): 숫자 원통 두 개를 세로로 끌어 굴린다. 끄는 동안 드럼이 손을 따라
 * 덜 넘어간 만큼 기울고, 한 눈금을 넘기면 딸깍 넘어간다. 아래로 끌면 +1.
 * 키보드: 칸을 고르고(←/→) 돌린다(↑/↓), Enter로 연다. 드럼 옆 버튼으로도 된다.
 */
export function SinkDialMinigame({ onComplete, onSettled }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  // 누적 눈금: 9→0에서 드럼이 거꾸로 한 바퀴 돌지 않게. 숫자는 mod 10
  const [steps, setSteps] = useState<number[]>(() => SINK_DIAL_CODE.split("").map(() => 0));
  const digits = steps.map((value) => ((value % 10) + 10) % 10);
  const dragRef = useRef<number[]>(steps.map(() => 0));
  const dragging = useRef<{
    index: number;
    pointerId: number;
    lastY: number;
    carry: number;
  } | null>(null);
  const [focus, setFocus] = useState(0);
  const [fails, setFails] = useState(0);
  const [solved, setSolved] = useState(false);
  const skipByTime = useSkipEligible(SKIP_AFTER_MS);

  const turn = useCallback(
    (index: number, step: 1 | -1) => {
      if (solved) return;
      playSound("select", { variation: 0.06 });
      setSteps((current) => current.map((value, i) => (i === index ? value + step : value)));
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

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (solved) return;
      const box = event.currentTarget.getBoundingClientRect();
      const index = Math.min(
        steps.length - 1,
        Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * steps.length)),
      );
      event.currentTarget.setPointerCapture(event.pointerId);
      dragging.current = { index, pointerId: event.pointerId, lastY: event.clientY, carry: 0 };
      setFocus(index);
    },
    [solved, steps.length],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragging.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.carry += event.clientY - drag.lastY;
      drag.lastY = event.clientY;
      while (Math.abs(drag.carry) >= DRAG_PX_PER_STEP) {
        const step = drag.carry > 0 ? 1 : -1;
        drag.carry -= step * DRAG_PX_PER_STEP;
        turn(drag.index, step);
      }
      dragRef.current[drag.index] = drag.carry / DRAG_PX_PER_STEP;
    },
    [turn],
  );

  const endDrag = useCallback(() => {
    const drag = dragging.current;
    if (!drag) return;
    dragRef.current[drag.index] = 0;
    dragging.current = null;
  }, []);

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
        <div className="flex items-center gap-2">
          <DialButtons
            index={0}
            onTurn={(step) => {
              setFocus(0);
              turn(0, step);
            }}
          />
          <div
            role="img"
            aria-label={t("minigame.sinkDial.alt", { value: digits.join(" ") })}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="h-44 w-60 cursor-grab touch-none rounded-md border border-ink/10 bg-bone/25 active:cursor-grabbing sm:h-52 sm:w-72"
          >
            <DialDrums steps={steps} dragRef={dragRef} focus={focus} solved={solved} />
          </div>
          <DialButtons
            index={1}
            onTurn={(step) => {
              setFocus(1);
              turn(1, step);
            }}
          />
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

/** 드럼 옆의 올리기·내리기 버튼 (키보드·스크린리더용 같은 조작). */
function DialButtons({ index, onTurn }: { index: number; onTurn: (step: 1 | -1) => void }) {
  const { t } = useTranslation();
  const className =
    "grid size-10 cursor-pointer place-items-center rounded-sm text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink";
  return (
    <div className="flex flex-col gap-2">
      {/* 드럼은 아래로 굴리면 +1이라, 위 버튼이 +1 (위의 숫자를 끌어내린다) */}
      <button
        type="button"
        aria-label={t("minigame.sinkDial.up", { index: index + 1 })}
        onClick={() => onTurn(1)}
        className={className}
      >
        <CaretUp size={20} weight="bold" />
      </button>
      <button
        type="button"
        aria-label={t("minigame.sinkDial.down", { index: index + 1 })}
        onClick={() => onTurn(-1)}
        className={className}
      >
        <CaretDown size={20} weight="bold" />
      </button>
    </div>
  );
}
