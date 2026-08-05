"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";
import {
  BLANK_TILE,
  type Board,
  canMove,
  isSolved,
  moveAt,
  PUZZLE_SIZE,
  type SlideDirection,
  scrambledBoard,
  slide,
  tileBackgroundPosition,
} from "./puzzle";

const SKIP_AFTER_MS = 40_000;
/** 섞는 수. 3×3에서 이 정도면 한눈에 답이 보이지도, 손이 지치지도 않는다. */
const SCRAMBLE_MOVES = 24;

const ARROW_DIRECTIONS: Record<string, SlideDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * 2차 조사에서 액자 사진을 맞춘다.
 *
 * 1차는 뿌연 유리를 닦는 게임이었다. 같은 액자를 또 닦게 하면 2바퀴가 1바퀴의
 * 재탕이 되므로, 여기서는 조각난 사진을 다시 맞춘다 — 흩어진 것을 제자리로
 * 돌려놓는 동작이 2바퀴의 주제와 같다.
 */
export function PhotoPuzzleMinigame({ onComplete, onSettled }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const [board, setBoard] = useState<Board>(() => scrambledBoard(SCRAMBLE_MOVES, Math.random));
  const [moves, setMoves] = useState(0);
  const [solved, setSolved] = useState(false);
  const skipEligible = useSkipEligible(SKIP_AFTER_MS);

  /*
   * 판을 한 번 민다. 못 미는 자리를 눌렀으면 아무 일도 일어나지 않는다 —
   * 막힌 조각마다 실패음을 울리면 손이 바쁜 구간이 시끄러워진다.
   */
  const applyRef = useRef((_next: Board) => {});
  applyRef.current = (next: Board) => {
    if (solved || next === board) return;
    setBoard(next);
    setMoves((count) => count + 1);
    if (!isSolved(next)) {
      playSound("flip");
      return;
    }
    setSolved(true);
    onSettled?.();
    playSound("collect");
  };

  // 창 전역 키 핸들러는 한 번만 붙으므로, 최신 판은 렌더마다 갱신되는 ref로 건넨다
  const slideRef = useRef((_direction: SlideDirection) => {});
  slideRef.current = (direction: SlideDirection) => applyRef.current(slide(board, direction));

  // 맞추고 나면 사진 한 장이 남는다. 잠깐 보여준 뒤 결과 대사로 넘긴다.
  useEffect(() => {
    if (!solved) return;
    const timer = window.setTimeout(() => complete({ cleared: true, score: moves }), 900);
    return () => window.clearTimeout(timer);
  }, [solved, moves, complete]);

  // 방향키만으로 끝까지 플레이할 수 있어야 한다 (.claude/rules/minigames.md)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const direction = ARROW_DIRECTIONS[event.key];
      if (!direction || event.repeat) return;
      event.preventDefault();
      slideRef.current(direction);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <MinigameShell
      title={t("minigame.photoPuzzle.title")}
      help={hint("minigame.photoPuzzle.help")}
      stats={<MinigameStat label={t("minigame.photoPuzzle.moves")} value={moves} />}
      skipVisible={skipEligible && !solved}
      onSkip={() => complete({ cleared: true, score: moves })}
    >
      <div
        className="mx-auto grid w-[min(100%,calc(52svh*0.92))] gap-1 rounded-md bg-ink/10 p-1"
        style={{ gridTemplateColumns: `repeat(${PUZZLE_SIZE}, minmax(0, 1fr))` }}
      >
        {board.map((tile, index) => {
          const position = tileBackgroundPosition(tile);
          // 다 맞춘 뒤에는 빈칸도 사진으로 메워 한 장으로 남긴다
          const empty = tile === BLANK_TILE && !solved;
          const movable = !solved && canMove(board, index);

          return (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: 자리(index)가 곧 격자 칸이라 조각이 바뀌어도 같은 칸이다.
              key={index}
              type="button"
              disabled={!movable}
              aria-label={t("minigame.photoPuzzle.tile", { value: tile + 1 })}
              onClick={() => applyRef.current(moveAt(board, index))}
              className={`aspect-square rounded-xs bg-cover transition-[opacity,transform] duration-150 ${
                empty ? "bg-ink/15" : ""
              } ${movable ? "cursor-pointer hover:-translate-y-0.5" : "cursor-default"} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory`}
              style={
                empty
                  ? undefined
                  : {
                      backgroundImage: `url(${ASSETS.images.mgPhotoWipePhase2})`,
                      backgroundSize: `${PUZZLE_SIZE * 100}%`,
                      backgroundPosition: `${position.x}% ${position.y}%`,
                    }
              }
            />
          );
        })}
      </div>
    </MinigameShell>
  );
}
