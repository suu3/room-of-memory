"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";
import { isOrdered, PAPER_IDS, type PaperId, papersInPlace, SCATTERED, swapPapers } from "./papers";

/** 날짜만 보면 되는 판이라 오래 걸리지 않는다. 그래도 막히면 이만큼 뒤에 스킵. */
const SKIP_AFTER_MS = 60_000;

/**
 * 안방 책상 위 서류 조각을 날짜순으로 놓는다 (v4.1 7장, research-note 2차).
 *
 * 조각을 하나 집고(클릭·Space) 다른 자리를 누르면 둘이 맞바뀐다. 키보드로는 집은 채
 * ↑/↓로 옮긴다. 날짜순이 되는 순간 기록이 한 줄로 이어지고, "내려놓는다"로 끝난다.
 * 실패는 없다: 순서만 맞추면 된다.
 */
export function PapersOrderMinigame({ onComplete, onSettled, stage = "play" }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const frozen = stage === "result";
  const [order, setOrder] = useState<PaperId[]>(() => [...(frozen ? PAPER_IDS : SCATTERED)]);
  const [cursor, setCursor] = useState(0);
  const [held, setHeld] = useState<number | null>(null);
  const skipByTime = useSkipEligible(SKIP_AFTER_MS);
  const solved = isOrdered(order);

  const settledRef = useRef(frozen);
  useEffect(() => {
    if (!solved || settledRef.current) return;
    settledRef.current = true;
    onSettled?.();
    playSound("success");
  }, [solved, onSettled]);

  const pick = useCallback(
    (index: number) => {
      if (solved) return;
      setCursor(index);
      if (held === null) {
        playSound("select", { variation: 0.05 });
        setHeld(index);
        return;
      }
      if (held !== index) {
        playSound("flip", { variation: 0.05 });
        setOrder((current) => swapPapers(current, held, index));
      }
      setHeld(null);
    },
    [held, solved],
  );

  const keyRef = useRef<(event: KeyboardEvent) => void>(() => {});
  keyRef.current = (event) => {
    if (frozen) return;
    if (solved) {
      if (event.code !== "Enter") return;
      event.preventDefault();
      complete({ cleared: true, celebrated: true });
      return;
    }
    const step = event.code === "ArrowUp" ? -1 : event.code === "ArrowDown" ? 1 : 0;
    if (step !== 0) {
      event.preventDefault();
      const to = Math.max(0, Math.min(order.length - 1, cursor + step));
      if (to === cursor) return;
      if (held !== null) {
        // 집은 조각을 한 칸 옮긴다: 이웃과 맞바꾸고 계속 들고 있다
        playSound("flip", { variation: 0.05 });
        setOrder((current) => swapPapers(current, cursor, to));
        setHeld(to);
      }
      setCursor(to);
      return;
    }
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      if (held === null) {
        playSound("select", { variation: 0.05 });
        setHeld(cursor);
      } else {
        setHeld(null);
      }
    }
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => keyRef.current(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <MinigameShell
      title={t("minigame.papersOrder.title")}
      help={hint("minigame.papersOrder.help")}
      stats={
        <MinigameStat
          label={t("minigame.papersOrder.inPlace")}
          value={`${papersInPlace(order)}/${order.length}`}
        />
      }
      skipVisible={!frozen && !solved && skipByTime}
      onSkip={() => complete({ cleared: true })}
    >
      <div className="flex flex-col gap-3">
        <ol className="flex flex-col gap-2">
          {order.map((id, index) => {
            const isHeld = held === index;
            const isCursor = cursor === index && !solved && !frozen;
            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={solved || frozen}
                  onClick={() => pick(index)}
                  aria-pressed={isHeld}
                  // 종이 결: 한 장을 찢은 조각이라 가운데 접힌 자리만 비친다.
                  // 그림 좌우에 어두운 바탕 테(768px 중 양쪽 ~40px)가 있어 cover로 깔면 날짜가
                  // 그 위에 얹혀 잘려 보였다. 폭을 118%로 키워 테를 칸 밖으로 민다
                  style={{
                    backgroundImage: `url(${ASSETS.images.mgPapersPaper})`,
                    backgroundSize: "118% auto",
                    backgroundPosition: `center ${20 + index * 20}%`,
                  }}
                  aria-label={t("minigame.papersOrder.pieceLabel", {
                    index: index + 1,
                    date: t(`minigame.papersOrder.pieces.${id}.date`),
                    text: t(`minigame.papersOrder.pieces.${id}.text`),
                  })}
                  className={`flex w-full cursor-pointer items-baseline gap-3 rounded-sm border-2 bg-paper px-4 py-3 text-left text-ink transition-all disabled:cursor-default ${
                    solved
                      ? "border-memory/70"
                      : isHeld
                        ? "-translate-y-0.5 border-memory shadow-lg"
                        : isCursor
                          ? "border-ink/40"
                          : "border-ink/10 hover:border-ink/30"
                  } ${index % 2 === 0 ? "-rotate-[0.6deg]" : "rotate-[0.5deg]"}`}
                >
                  <span className="shrink-0 text-sm font-bold tabular-nums text-ink/70">
                    {t(`minigame.papersOrder.pieces.${id}.date`)}
                  </span>
                  <span className="break-ko text-pretty text-sm leading-relaxed">
                    {t(`minigame.papersOrder.pieces.${id}.text`)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {solved && !frozen ? (
          <div className="flex animate-fade-rise flex-col items-center gap-2 pt-1">
            <p aria-live="polite" className="break-ko text-center text-sm text-paper">
              {t("minigame.papersOrder.joined")}
            </p>
            <button
              type="button"
              onClick={() => complete({ cleared: true, celebrated: true })}
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-paper px-6 py-2 text-sm font-bold tracking-widest text-ink transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <CheckIcon size={16} weight="bold" />
              {t("minigame.inspect.putDown")}
            </button>
          </div>
        ) : null}
      </div>
    </MinigameShell>
  );
}
