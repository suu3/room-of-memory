"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlHint } from "@/i18n/control-hint";
import { ASSETS } from "@/lib/assets";
import { playSound } from "@/lib/audio";
import type { MinigameProps } from "@/types/minigame";
import { MinigameShell, MinigameStat, useOnceCompleter, useSkipEligible } from "../shell";
import {
  type Board,
  type CursorDirection,
  isPlaced,
  isSolved,
  moveCursor,
  PUZZLE_SIZE,
  shuffledBoard,
  swap,
  tileBackgroundPosition,
} from "./puzzle";

const SKIP_AFTER_MS = 40_000;
/** 조각 하나가 잘라 쓸 배경의 크기: 가로·세로 **둘 다** 격자 배수여야 한다. */
const TILE_BACKGROUND_SIZE = `${PUZZLE_SIZE * 100}% ${PUZZLE_SIZE * 100}%`;

/**
 * 조각 사이의 틈(px). 격자의 gap이 아니라 조각 **안쪽에** 그린다.
 *
 * gap으로 벌리면 사진이 틈만큼 늘어난다: 조각 하나가 제 폭의 3배로 그림을 깔기 때문에,
 * 조각들을 틈만큼 떼어 놓으면 세 조각이 덮는 폭이 그림 한 장보다 넓어진다. 잘린 게
 * 아니라 벌어진 그림이 된다. 조각을 맞대어 놓고 테두리를 안쪽으로 덮으면 틈이 그림의
 * 그만큼을 가려서, 진짜로 잘라 놓은 것처럼 이어진다.
 *
 * 색은 판 바탕과 같아야 틈이 "판이 비치는 자리"로 읽힌다. 판이 ivory 10%를 panel 위에
 * 깔고 있으므로 두 겹을 같은 순서로 쌓는다 (먼저 적은 그림자가 위에 온다).
 */
const SEAM_PX = 3;
const TILE_SEAM = [
  `inset 0 0 0 ${SEAM_PX}px color-mix(in srgb, var(--color-ivory) 10%, transparent)`,
  `inset 0 0 0 ${SEAM_PX}px var(--color-panel)`,
].join(", ");

/**
 * 사진의 가로세로비를 실제 파일에서 읽어 온다.
 *
 * 격자가 사진과 다른 비율이면 조각이 사진을 왜곡한다. 값을 코드에 박아 두면 사진을
 * 갈아 끼울 때마다 같이 고쳐야 하므로, 파일에게 직접 묻는다. 알아내기 전에는
 * 정사각으로 두고, 알아낸 뒤 한 번 갱신된다.
 */
function usePhotoAspect(src: string): number {
  const [aspect, setAspect] = useState(1);

  useEffect(() => {
    let active = true;
    const image = new Image();
    const measure = () => {
      if (active && image.naturalWidth > 0 && image.naturalHeight > 0) {
        setAspect(image.naturalWidth / image.naturalHeight);
      }
    };
    image.onload = measure;
    image.src = src;
    // 이미 받아 둔 사진이면 onload가 안 온다 (1차 조사에서 같은 파일을 썼다)
    if (image.complete) measure();
    return () => {
      active = false;
    };
  }, [src]);

  return aspect;
}

const ARROW_DIRECTIONS: Record<string, CursorDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * 2차 조사에서 액자 사진을 맞춘다.
 *
 * 1차는 뿌연 유리를 닦는 게임이었다. 같은 액자를 또 닦게 하면 2바퀴가 1바퀴의
 * 재탕이 되므로, 여기서는 조각난 사진을 다시 맞춘다. 흩어진 것을 제자리로
 * 돌려놓는 동작이 2바퀴의 주제와 같다.
 *
 * 조각 하나를 누르면 금빛 테를 두르고 들리고, 다른 조각을 누르면 둘이 자리를 바꾼다.
 * 제자리에 들어간 조각은 틈이 사라지며 사진에 붙는다: 더 집히지 않는다 (puzzle.ts).
 */
