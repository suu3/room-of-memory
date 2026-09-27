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
/**
 * 섞는 수. 2026-09-26에 24에서 12로: 클라이맥스 직전이라 퍼즐에 오래 붙들지 않는다.
 * 이 정도면 한눈에 답이 보이진 않고, 열 번 남짓 밀면 맞는다.
 */
const SCRAMBLE_MOVES = 12;
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
 * 재탕이 되므로, 여기서는 조각난 사진을 다시 맞춘다. 흩어진 것을 제자리로
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
  const aspect = usePhotoAspect(ASSETS.images.mgPhotoWipePhase2);

  /*
   * 판을 한 번 민다. 못 미는 자리를 눌렀으면 아무 일도 일어나지 않는다.
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
        // gap 없이 맞대어 깐다. 틈은 조각 안쪽의 TILE_SEAM이 그린다
        className="mx-auto grid w-[min(100%,calc(52svh*0.92))] overflow-hidden rounded-md bg-ivory/10"
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
              // 조각에도 바탕을 깔아 둔다. 사진이 붙기 전에 빈 칸으로 비지 않게
              className={`transition-[opacity,transform] duration-150 ${
                empty ? "bg-ivory/10" : "bg-bone"
              } ${movable ? "cursor-pointer hover:-translate-y-0.5" : "cursor-default"} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-memory`}
              style={{
                // 조각도 사진과 같은 비율이어야 한다. 정사각 칸에 넣으면 사진이 눌린다
                aspectRatio: aspect,
                boxShadow: TILE_SEAM,
                ...(empty
                  ? null
                  : {
                      backgroundImage: `url(${ASSETS.images.mgPhotoWipePhase2})`,
                      backgroundSize: TILE_BACKGROUND_SIZE,
                      backgroundPosition: `${position.x}% ${position.y}%`,
                    }),
              }}
            />
          );
        })}
      </div>
    </MinigameShell>
  );
}