export function PhotoPuzzleMinigame({ onComplete, onSettled }: MinigameProps) {
  const { t } = useTranslation();
  const hint = useControlHint();
  const complete = useOnceCompleter(onComplete);
  const [board, setBoard] = useState<Board>(() => shuffledBoard(Math.random));
  /** 들어 올린 조각의 자리. 다음에 누른 조각과 맞바꾼다. */
  const [held, setHeld] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [solved, setSolved] = useState(false);
  const skipEligible = useSkipEligible(SKIP_AFTER_MS);
  const aspect = usePhotoAspect(ASSETS.images.mgPhotoWipePhase2);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /* 조각 하나를 누른다: 들거나, 내려놓거나, 들고 있던 것과 맞바꾼다. */
  const pickRef = useRef((_index: number) => {});
  pickRef.current = (index: number) => {
    if (solved || isPlaced(board, index)) return;
    if (held === null) {
      setHeld(index);
      playSound("select", { variation: 0.05 });
      return;
    }
    if (held === index) {
      setHeld(null);
      return;
    }
    const next = swap(board, held, index);
    setBoard(next);
    setHeld(null);
    setMoves((count) => count + 1);
    if (!isSolved(next)) {
      playSound("flip");
      return;
    }
    setSolved(true);
    onSettled?.();
    playSound("collect");
  };

  // 맞추고 나면 사진 한 장이 남는다. 잠깐 보여준 뒤 결과 대사로 넘긴다.
  useEffect(() => {
    if (!solved) return;
    const timer = window.setTimeout(() => complete({ cleared: true, score: moves }), 900);
    return () => window.clearTimeout(timer);
  }, [solved, moves, complete]);

  /*
   * 방향키만으로 끝까지 플레이할 수 있어야 한다 (.claude/rules/minigames.md). 방향키는
   * 포커스를 옆 조각으로 옮기고, Enter·Space는 버튼 그 자체라 누르기와 같다.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const direction = ARROW_DIRECTIONS[event.key];
      if (!direction) return;
      event.preventDefault();
      const focused = tileRefs.current.indexOf(document.activeElement as HTMLButtonElement | null);
      const next = focused < 0 ? 0 : moveCursor(focused, direction);
      tileRefs.current[next]?.focus();
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
        // gap 없이 맞대어 깐다. 틈은 조각 안쪽의 TILE_SEAM이 그린다
        className="mx-auto grid w-[min(100%,calc(52svh*0.92))] overflow-hidden rounded-md bg-ivory/10"
        style={{ gridTemplateColumns: `repeat(${PUZZLE_SIZE}, minmax(0, 1fr))` }}
      >
        {board.map((tile, index) => {
          const position = tileBackgroundPosition(tile);
          const placed = isPlaced(board, index);
          const lifted = held === index;
          const movable = !solved && !placed;

          return (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: 자리(index)가 곧 격자 칸이라 조각이 바뀌어도 같은 칸이다.
              key={index}
              type="button"
              ref={(node) => {
                tileRefs.current[index] = node;
              }}
              // disabled 대신 aria-disabled: 방향키 포커스가 제자리 조각을 건너뛰지 않게
              aria-disabled={!movable}
              aria-pressed={lifted}
              aria-label={t("minigame.photoPuzzle.tile", { value: tile + 1 })}
              onClick={() => pickRef.current(index)}
              // 조각에도 바탕을 깔아 둔다. 사진이 붙기 전에 빈 칸으로 비지 않게
              className={`relative bg-bone transition-[opacity,transform] duration-150 ${
                lifted ? "z-10 -translate-y-1 scale-[1.03]" : ""
              } ${movable ? "cursor-pointer hover:-translate-y-0.5" : "cursor-default"} focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory`}
              style={{
                // 조각도 사진과 같은 비율이어야 한다. 정사각 칸에 넣으면 사진이 눌린다
                aspectRatio: aspect,
                // 들린 조각은 금빛 테, 제자리 조각은 틈 없이 사진에 붙는다 (다 맞추면 한 장)
                boxShadow: lifted
                  ? `inset 0 0 0 ${SEAM_PX}px var(--color-memory), ${TILE_SEAM}`
                  : placed
                    ? "none"
                    : TILE_SEAM,
                backgroundImage: `url(${ASSETS.images.mgPhotoWipePhase2})`,
                backgroundSize: TILE_BACKGROUND_SIZE,
                backgroundPosition: `${position.x}% ${position.y}%`,
              }}
            />
          );
        })}
      </div>
    </MinigameShell>
  );
}
